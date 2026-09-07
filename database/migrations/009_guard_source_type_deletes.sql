CREATE OR REPLACE FUNCTION prevent_referenced_source_type_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM rule_templates
        WHERE OLD.id = ANY(source_type_ids)
    )
    OR EXISTS (
        SELECT 1
        FROM rulesets
        WHERE OLD.id = ANY(source_type_ids)
    )
    OR EXISTS (
        SELECT 1
        FROM sec_events
        WHERE OLD.id = ANY(source_type_ids)
    ) THEN
        RAISE EXCEPTION 'source type % is still referenced by a UUID array', OLD.id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS source_types_array_reference_delete_guard ON source_types;

CREATE TRIGGER source_types_array_reference_delete_guard
BEFORE DELETE ON source_types
FOR EACH ROW
EXECUTE FUNCTION prevent_referenced_source_type_delete();
