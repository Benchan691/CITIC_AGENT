-- Sanitized structural fixtures based on bounded recent telemetry metadata.
-- Values are synthetic and contain no production identifiers or credentials.

INSERT INTO source_types (
    name,
    category,
    vendor,
    product,
    description,
    field_mapping,
    status
)
VALUES
    (
        'Windows Event Log (Fixture)',
        'endpoint',
        'Microsoft',
        'Windows',
        'Synthetic Windows event fixture using common normalized security fields.',
        '{"username":"Account_Name","hostname":"ComputerName","src_ip":"src","dest_ip":"dest","event_id":"event_id","title":"name","description":"event_description","severity":"severity","status":"status"}'::JSONB,
        'active'
    ),
    (
        'System Process (Fixture)',
        'endpoint',
        NULL,
        'Operating System Process',
        'Synthetic process telemetry fixture using generic endpoint fields.',
        '{"username":"user","hostname":"host","title":"name","src_ip":"src","dest_ip":"dest"}'::JSONB,
        'active'
    )
ON CONFLICT (name) DO NOTHING;

INSERT INTO customers (
    gid,
    name,
    short_name,
    status,
    source_type,
    field_mapping,
    email_config,
    splunk_indexes
)
SELECT
    fixture.gid,
    fixture.name,
    fixture.short_name,
    'active',
    source_type.id,
    fixture.field_mapping,
    '{}'::JSONB,
    fixture.splunk_indexes
FROM (
    VALUES
        (
            'TEST-G0001'::VARCHAR,
            'Test Endpoint Customer'::TEXT,
            'Test Endpoint'::TEXT,
            'Windows Event Log (Fixture)'::VARCHAR,
            '{"username":"Account_Name","hostname":"ComputerName","src_ip":"src","dest_ip":"dest"}'::JSONB,
            ARRAY['test_windows_events']::TEXT[]
        ),
        (
            'TEST-G0002'::VARCHAR,
            'Test Operations Customer'::TEXT,
            'Test Operations'::TEXT,
            'System Process (Fixture)'::VARCHAR,
            '{"username":"user","hostname":"host","title":"name"}'::JSONB,
            ARRAY['test_process_events']::TEXT[]
        )
) AS fixture(gid, name, short_name, source_type_name, field_mapping, splunk_indexes)
JOIN source_types AS source_type
    ON source_type.name = fixture.source_type_name
ON CONFLICT (gid) DO NOTHING;

INSERT INTO staff (
    staff_id,
    name,
    username,
    email,
    role,
    status,
    customer_access_uuid
)
SELECT
    'TEST-S0001',
    'Fixture Analyst',
    'fixture_analyst',
    'fixture.analyst@example.local',
    'analyst',
    'active',
    ARRAY[customer.id]::UUID[]
FROM customers AS customer
WHERE customer.gid = 'TEST-G0001'
ON CONFLICT (staff_id) DO NOTHING;

UPDATE customers AS customer
SET related_staff = staff.id
FROM staff
WHERE customer.gid = 'TEST-G0001'
  AND staff.staff_id = 'TEST-S0001'
  AND customer.related_staff IS NULL;

INSERT INTO rule_templates (
    template_code,
    template_name,
    category,
    source_type_ids,
    source_alerts,
    spl_template,
    parameters,
    common_logic_summary,
    variation_summary
)
SELECT
    fixture.template_code,
    fixture.template_name,
    fixture.category,
    ARRAY[source_type.id]::UUID[],
    fixture.source_alerts,
    fixture.spl_template,
    fixture.parameters,
    fixture.common_logic_summary,
    fixture.variation_summary
FROM (
    VALUES
        (
            'TPL-TEST-WINDOWS-AUTH'::VARCHAR,
            'Synthetic Windows Authentication Activity'::TEXT,
            'endpoint'::VARCHAR,
            'Windows Event Log (Fixture)'::VARCHAR,
            ARRAY['authentication_failure','account_activity']::TEXT[],
            'index=$index$ sourcetype=WinEventLog EventCode=$event_code$'::TEXT,
            '{"threshold":5,"time_window":"15m","fields":{"username":"Account_Name","hostname":"ComputerName","event_id":"EventCode"}}'::JSONB,
            'Counts synthetic authentication activity using normalized endpoint fields.'::TEXT,
            'Customers can override the event code and threshold.'::TEXT
        ),
        (
            'TPL-TEST-ENDPOINT-ACTION'::VARCHAR,
            'Synthetic Endpoint Action Activity'::TEXT,
            'endpoint'::VARCHAR,
            'System Process (Fixture)'::VARCHAR,
            ARRAY['process_activity','endpoint_action']::TEXT[],
            'index=$index$ sourcetype=process action=$action$'::TEXT,
            '{"threshold":1,"time_window":"10m","fields":{"username":"user","hostname":"host","action":"action","application":"app"}}'::JSONB,
            'Normalizes synthetic process activity into the common event shape.'::TEXT,
            'Customers can override action values and time windows.'::TEXT
        )
) AS fixture(
    template_code,
    template_name,
    category,
    source_type_name,
    source_alerts,
    spl_template,
    parameters,
    common_logic_summary,
    variation_summary
)
JOIN source_types AS source_type
    ON source_type.name = fixture.source_type_name
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO rulesets (rule_template_id, customer_id, source_type_ids)
SELECT
    rule_template.id,
    customer.id,
    ARRAY[source_type.id]::UUID[]
FROM rule_templates AS rule_template
JOIN customers AS customer
    ON customer.gid = 'TEST-G0001'
JOIN source_types AS source_type
    ON source_type.name = 'Windows Event Log (Fixture)'
WHERE rule_template.template_code = 'TPL-TEST-WINDOWS-AUTH'
  AND NOT EXISTS (
      SELECT 1
      FROM rulesets AS existing
      WHERE existing.customer_id = customer.id
        AND existing.rule_template_id = rule_template.id
  );

INSERT INTO rulesets (rule_template_id, customer_id, source_type_ids)
SELECT
    rule_template.id,
    customer.id,
    ARRAY[source_type.id]::UUID[]
FROM rule_templates AS rule_template
JOIN customers AS customer
    ON customer.gid = 'TEST-G0002'
JOIN source_types AS source_type
    ON source_type.name = 'System Process (Fixture)'
WHERE rule_template.template_code = 'TPL-TEST-ENDPOINT-ACTION'
  AND NOT EXISTS (
      SELECT 1
      FROM rulesets AS existing
      WHERE existing.customer_id = customer.id
        AND existing.rule_template_id = rule_template.id
  );

INSERT INTO sec_events (
    customer_id,
    ruleset_id,
    source_type_ids,
    event_id,
    title,
    description,
    severity,
    status,
    event_time,
    src_ip,
    dest_ip,
    username,
    hostname,
    splunk_index,
    custom_fields
)
SELECT
    customer.id,
    ruleset.id,
    ARRAY[source_type.id]::UUID[],
    'TEST-EVT-0001',
    'Synthetic authentication activity',
    'Synthetic repeated authentication activity for integration testing.',
    'medium',
    'new',
    now() - INTERVAL '1 hour',
    '192.0.2.10',
    '198.51.100.20',
    'test.user',
    'test-endpoint-01',
    'test_windows_events',
    '{"action":"failure","application":"test-auth-service","event_code":"4625","source_field":"Account_Name"}'::JSONB
FROM customers AS customer
JOIN rulesets AS ruleset
    ON ruleset.customer_id = customer.id
JOIN rule_templates AS rule_template
    ON rule_template.id = ruleset.rule_template_id
JOIN source_types AS source_type
    ON source_type.name = 'Windows Event Log (Fixture)'
WHERE customer.gid = 'TEST-G0001'
  AND rule_template.template_code = 'TPL-TEST-WINDOWS-AUTH'
  AND NOT EXISTS (
      SELECT 1
      FROM sec_events AS existing
      WHERE existing.customer_id = customer.id
        AND existing.event_id = 'TEST-EVT-0001'
        AND existing.title = 'Synthetic authentication activity'
  );

INSERT INTO sec_events (
    customer_id,
    ruleset_id,
    source_type_ids,
    event_id,
    title,
    description,
    severity,
    status,
    event_time,
    username,
    hostname,
    splunk_index,
    custom_fields
)
SELECT
    customer.id,
    ruleset.id,
    ARRAY[source_type.id]::UUID[],
    'TEST-EVT-0002',
    'Synthetic endpoint process activity',
    'Synthetic endpoint process activity for integration testing.',
    'info',
    'resolved',
    now() - INTERVAL '1 day',
    'test.operator',
    'test-endpoint-02',
    'test_process_events',
    '{"action":"process_start","application":"test-agent","source_field":"name"}'::JSONB
FROM customers AS customer
JOIN rulesets AS ruleset
    ON ruleset.customer_id = customer.id
JOIN rule_templates AS rule_template
    ON rule_template.id = ruleset.rule_template_id
JOIN source_types AS source_type
    ON source_type.name = 'System Process (Fixture)'
WHERE customer.gid = 'TEST-G0002'
  AND rule_template.template_code = 'TPL-TEST-ENDPOINT-ACTION'
  AND NOT EXISTS (
      SELECT 1
      FROM sec_events AS existing
      WHERE existing.customer_id = customer.id
        AND existing.event_id = 'TEST-EVT-0002'
        AND existing.title = 'Synthetic endpoint process activity'
  );
