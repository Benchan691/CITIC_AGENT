from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import uuid
import psycopg
from unified_mcp_server.env_loader import load_server_env
from unified_mcp_server.postgres_store import PostgresBootstrap
from unified_mcp_server.alert_email import AlertEmailStore
from unified_mcp_server.alert_ingest import AlertIngestionStore, NormalizedAlert
import os
import pytest

@pytest.mark.skipif(os.environ.get('SMTP_DATABASE_TEST') != '1', reason='explicit PostgreSQL fixture test')
def test_postgres_outbox_migration_and_recovery():
 load_server_env()
 uri=PostgresBootstrap.from_env().uri
 with psycopg.connect(uri) as c:
  with c.transaction(force_rollback=True):
   schema='smtp_test_'+uuid.uuid4().hex
   c.execute('CREATE SCHEMA '+schema)
   c.execute('SET LOCAL search_path TO '+schema+',public')
   for p in sorted((Path(__file__).resolve().parents[5] / 'database' / 'migrations').glob('*.sql')):
    c.execute(p.read_text())
   class Store(AlertEmailStore):
    def _connect(self):
     from contextlib import nullcontext
     return nullcontext(c)
   store=Store.__new__(Store)
   customer=c.execute("INSERT INTO customers(gid,name) VALUES('SMTP-FIXTURE','SMTP fixture') RETURNING id").fetchone()[0]
   store.save_customer_email_config(str(customer),{'recipients':['a@example.test']})
   store.save_rule(dict(name='fixture',customer_id=str(customer),severities=['high'],enabled=True))
   event=c.execute("INSERT INTO sec_events(customer_id,severity,splunk_sid,event_data) VALUES(%s,'high','fixture-sid','{\"legacy_ingestion_mode\":\"explicit\"}'::jsonb) RETURNING id",(customer,)).fetchone()[0]
   ctx=store.claim(1,'fixture')[0]
   assert ctx.event_id==str(event)
   snapshot=dict(recipients={'recipients':['a@example.test','b@example.test']},subject='fixture',body='fixture',html='<p>fixture</p>',message_id='<fixture@example.test>')
   store.save_snapshot(ctx.outbox_id,snapshot)
   store.record_outcome(ctx,snapshot,dict(accepted=['a@example.test'],rejected={'b@example.test':450},message_id=snapshot['message_id']))
   c.execute("UPDATE sec_event_email_outbox SET next_attempt_at=NOW()")
   retry=store.claim(1,'fixture')[0]
   assert retry.accepted_recipients==['a@example.test']
   assert retry.delivery_snapshot['recipients']=={'recipients':['b@example.test']}
   store.record_outcome(retry,retry.delivery_snapshot,dict(accepted=['b@example.test'],rejected={},message_id=snapshot['message_id']))
   row=c.execute('SELECT status,next_attempt_at,smtp_accepted_at FROM sec_event_email_outbox').fetchone()
   assert row[0]=='accepted' and row[1] is None and row[2]
   assert store.preview(str(customer),str(event))['matched_rules']==['fixture']
   c.execute("UPDATE sec_event_email_outbox SET status='processing',claimed_at=NOW()")
   store.reset_stale_processing()
   assert c.execute('SELECT status,next_attempt_at FROM sec_event_email_outbox').fetchone()==('uncertain',None)
   c.execute("INSERT INTO source_types(name) VALUES('Exact source')")
   preview=store.preview_csv(str(customer),'source_type,severity,recipients\nExact source,high,a@example.test\nUnknown,high,a@example.test')
   assert [r['status'] for r in preview['rows']]==['ready','unapplied']
   with pytest.raises(ValueError):
    store.preview(str(uuid.uuid4()),str(event))
   print('PostgreSQL migration, trigger, partial acceptance, retry, preview and restart recovery verified; fixture transaction rolled back.')


@pytest.mark.skipif(os.environ.get('SMTP_DATABASE_TEST') != '1', reason='explicit PostgreSQL fixture test')
def test_registered_alert_run_allocates_one_eid_and_one_email():
 load_server_env()
 uri=PostgresBootstrap.from_env().uri
 with psycopg.connect(uri) as c:
  with c.transaction(force_rollback=True):
   schema='alert_identity_test_'+uuid.uuid4().hex
   c.execute('CREATE SCHEMA '+schema)
   c.execute('SET LOCAL search_path TO '+schema+',public')
   for p in sorted((Path(__file__).resolve().parents[5] / 'database' / 'migrations').glob('*.sql')):
    c.execute(p.read_text())
   class Store(AlertIngestionStore):
    def _connect(self):
     from contextlib import nullcontext
     return nullcontext(c)
   store=Store.__new__(Store)
   customer=c.execute("""INSERT INTO customers(gid,name,status,cid,email_config,splunk_indexes,alert_delivery_enabled)
                       VALUES('CPC-GID','CPC fixture','active','CPC001',%s::jsonb,ARRAY['CPC_security','CPC_endpoint'],TRUE)
                       RETURNING id""", ('{"recipients":["a@example.test"]}',)).fetchone()[0]
   with pytest.raises(psycopg.errors.CheckViolation):
    with c.transaction():
     c.execute("INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id) VALUES('splunk-prod','unverified',%s)",(customer,))
   c.execute("""INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id,verified_at,verified_by,verification)
               VALUES('splunk-prod','CPC_security',%s,NOW(),'fixture','{"verified":true,"deployment":"splunk-prod","index_name":"CPC_security"}'::jsonb)""", (customer,))
   c.execute("""INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id,verified_at,verified_by,verification)
               VALUES('splunk-prod','CPC_endpoint',%s,NOW(),'fixture','{"verified":true,"deployment":"splunk-prod","index_name":"CPC_endpoint"}'::jsonb)""", (customer,))
   definition={"name":"CPC suspicious login","app":"search","owner":"nobody","spl":"index=CPC_security OR index=CPC_endpoint","stable_id":"stable-alert-1"}
   registration=store.register_definition(definition,deployment='splunk-prod',origin='human',actor='admin@example.test',action_configured=True,delivery_enabled=True)
   assert registration['aid']=='CPC001-0000'
   assert registration['source_indexes']==['CPC_security','CPC_endpoint']
   policy=store.save_alert_policy(str(customer),{"detail_columns":["device","severity"]},registration_id=registration['id'],actor='admin@example.test')
   payload={"version":1,"deployment":"splunk-prod","registration_id":registration['id'],"stable_id":"stable-alert-1",
            "sid":"scheduler-sid-1","alert_name":"CPC suspicious login","app":"search","owner":"nobody",
            "trigger_time":"2026-09-09T08:15:30.123456Z","result_count":2,"severity":"high",
            "definition":definition,"selected_columns":["device","severity"],
            "policy_id":policy['id'],"policy_revision":policy['revision'],"definition_revision":1,
            "matching_count":2,"retained_count":2,"truncated":False,"original_row_positions":[0,1],
            "rows":[{"device":"host-1","severity":"high"},{"device":"host-2","severity":"high"}]}
   polled=NormalizedAlert('scheduler-sid-1','CPC suspicious login',datetime(2026,9,9,8,15,30,123456,tzinfo=timezone.utc),2,'high',None,None,{'app':'search','owner':'nobody'},'poll-1')
   assert store.reconcile_polled_alert('splunk-prod',polled)=='missing'
   store.quarantine_alert_run({**payload,"_host_capability":"must-not-persist"},'context was awaiting review')
   assert len(store.list_alert_run_quarantine())==1
   quarantined_payload=c.execute("SELECT payload FROM sec_alert_run_quarantine WHERE splunk_sid='scheduler-sid-1'").fetchone()[0]
   assert '_host_capability' not in quarantined_payload
   stored=store.receive_alert_run(payload,authenticated_deployment='splunk-prod',replay_id='run-1')
   duplicate=store.receive_alert_run(payload,authenticated_deployment='splunk-prod',replay_id='run-1')
   assert stored['status']=='stored'
   assert stored['eid']=='CPC001-0000-20260909T081530123456Z-000001'
   assert duplicate == {"status":"duplicate","duplicate":True,"cid":"CPC001","aid":"CPC001-0000","eid":stored['eid'],"event_id":stored['event_id']}
   assert c.execute("SELECT COUNT(*) FROM sec_events WHERE eid=%s", (stored['eid'],)).fetchone()[0]==1
   assert c.execute("SELECT COUNT(*) FROM sec_event_details WHERE event_id=%s::uuid", (stored['event_id'],)).fetchone()[0]==2
   assert c.execute("SELECT COUNT(*) FROM sec_event_email_outbox WHERE eid=%s", (stored['eid'],)).fetchone()[0]==1
   assert c.execute("SELECT COUNT(*) FROM sec_alert_run_receipts WHERE registration_id=%s::uuid AND splunk_sid='scheduler-sid-1'", (registration['id'],)).fetchone()[0]==1
   assert c.execute("SELECT status FROM sec_alert_delivery_reconciliation WHERE registration_id=%s::uuid AND splunk_sid='scheduler-sid-1'",(registration['id'],)).fetchone()[0]=='received'
   assert store.list_alert_run_quarantine()==[]
   second=store.receive_alert_run({**payload,"sid":"scheduler-sid-2"},authenticated_deployment='splunk-prod',replay_id='run-2')
   assert second['eid']=='CPC001-0000-20260909T081530123456Z-000002'
   polled_second=NormalizedAlert('scheduler-sid-2','CPC suspicious login',datetime(2026,9,9,8,15,30,123456,tzinfo=timezone.utc),2,'high',None,None,{'app':'search','owner':'nobody'},'poll-2')
   assert store.reconcile_polled_alert('splunk-prod',polled_second)=='received'
   assert c.execute("SELECT COUNT(*) FROM sec_events WHERE alert_registration_id=%s::uuid",(registration['id'],)).fetchone()[0]==2
   assert c.execute("SELECT COUNT(*) FROM sec_event_email_outbox WHERE customer_id=%s",(customer,)).fetchone()[0]==2
   c.execute("UPDATE customers SET status='inactive' WHERE id=%s",(customer,))
   assert c.execute("SELECT COUNT(*) FROM sec_event_email_outbox WHERE customer_id=%s AND status='held'",(customer,)).fetchone()[0]==2
   c.execute("UPDATE customers SET status='active' WHERE id=%s",(customer,))
   c.execute("UPDATE sec_alert_index_ownership SET status='review' WHERE splunk_deployment='splunk-prod' AND index_name='CPC_endpoint'")
   invalidated=c.execute("SELECT registration_state,delivery_state FROM sec_alert_registrations WHERE id=%s::uuid",(registration['id'],)).fetchone()
   assert invalidated==('needs_review','blocked')


@pytest.mark.skipif(os.environ.get('SMTP_DATABASE_TEST') != '1', reason='explicit PostgreSQL fixture test')
def test_publication_refresh_preserves_pending_and_failed_states():
 load_server_env()
 uri=PostgresBootstrap.from_env().uri
 with psycopg.connect(uri) as c:
  with c.transaction(force_rollback=True):
   schema='alert_publication_test_'+uuid.uuid4().hex
   c.execute('CREATE SCHEMA '+schema)
   c.execute('SET LOCAL search_path TO '+schema+',public')
   for p in sorted((Path(__file__).resolve().parents[5] / 'database' / 'migrations').glob('*.sql')):
    c.execute(p.read_text())
   class Store(AlertIngestionStore):
    def _connect(self):
     from contextlib import nullcontext
     return nullcontext(c)
   store=Store.__new__(Store)
   customer=c.execute("""INSERT INTO customers(gid,name,status,cid,email_config)
                       VALUES('PUB-GID','Publication fixture','active','PUB001',%s::jsonb)
                       RETURNING id""", ('{"recipients":["a@example.test"]}',)).fetchone()[0]
   c.execute("""INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id,verified_at,verified_by,verification)
               VALUES('splunk-prod','PUB_security',%s,NOW(),'fixture','{"verified":true,"deployment":"splunk-prod","index_name":"PUB_security"}'::jsonb)""", (customer,))
   definition={"name":"Pending publication alert","app":"search","owner":"nobody","spl":"index=PUB_security","stable_id":"stable-publication-1"}
   pending=store.register_definition(definition,deployment='splunk-prod',origin='agent',actor='admin@example.test',publication_pending=True)
   assert pending['registration_state']=='pending' and pending['publication_state']=='pending'
   action=store.mark_registration_action_configured(pending['id'])
   assert action['registration_state']=='pending' and action['publication_state']=='pending' and action['delivery_state']=='blocked'
   failed=store.mark_registration_publication(pending['id'],success=False,error='extension timed out',principal='admin@example.test')
   assert failed['registration_state']=='failed' and failed['publication_state']=='failed' and failed['last_error']=='extension timed out'
   refreshed=store.register_definition(definition,deployment='splunk-prod',origin='discovery',actor='discovery-worker',action_configured=True)
   assert refreshed['registration_state']=='failed' and refreshed['publication_state']=='failed' and refreshed['last_error']=='extension timed out'
   published=store.mark_registration_publication(pending['id'],success=True,principal='admin@example.test')
   assert published['registration_state']=='active' and published['publication_state']=='published' and published['delivery_state']=='ready'
   missing_count=store.retire_unseen_discoveries('splunk-prod',datetime.now(timezone.utc)+timedelta(seconds=1))
   assert missing_count==1
   missing=store.list_alert_registrations()[0]
   assert missing['registration_state']=='active' and missing['publication_state']=='published'
   assert missing['presence_state']=='missing' and missing['delivery_state']=='blocked'
   action_removed=store.register_definition(definition,deployment='splunk-prod',origin='discovery',action_configured=False)
   assert action_removed['registration_state']=='active' and action_removed['publication_state']=='published'
   assert action_removed['presence_state']=='present' and action_removed['delivery_state']=='action_missing'
   assert c.execute("SELECT action_verified_at FROM sec_alert_registrations WHERE id=%s::uuid",(pending['id'],)).fetchone()[0] is None
   restored=store.register_definition(definition,deployment='splunk-prod',origin='discovery',action_configured=True)
   assert restored['id']==pending['id'] and restored['delivery_state']=='ready'


@pytest.mark.skipif(os.environ.get('SMTP_DATABASE_TEST') != '1', reason='explicit PostgreSQL fixture test')
def test_scope_review_allocates_aid_and_invalidates_on_definition_change():
 load_server_env()
 uri=PostgresBootstrap.from_env().uri
 with psycopg.connect(uri) as c:
  with c.transaction(force_rollback=True):
   schema='alert_review_test_'+uuid.uuid4().hex
   c.execute('CREATE SCHEMA '+schema)
   c.execute('SET LOCAL search_path TO '+schema+',public')
   for p in sorted((Path(__file__).resolve().parents[5] / 'database' / 'migrations').glob('*.sql')):
    c.execute(p.read_text())
   class Store(AlertIngestionStore):
    def _connect(self):
     from contextlib import nullcontext
     return nullcontext(c)
   store=Store.__new__(Store)
   customer=c.execute("INSERT INTO customers(gid,name,status,cid) VALUES('REVIEW-GID','Review fixture','active','REV001') RETURNING id").fetchone()[0]
   c.execute("""INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id,verified_at,verified_by,verification)
               VALUES('splunk-prod','REV_security',%s,NOW(),'fixture','{"verified":true,"deployment":"splunk-prod","index_name":"REV_security"}'::jsonb)""",(customer,))
   definition={"name":"Dynamic review alert","app":"search","owner":"nobody","spl":"index=$customer_index$ | stats count","actions":""}
   review=store.register_definition(definition,deployment='splunk-prod')
   assert review['status']=='needs_review' and review['review_id'] and review['aid'] is None
   registration=store.resolve_registration_review(review['review_id'],customer_id=str(customer),source_indexes=['REV_security'],actor='admin@example.test')
   assert registration['aid']=='REV001-0000'
   assert registration['registration_state']=='active'
   assert registration['delivery_state']=='action_missing'
   assert registration['scope_review_fingerprint']==registration['definition_fingerprint']
   refreshed=store.register_definition(definition,deployment='splunk-prod',origin='discovery')
   assert refreshed['id']==registration['id'] and refreshed['registration_state']=='active'
   changed=store.register_definition({**definition,"spl":"index=$different_index$ | stats count"},deployment='splunk-prod',origin='discovery')
   assert changed['status']=='needs_review'
   blocked=store.list_alert_registrations()[0]
   assert blocked['registration_state']=='needs_review' and blocked['scope_review_fingerprint'] is None

   default_policy=store.save_alert_policy(str(customer),{"detail_columns":["device"]},actor='admin@example.test')
   override=store.save_alert_policy(str(customer),{"detail_columns":["host"]},registration_id=registration['id'],actor='admin@example.test')
   assert override['registration_id']==registration['id']
   removed=store.delete_alert_policy_override(str(customer),registration['id'],actor='admin@example.test')
   assert removed['removed'] is True
   assert removed['inherited_policy']['id']==default_policy['id']


@pytest.mark.skipif(os.environ.get('SMTP_DATABASE_TEST') != '1', reason='explicit PostgreSQL fixture test')
def test_migration_apply_requires_complete_current_preview_once():
 load_server_env()
 uri=PostgresBootstrap.from_env().uri
 with psycopg.connect(uri) as c:
  with c.transaction(force_rollback=True):
   schema='alert_migration_test_'+uuid.uuid4().hex
   c.execute('CREATE SCHEMA '+schema)
   c.execute('SET LOCAL search_path TO '+schema+',public')
   for p in sorted((Path(__file__).resolve().parents[5] / 'database' / 'migrations').glob('*.sql')):
    c.execute(p.read_text())
   class Store(AlertIngestionStore):
    def _connect(self):
     from contextlib import nullcontext
     return nullcontext(c)
   store=Store.__new__(Store)
   preview=store.migration_preview(actor='admin@example.test')
   applied=store.migration_backfill(preview['run_id'],actor='admin@example.test')
   assert applied['source_preview_id']==preview['run_id'] and applied['historical_email_suppressed'] is True
   with pytest.raises(Exception,match='already applied'):
    store.migration_backfill(preview['run_id'],actor='admin@example.test')
   stale=store.migration_preview(actor='admin@example.test')
   c.execute("INSERT INTO customers(gid,name,status,cid) VALUES('NEW-GID','New customer','active','NEW001')")
   with pytest.raises(Exception,match='changed after preview'):
    store.migration_backfill(stale['run_id'],actor='admin@example.test')


@pytest.mark.skipif(os.environ.get('SMTP_DATABASE_TEST') != '1', reason='explicit PostgreSQL fixture test')
def test_concurrent_aid_allocation_exhaustion_and_cid_immutability():
 load_server_env()
 uri=PostgresBootstrap.from_env().uri
 schema='alert_concurrency_test_'+uuid.uuid4().hex
 with psycopg.connect(uri) as setup:
  setup.execute('CREATE SCHEMA '+schema)
  setup.execute('SET search_path TO '+schema+',public')
  for p in sorted((Path(__file__).resolve().parents[5] / 'database' / 'migrations').glob('*.sql')):
   setup.execute(p.read_text())
  customer=setup.execute("INSERT INTO customers(gid,name,status,cid) VALUES('CON-GID','Concurrency fixture','active','CON001') RETURNING id").fetchone()[0]
  setup.execute("""INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id,verified_at,verified_by,verification)
                   VALUES('splunk-prod','CON_security',%s,NOW(),'fixture','{"verified":true,"deployment":"splunk-prod","index_name":"CON_security"}'::jsonb)""",(customer,))
  setup.commit()
 class ConcurrentStore(AlertIngestionStore):
  def __init__(self, connection_uri, search_schema):
   self.uri=connection_uri; self.schema=search_schema; self._pool=None; self._lock_connection=None
  def _connect(self):
   return psycopg.connect(self.uri,options=f'-csearch_path={self.schema},public -cstatement_timeout=15000')
 store=ConcurrentStore(uri,schema)
 try:
  def register(name):
   return store.register_definition({"name":name,"app":"search","owner":"nobody","spl":"index=CON_security","stable_id":"stable-"+name},deployment='splunk-prod')
  with ThreadPoolExecutor(max_workers=2) as pool:
   registrations=list(pool.map(register,['alert-a','alert-b']))
  assert sorted(item['aid'] for item in registrations)==['CON001-0000','CON001-0001']
  with ThreadPoolExecutor(max_workers=2) as pool:
   duplicate=list(pool.map(lambda _: register('alert-c'),range(2)))
  assert duplicate[0]['id']==duplicate[1]['id'] and duplicate[0]['aid']=='CON001-0002'
  renamed=store.register_definition({"name":"alert-c-renamed","app":"search","owner":"nobody","spl":"index=CON_security","stable_id":"stable-alert-c"},deployment='splunk-prod')
  assert renamed['id']==duplicate[0]['id'] and renamed['aid']=='CON001-0002'
  copied=register('alert-c-copy')
  assert copied['id']!=duplicate[0]['id'] and copied['aid']=='CON001-0003'
  with store._connect() as connection:
   connection.execute("UPDATE sec_alert_aid_counters SET next_sequence=9999 WHERE customer_id=%s",(customer,))
  assert register('alert-last')['aid']=='CON001-9999'
  with pytest.raises(Exception,match='exhausted AID capacity'):
   register('alert-overflow')
  with store._connect() as connection:
   with pytest.raises(psycopg.errors.CheckViolation,match='CID cannot change'):
    with connection.transaction():
     connection.execute("UPDATE customers SET cid='CON999' WHERE id=%s",(customer,))
 finally:
  store.close()
  with psycopg.connect(uri,autocommit=True) as cleanup:
   cleanup.execute('DROP SCHEMA '+schema+' CASCADE')
