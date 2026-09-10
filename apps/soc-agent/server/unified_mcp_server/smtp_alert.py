"""SMTP transport and deterministic, customer-scoped notification routing."""
import asyncio
import fnmatch
import ipaddress
import re
import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import formatdate
from html import escape
from pathlib import Path
from string import Template


def normalize_routing(value):
    from .alert_email import normalize_email_config
    if not isinstance(value, dict) or set(value) - {'source_type_ids', 'ips', 'hostnames', 'recipients'}:
        raise ValueError('invalid routing fields')
    result = {}
    for key in ('source_type_ids', 'ips', 'hostnames'):
        items = value.get(key, [])
        if not isinstance(items, list) or len(items) > 100 or any(not isinstance(x, str) or not x or len(x) > 255 for x in items):
            raise ValueError('invalid ' + key)
        result[key] = list(dict.fromkeys(items))
    for item in result['source_type_ids']:
        uuid.UUID(item)
    for item in result['ips']:
        if '-' in item:
            first, last = map(ipaddress.ip_address, item.split('-', 1))
            if first.version != last.version or first > last:
                raise ValueError('invalid IP range')
        else:
            ipaddress.ip_network(item, strict=False)
    if 'recipients' in value:
        result['recipients'] = normalize_email_config(value['recipients'])
    return result


def routing_matches(route, context):
    data = context.metadata
    if data.get('customer_active') is False:
        return False
    if route.get('source_type_ids') and not set(route['source_type_ids']).intersection(data.get('source_type_ids') or []):
        return False
    if route.get('hostnames') and not any(fnmatch.fnmatchcase(str(data.get('hostname') or '').casefold(), p.casefold()) for p in route['hostnames'] if data.get('hostname')):
        return False
    if route.get('ips'):
        def matches(value, pattern):
            try:
                address = ipaddress.ip_address(value)
                if '-' in pattern:
                    lo, hi = map(ipaddress.ip_address, pattern.split('-', 1))
                    return lo <= address <= hi
                return address in ipaddress.ip_network(pattern, strict=False)
            except (ValueError, TypeError):
                return False
        if not any(matches(data.get(key), pattern) for key in ('src_ip', 'dest_ip') for pattern in route['ips']):
            return False
    return True


def merge_recipients(rules, context):
    from .alert_email import normalize_email_config
    # Provisioned customers may intentionally have no recipients yet; the
    # worker treats the resulting empty merged route as a disabled delivery.
    configs = [normalize_email_config(r.routing.get('recipients', context.email_config), require_recipient=False) for r in rules]
    result, seen = {}, set()
    # BCC wins if two routes disagree about visibility.
    for key in ('bcc', 'recipients', 'cc'):
        result[key] = []
        for config in configs:
            for address in config[key]:
                if address.casefold() not in seen:
                    result[key].append(address)
                    seen.add(address.casefold())
    if len(seen) > 50:
        raise ValueError('combined routes exceed 50 recipients')
    return result


def render_html(context):
    from .alert_email import normalize_email_config
    from .alert_identity import DEFAULT_DISPLAY_ROWS
    config = normalize_email_config(context.email_config, require_recipient=False)
    language, brand = config.get('language', 'EN'), config.get('brand', 'CPC')
    path = Path(__file__).with_name('email_templates') / f'{brand}_{language}.html'
    content = context.metadata.get('content') or {}
    localized = content.get(language, {}) if isinstance(content, dict) else {}
    event_identifier = getattr(context, 'eid', None) or context.event_id
    values = dict(ticketnumber=event_identifier, rulename=context.alert_name or '', casetime=context.trigger_time or '',
                  severity=context.severity or '', srcip_port=context.metadata.get('src_ip') or '',
                  destip_port=context.metadata.get('dest_ip') or '',
                  ruledescrption=localized.get('description', context.metadata.get('description') or ''),
                  ruleremediation=localized.get('remediation', ''))
    values = {k: escape(str(v)[:2000]) for k, v in values.items()}
    metadata = {'Customer': context.customer_name, 'Customer CID': getattr(context, 'cid', None),
                'Customer GID': context.customer_gid, 'Alert AID': getattr(context, 'aid', None),
                'Alert EID': event_identifier, 'Rule number': context.rule_number, 'Event ID': event_identifier,
                'Splunk SID': context.splunk_sid, 'Result count': context.result_count,
                'Detail rows total': context.metadata.get('detail_total'),
                'Detail rows retained': context.metadata.get('detail_stored'),
                'Detail rows displayed': context.metadata.get('detail_displayed'),
                'Source types': ', '.join(context.metadata.get('source_types') or [])}
    values['event_data'] = ''.join('<p>' + escape(key) + ': ' + escape(str(value if value is not None else '')[:2000]) + '</p>' for key,value in metadata.items())
    if getattr(context, 'detail_rows', None):
        columns = getattr(context, 'detail_columns', [])
        labels = getattr(context, 'detail_labels', {})
        policy = context.metadata.get('email_policy')
        try:
            display_limit = max(1, min(int(policy.get('max_display_rows', DEFAULT_DISPLAY_ROWS)), 1_000)) if isinstance(policy, dict) else DEFAULT_DISPLAY_ROWS
        except (TypeError, ValueError):
            display_limit = DEFAULT_DISPLAY_ROWS
        positions = getattr(context, 'detail_positions', None) or list(range(len(context.detail_rows)))
        values['event_data'] += ''.join(
            '<p>Row ' + str(position + 1) + ': ' + escape('; '.join(
                f'{labels.get(column, column)}={row.get(column, "")}' for column in columns
            )[:4000]) + '</p>'
            for position, row in zip(positions[:display_limit], context.detail_rows[:display_limit], strict=False)
        )
    if context.metadata.get('detail_truncated'):
        values['event_data'] += '<p>Additional matching result rows were omitted by the approved limits.</p>'
    return Template(path.read_text()).safe_substitute(values)


class AlertEmailSender:
    def __init__(self, settings):
        self.settings = settings

    async def send(self, recipients, subject, body, *, html=None, message_id=None):
        return await asyncio.to_thread(self._send, recipients, subject, body, html, message_id)

    def _send(self, recipients, subject, body, html, message_id):
        from .alert_email import AlertEmailDeliveryError, _email
        s = self.settings
        message = EmailMessage()
        message['From'] = _email(s.alert_email_from)
        message['To'] = ', '.join(recipients.get('recipients', []))
        if recipients.get('cc'):
            message['Cc'] = ', '.join(recipients['cc'])
        message['Date'] = formatdate(localtime=False)
        message['Subject'] = subject
        message['Message-ID'] = message_id or f'<{uuid.uuid4()}@soc-alert.local>'
        message.set_content(body)
        if html:
            message.add_alternative(html, subtype='html')
            for cid in set(re.findall(r'cid:([^\s"<>]+)', html)):
                asset = Path(__file__).with_name('email_templates') / 'img' / Path(cid).name
                if asset.is_file():
                    message.get_payload()[-1].add_related(asset.read_bytes(), maintype='image', subtype='jpeg' if asset.suffix.lower() in ('.jpg', '.jpeg') else 'png', cid=f'<{cid}>')
        addresses = list(dict.fromkeys(a for key in ('recipients', 'cc', 'bcc') for a in recipients.get(key, [])))
        client, in_data = None, False
        try:
            cls = smtplib.SMTP_SSL if s.alert_smtp_tls == 'ssl' else smtplib.SMTP
            kwargs = {'context': ssl.create_default_context()} if s.alert_smtp_tls == 'ssl' else {}
            client = cls(s.alert_smtp_host, s.alert_smtp_port, timeout=20, **kwargs)
            client.ehlo()
            if s.alert_smtp_tls == 'starttls':
                client.starttls(context=ssl.create_default_context())
                client.ehlo()
            if s.alert_email_username:
                client.login(s.alert_email_username, s.alert_email_password)
            code, detail = client.mail(s.alert_email_from)
            if code != 250:
                raise smtplib.SMTPResponseException(code, detail)
            accepted, rejected = [], {}
            for address in addresses:
                code, detail = client.rcpt(address)
                if code in (250, 251):
                    accepted.append(address)
                else:
                    rejected[address] = code
            if accepted:
                in_data = True
                code, detail = client.data(message.as_bytes())
                in_data = False
                if code != 250:
                    raise smtplib.SMTPDataError(code, detail)
            return {'accepted': accepted, 'rejected': rejected, 'message_id': str(message['Message-ID'])}
        except smtplib.SMTPResponseException as exc:
            raise AlertEmailDeliveryError('retryable' if 400 <= exc.smtp_code < 500 else 'permanent', f'SMTP response {exc.smtp_code}') from exc
        except (OSError, smtplib.SMTPException) as exc:
            raise AlertEmailDeliveryError('uncertain' if in_data else 'retryable', type(exc).__name__) from exc
        finally:
            if client:
                client.close()
