from pathlib import Path
import uuid
import psycopg
from unified_mcp_server.env_loader import load_server_env
from unified_mcp_server.postgres_store import PostgresBootstrap
from unified_mcp_server.alert_email import AlertEmailStore
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
