CREATE TABLE IF NOT EXISTS rule_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR UNIQUE NOT NULL,
    template_name TEXT NOT NULL,
    category VARCHAR,
    source_type_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    source_alerts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    spl_template TEXT,
    parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
    common_logic_summary TEXT,
    variation_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_templates_category_idx
    ON rule_templates (category);

CREATE INDEX IF NOT EXISTS rule_templates_source_type_ids_gin_idx
    ON rule_templates USING GIN (source_type_ids);

CREATE INDEX IF NOT EXISTS rule_templates_source_alerts_gin_idx
    ON rule_templates USING GIN (source_alerts);

CREATE INDEX IF NOT EXISTS rule_templates_parameters_gin_idx
    ON rule_templates USING GIN (parameters);

CREATE OR REPLACE FUNCTION validate_rule_template_source_type_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM unnest(NEW.source_type_ids) AS requested(source_type_id)
        LEFT JOIN source_types AS source_type
            ON source_type.id = requested.source_type_id
        WHERE source_type.id IS NULL
    ) THEN
        RAISE EXCEPTION 'rule template source_type_ids contains an unknown source type id'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rule_templates_source_type_ids_validation ON rule_templates;

CREATE TRIGGER rule_templates_source_type_ids_validation
BEFORE INSERT OR UPDATE OF source_type_ids ON rule_templates
FOR EACH ROW
EXECUTE FUNCTION validate_rule_template_source_type_ids();
