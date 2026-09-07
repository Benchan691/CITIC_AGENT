CREATE TABLE IF NOT EXISTS source_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE customers
    ADD COLUMN gid VARCHAR NOT NULL,
    ADD COLUMN name TEXT NOT NULL,
    ADD COLUMN short_name TEXT,
    ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active',
    ADD COLUMN source_type UUID,
    ADD COLUMN related_staff UUID,
    ADD COLUMN field_mapping JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN email_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN splunk_indexes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(),
    ADD CONSTRAINT customers_gid_key UNIQUE (gid),
    ADD CONSTRAINT customers_status_check
        CHECK (status IN ('active', 'inactive')),
    ADD CONSTRAINT customers_source_type_fkey
        FOREIGN KEY (source_type)
        REFERENCES source_types (id)
        ON DELETE SET NULL,
    ADD CONSTRAINT customers_related_staff_fkey
        FOREIGN KEY (related_staff)
        REFERENCES staff (id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_status_idx
    ON customers (status);

CREATE INDEX IF NOT EXISTS customers_source_type_idx
    ON customers (source_type);

CREATE INDEX IF NOT EXISTS customers_related_staff_idx
    ON customers (related_staff);
