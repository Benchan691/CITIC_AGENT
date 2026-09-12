DO $$
DECLARE
    marker TEXT;
BEGIN
    INSERT INTO soc_bootstrap (key)
    VALUES ('catalog-feature-removed-v1')
    ON CONFLICT (key) DO NOTHING
    RETURNING key INTO marker;

    IF marker IS NOT NULL THEN
        DROP TABLE IF EXISTS soc_catalog_staging;
        DROP TABLE IF EXISTS soc_catalog_import_batches;
        DROP TABLE IF EXISTS soc_catalog_publications;
        DROP TABLE IF EXISTS soc_catalog_history;
        DROP TABLE IF EXISTS soc_fix_source_type;
        DROP TABLE IF EXISTS soc_rule_catalog;
        DROP TABLE IF EXISTS soc_customer;
        DROP TABLE IF EXISTS soc_catalog_migrations;
    END IF;
END $$;
