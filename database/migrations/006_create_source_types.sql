ALTER TABLE source_types
    ADD COLUMN name VARCHAR NOT NULL,
    ADD COLUMN category VARCHAR,
    ADD COLUMN vendor VARCHAR,
    ADD COLUMN product VARCHAR,
    ADD COLUMN description TEXT,
    ADD COLUMN field_mapping JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active',
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(),
    ADD CONSTRAINT source_types_name_key UNIQUE (name),
    ADD CONSTRAINT source_types_status_check
        CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS source_types_category_idx
    ON source_types (category);

CREATE INDEX IF NOT EXISTS source_types_vendor_idx
    ON source_types (vendor);

CREATE INDEX IF NOT EXISTS source_types_product_idx
    ON source_types (product);

CREATE INDEX IF NOT EXISTS source_types_status_idx
    ON source_types (status);

CREATE INDEX IF NOT EXISTS source_types_field_mapping_gin_idx
    ON source_types USING GIN (field_mapping);
