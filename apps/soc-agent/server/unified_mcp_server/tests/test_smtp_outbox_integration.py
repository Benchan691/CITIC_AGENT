from pathlib import Path
import uuid
import psycopg
from unified_mcp_server.env_loader import load_server_env
from unified_mcp_server.postgres_store import PostgresBootstrap
from unified_mcp_server.alert_email import AlertEmailStore
from unified_mcp_server.alert_ingest import AlertIngestionStore
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
   event=c.execute("INSERT INTO sec_events(customer_id,severity,splunk_sid) VALUES(%s,'high','fixture-sid') RETURNING id",(customer,)).fetchone()[0]
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
   customer=c.execute("""INSERT INTO customers(gid,name,status,cid,email_config,splunk_indexes)
                       VALUES('CPC-GID','CPC fixture','active','CPC001',%s::jsonb,ARRAY['CPC_security'])
                       RETURNING id""", ('{"recipients":["a@example.test"]}',)).fetchone()[0]
   c.execute("INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id) VALUES('splunk-prod','CPC_security',%s)", (customer,))
   definition={"name":"CPC suspicious login","app":"search","owner":"nobody","spl":"index=CPC_security","stable_id":"stable-alert-1"}
   registration=store.register_definition(definition,deployment='splunk-prod',origin='human',actor='admin@example.test',action_configured=True)
   assert registration['aid']=='CPC001-0000'
   payload={"version":1,"deployment":"splunk-prod","registration_id":registration['id'],"stable_id":"stable-alert-1",
            "sid":"scheduler-sid-1","alert_name":"CPC suspicious login","app":"search","owner":"nobody",
            "trigger_time":"2026-09-09T08:15:30.123456Z","result_count":2,"severity":"high",
            "definition":definition,"selected_columns":["device","severity"],
            "rows":[{"device":"host-1","severity":"high"},{"device":"host-2","severity":"high"}]}
   stored=store.receive_alert_run(payload)
   duplicate=store.receive_alert_run(payload)
   assert stored['status']=='stored'
   assert stored['eid']=='CPC001-0000-20260909T081530123456Z-000001'
   assert duplicate == {"status":"duplicate","duplicate":True,"cid":"CPC001","aid":"CPC001-0000","eid":stored['eid'],"event_id":stored['event_id']}
   assert c.execute("SELECT COUNT(*) FROM sec_events WHERE eid=%s", (stored['eid'],)).fetchone()[0]==1
   assert c.execute("SELECT COUNT(*) FROM sec_event_details WHERE event_id=%s::uuid", (stored['event_id'],)).fetchone()[0]==2
   assert c.execute("SELECT COUNT(*) FROM sec_event_email_outbox WHERE eid=%s", (stored['eid'],)).fetchone()[0]==1
   assert c.execute("SELECT COUNT(*) FROM sec_alert_run_receipts WHERE registration_id=%s::uuid AND splunk_sid='scheduler-sid-1'", (registration['id'],)).fetchone()[0]==1


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
   c.execute("INSERT INTO sec_alert_index_ownership(splunk_deployment,index_name,customer_id) VALUES('splunk-prod','PUB_security',%s)", (customer,))
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
