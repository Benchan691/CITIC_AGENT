ALTER TABLE rulesets
    ADD COLUMN rule_template_id UUID,
    ADD COLUMN customer_id UUID,
    ADD COLUMN source_type_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    ADD CONSTRAINT rulesets_rule_template_id_fkey
        FOREIGN KEY (rule_template_id)
        REFERENCES rule_templates (id)
        ON DELETE SET NULL,
    ADD CONSTRAINT rulesets_customer_id_fkey
        FOREIGN KEY (customer_id)
        REFERENCES customers (id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rulesets_rule_template_id_idx
    ON rulesets (rule_template_id);

CREATE INDEX IF NOT EXISTS rulesets_customer_id_idx
    ON rulesets (customer_id);

CREATE INDEX IF NOT EXISTS rulesets_source_type_ids_gin_idx
    ON rulesets USING GIN (source_type_ids);

CREATE OR REPLACE FUNCTION validate_ruleset_source_type_ids()
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
        RAISE EXCEPTION 'ruleset source_type_ids contains an unknown source type id'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rulesets_source_type_ids_validation ON rulesets;

CREATE TRIGGER rulesets_source_type_ids_validation
BEFORE INSERT OR UPDATE OF source_type_ids ON rulesets
FOR EACH ROW
EXECUTE FUNCTION validate_ruleset_source_type_ids();
