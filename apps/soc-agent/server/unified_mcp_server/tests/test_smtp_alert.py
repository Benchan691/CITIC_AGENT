import socketserver
import threading
from email import policy
from email.parser import BytesParser

import pytest

from unified_mcp_server.smtp_alert import AlertEmailSender, normalize_routing, routing_matches, merge_recipients, render_html
from unified_mcp_server.alert_email import AlertEmailRule, AlertEmailWorker
from unified_mcp_server.config import ServerSettings
from .test_alert_email import context, FakeStore, FakeSender


class Sink(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b'220 local sink\r\n')
        while line := self.rfile.readline():
            verb = line.split()[0].upper()
            if verb in (b'EHLO', b'HELO', b'MAIL'):
                self.wfile.write(b'250 OK\r\n')
            elif verb == b'RCPT':
                self.wfile.write(b'450 temporary\r\n' if b'reject@' in line else b'250 OK\r\n')
            elif verb == b'DATA':
                self.wfile.write(b'354 go\r\n')
                data = b''
                while (line := self.rfile.readline()) != b'.\r\n':
                    if not line:
                        return
                    data += line
                self.server.messages.append(data)
                self.wfile.write(b'250 accepted\r\n')
            else:
                return


@pytest.mark.asyncio
async def test_local_smtp_sink_acceptance_mime_and_bcc():
    with socketserver.TCPServer(('127.0.0.1', 0), Sink) as server:
        server.messages = []
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            settings = ServerSettings.from_env({'ALERT_SMTP_HOST': '127.0.0.1', 'ALERT_SMTP_PORT': str(server.server_address[1]), 'ALERT_SMTP_TLS': 'none', 'ALERT_EMAIL_FROM': 'sender@example.test'})
            result = await AlertEmailSender(settings).send({'recipients': ['to@example.test','reject@example.test'], 'bcc': ['hidden@example.test']}, 'Subject', 'Text', html=render_html(context()))
            assert result['accepted'] == ['to@example.test','hidden@example.test']
            assert result['rejected'] == {'reject@example.test': 450}
            message = BytesParser(policy=policy.default).parsebytes(server.messages[0])
            assert message['Bcc'] is None
            assert 'hidden@example.test' not in str(message)
            assert message.get_body(preferencelist=('plain',)).get_content().strip() == 'Text'
            assert any(part['Content-ID'] for part in message.walk())
        finally:
            server.shutdown()
            thread.join()


def test_filters_fail_closed_and_customer_isolation():
    route = normalize_routing({'ips': ['10.0.0.0/24','192.0.2.1-192.0.2.9'], 'hostnames': ['web-*']})
    assert not routing_matches(route, context())
    assert routing_matches(route, context(metadata={'src_ip':'10.0.0.2','hostname':'web-1'}))
    assert not routing_matches(route, context(metadata={'src_ip':'10.0.0.2','hostname':'db-1'}))
    rule = AlertEmailRule('1','r','customer-1',None,('high',),True,route)
    assert not rule.matches(context(customer_id='customer-2',metadata={'src_ip':'10.0.0.2','hostname':'web-1'}))
    with pytest.raises(ValueError): normalize_routing({'ips':['192.0.2.9-192.0.2.1']})


@pytest.mark.parametrize('brand',['CPC','CEC'])
@pytest.mark.parametrize('language',['EN','CN','ZH'])
def test_templates_escape_values_and_use_event_reference(brand,language):
    html = render_html(context(alert_name='<script>alert(1)</script>',email_config={'language':language,'brand':brand}))
    assert '<script>alert' not in html
    assert '&lt;script&gt;' in html
    assert 'event-1' in html
    assert '${' not in html


def test_route_recipient_dedup_keeps_bcc_hidden():
    rules = [AlertEmailRule('1','r',None,None,('high',),True),AlertEmailRule('2','r','customer-1',None,('high',),True,{'recipients':{'recipients':['other@example.test'],'bcc':['SOC@example.test']}})]
    assert merge_recipients(rules, context()) == {'recipients':['other@example.test'],'bcc':['SOC@example.test'],'cc':[]}


@pytest.mark.asyncio
async def test_restart_retry_excludes_accepted_recipients():
    snapshot=dict(recipients={'recipients':['soc@example.test','retry@example.test']},subject='s',body='b',html='<p>b</p>',message_id='<same@example.test>')
    store=FakeStore([context(accepted_recipients=['soc@example.test'],delivery_snapshot=snapshot)],[AlertEmailRule('1','r',None,None,('high',),True)])
    sender=FakeSender()
    await AlertEmailWorker(ServerSettings.from_env({}),store,sender)._cycle()
    assert sender.calls[0][0]['recipients']==['retry@example.test']


@pytest.mark.asyncio
async def test_acknowledgement_failure_requires_review():
    class BrokenStore(FakeStore):
        def record_outcome(self,*args): raise OSError('database unavailable')
    store=BrokenStore([context()],[AlertEmailRule('1','r',None,None,('high',),True)])
    report=await AlertEmailWorker(ServerSettings.from_env({}),store,FakeSender())._cycle()
    assert report.uncertain==1
    assert store.actions[0][0]=='uncertain'
