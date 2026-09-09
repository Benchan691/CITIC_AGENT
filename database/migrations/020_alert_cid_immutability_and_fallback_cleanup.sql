-- Close the remaining CID migration/authority gaps after 014-019.
--
-- ``legacy-*`` values were useful as an internal migration marker, but they
-- are not administrator-approved public CIDs.  Keep allocated registrations
-- intact for historical compatibility and leave every unallocated fallback
-- unresolved until an administrator supplies a customer_code.

DO $$
BEGIN
    -- ``soc_customer`` is a compatibility projection and is not present in
    -- every supported installation.  Do not make the additive migration
    -- fail just because that optional table has not been created yet.
    IF to_regclass('soc_customer') IS NOT NULL THEN
        EXECUTE $sql$
            UPDATE customers AS customer
            SET cid = NULL
            WHERE customer.cid LIKE 'legacy-%'
              AND NOT EXISTS (
                  SELECT 1
                  FROM sec_alert_registrations AS registration
                  WHERE registration.customer_id = customer.id
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM soc_customer AS catalog
                  WHERE catalog.legacy_customer_id = customer.id
                    AND NULLIF(btrim(catalog.customer_code), '') = customer.cid
              )
        $sql$;
    ELSE
        UPDATE customers AS customer
        SET cid = NULL
        WHERE customer.cid LIKE 'legacy-%'
          AND NOT EXISTS (
              SELECT 1
              FROM sec_alert_registrations AS registration
              WHERE registration.customer_id = customer.id
          );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_allocated_catalog_customer_code_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.customer_code IS DISTINCT FROM OLD.customer_code
       AND OLD.legacy_customer_id IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM sec_alert_registrations AS registration
           WHERE registration.customer_id = OLD.legacy_customer_id
       ) THEN
        RAISE EXCEPTION 'customer CID cannot change after an alert AID is allocated'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('soc_customer') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS soc_customer_code_immutable_after_aid ON soc_customer';
        EXECUTE 'CREATE TRIGGER soc_customer_code_immutable_after_aid
                 BEFORE UPDATE OF customer_code ON soc_customer
                 FOR EACH ROW
                 EXECUTE FUNCTION prevent_allocated_catalog_customer_code_change()';
        EXECUTE 'COMMENT ON TRIGGER soc_customer_code_immutable_after_aid ON soc_customer IS
                 ''A catalog customer_code/CID cannot change after PostgreSQL allocates an AID.''';
    END IF;
END;
$$;
