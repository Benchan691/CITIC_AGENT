INSERT INTO rule_templates (
    template_code,
    template_name,
    category,
    source_alerts,
    parameters,
    common_logic_summary,
    variation_summary
)
VALUES (
    'TPL-EXAMPLE',
    'Generic Security Alert',
    'generic',
    ARRAY['saved_alert']::TEXT[],
    '{"threshold": 1}'::JSONB,
    'Example reusable security-alert template.',
    'Use customer-specific source mappings and thresholds when instantiated.'
)
ON CONFLICT (template_code) DO NOTHING;
