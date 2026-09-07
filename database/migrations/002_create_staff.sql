CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id VARCHAR UNIQUE NOT NULL,
    name TEXT NOT NULL,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    role VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'active',
    customer_access_uuid UUID[] NOT NULL DEFAULT '{}'::UUID[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT staff_role_check
        CHECK (role IN ('admin', 'analyst', 'viewer')),
    CONSTRAINT staff_status_check
        CHECK (status IN ('active', 'inactive'))
);

CREATE OR REPLACE FUNCTION validate_staff_customer_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM unnest(NEW.customer_access_uuid) AS requested(customer_id)
        LEFT JOIN customers AS customer ON customer.id = requested.customer_id
        WHERE customer.id IS NULL
    ) THEN
        RAISE EXCEPTION 'customer_access_uuid contains an unknown customer id'
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_referenced_customer_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM staff
        WHERE OLD.id = ANY(customer_access_uuid)
    ) THEN
        RAISE EXCEPTION 'customer % is still referenced by staff access', OLD.id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS staff_customer_access_validation ON staff;

CREATE TRIGGER staff_customer_access_validation
BEFORE INSERT OR UPDATE OF customer_access_uuid ON staff
FOR EACH ROW
EXECUTE FUNCTION validate_staff_customer_access();

DROP TRIGGER IF EXISTS customers_staff_access_delete_guard ON customers;

CREATE TRIGGER customers_staff_access_delete_guard
BEFORE DELETE ON customers
FOR EACH ROW
EXECUTE FUNCTION prevent_referenced_customer_delete();
