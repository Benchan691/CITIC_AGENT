CREATE TABLE IF NOT EXISTS sec_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    ruleset_id UUID,
    source_type_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
    event_id VARCHAR,
    title TEXT,
    description TEXT,
    severity VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'new',
    event_time TIMESTAMPTZ,
    src_ip VARCHAR,
    dest_ip VARCHAR,
    username VARCHAR,
    hostname VARCHAR,
    splunk_index VARCHAR,
    custom_fields JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT sec_events_customer_id_fkey
        FOREIGN KEY (customer_id)
        REFERENCES customers (id)
        ON DELETE CASCADE,
    CONSTRAINT sec_events_ruleset_id_fkey
        FOREIGN KEY (ruleset_id)
        REFERENCES rulesets (id)
        ON DELETE SET NULL,
    CONSTRAINT sec_events_severity_check
        CHECK (
            severity IS NULL
            OR severity IN ('info', 'low', 'medium', 'high', 'critical')
        ),
    CONSTRAINT sec_events_status_check
        CHECK (status IN ('new', 'investigating', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS sec_events_customer_id_idx
    ON sec_events (customer_id);

CREATE INDEX IF NOT EXISTS sec_events_ruleset_id_idx
    ON sec_events (ruleset_id);

CREATE INDEX IF NOT EXISTS sec_events_event_time_idx
    ON sec_events (event_time);

CREATE INDEX IF NOT EXISTS sec_events_severity_idx
    ON sec_events (severity);

CREATE INDEX IF NOT EXISTS sec_events_status_idx
    ON sec_events (status);

CREATE INDEX IF NOT EXISTS sec_events_src_ip_idx
    ON sec_events (src_ip);

CREATE INDEX IF NOT EXISTS sec_events_username_idx
    ON sec_events (username);

CREATE INDEX IF NOT EXISTS sec_events_splunk_index_idx
    ON sec_events (splunk_index);

CREATE INDEX IF NOT EXISTS sec_events_source_type_ids_gin_idx
    ON sec_events USING GIN (source_type_ids);

CREATE INDEX IF NOT EXISTS sec_events_custom_fields_gin_idx
    ON sec_events USING GIN (custom_fields);

CREATE OR REPLACE FUNCTION validate_sec_event_source_type_ids()
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
        RAISE EXCEPTION 'source_type_ids contains an unknown source type id'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_events_source_type_ids_validation ON sec_events;

CREATE TRIGGER sec_events_source_type_ids_validation
BEFORE INSERT OR UPDATE OF source_type_ids ON sec_events
FOR EACH ROW
EXECUTE FUNCTION validate_sec_event_source_type_ids();
