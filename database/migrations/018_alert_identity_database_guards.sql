-- Final database guards for the CID -> AID -> EID contract.
--
-- This migration is additive and intentionally follows 014-017.  It removes
-- only unallocated, unsupported CID fallbacks and prevents direct database
-- writes from bypassing the registration/deployment identity checks that the
-- application performs at the authenticated webhook boundary.

-- ``unknown`` is the explicit administrator-policy fallback for a run whose
-- source severity is absent or unmapped.  Older schemas only allowed the
-- operational severity values, which made the safe fallback impossible to
-- persist.
ALTER TABLE sec_events
    DROP CONSTRAINT IF EXISTS sec_events_severity_check;
ALTER TABLE sec_events
    ADD CONSTRAINT sec_events_severity_check
    CHECK (severity IS NULL OR severity IN ('unknown', 'info', 'low', 'medium', 'high', 'critical'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.soc_customer') IS NULL THEN
        -- Without a catalog customer_code there is no evidence that a copied
        -- legacy GID is a valid public CID.  Allocated registrations are
        -- preserved; unresolved customers remain NULL for administrator
        -- reconciliation.
        UPDATE customers AS customer
        SET cid = NULL
        WHERE COALESCE(customer.cid, '') <> ''
          AND COALESCE(customer.gid, '') <> ''
          AND customer.cid = customer.gid
          AND NOT EXISTS (
              SELECT 1
              FROM sec_alert_registrations AS registration
              WHERE registration.customer_id = customer.id
          );
    ELSE
        EXECUTE $sql$
            UPDATE customers AS customer
            SET cid = NULL
            WHERE COALESCE(customer.cid, '') <> ''
              AND COALESCE(customer.gid, '') <> ''
              AND customer.cid = customer.gid
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
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION validate_registered_event_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_customer UUID;
    expected_cid TEXT;
    expected_aid TEXT;
BEGIN
    IF COALESCE(NEW.eid, '') = '' THEN
        RETURN NEW;
    END IF;

    IF NEW.alert_registration_id IS NULL OR NEW.trigger_time IS NULL THEN
        RAISE EXCEPTION 'registered event requires alert_registration_id and trigger_time'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT registration.customer_id, customer.cid, registration.aid
    INTO expected_customer, expected_cid, expected_aid
    FROM sec_alert_registrations AS registration
    JOIN customers AS customer ON customer.id = registration.customer_id
    WHERE registration.id = NEW.alert_registration_id;

    IF NOT FOUND OR expected_cid IS NULL OR expected_aid IS NULL THEN
        RAISE EXCEPTION 'registered event references an invalid alert registration'
            USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF expected_customer <> NEW.customer_id THEN
        RAISE EXCEPTION 'registered event customer does not match its alert registration'
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.cid IS DISTINCT FROM expected_cid OR NEW.aid IS DISTINCT FROM expected_aid THEN
        RAISE EXCEPTION 'registered event CID/AID does not match its customer registration'
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.eid !~ ('^' || expected_aid || '-[0-9]{8}T[0-9]{12}Z-[0-9]+$') THEN
        RAISE EXCEPTION 'registered event EID does not match its AID/time/sequence format'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_events_registered_identity_guard ON sec_events;

CREATE TRIGGER sec_events_registered_identity_guard
BEFORE INSERT OR UPDATE OF customer_id, cid, aid, eid, alert_registration_id
ON sec_events
FOR EACH ROW
EXECUTE FUNCTION validate_registered_event_identity();

CREATE OR REPLACE FUNCTION validate_alert_run_receipt_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_deployment TEXT;
    expected_customer UUID;
BEGIN
    SELECT registration.splunk_deployment, registration.customer_id
    INTO expected_deployment, expected_customer
    FROM sec_alert_registrations AS registration
    WHERE registration.id = NEW.registration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'alert receipt references an unknown registration'
            USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF NEW.deployment IS NULL OR btrim(NEW.deployment) = '' THEN
        NEW.deployment := expected_deployment;
    ELSIF NEW.deployment <> expected_deployment THEN
        RAISE EXCEPTION 'alert receipt deployment does not match its registration'
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.policy_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM sec_alert_email_policies AS policy
        WHERE policy.id = NEW.policy_id
          AND policy.customer_id = expected_customer
          AND (policy.registration_id IS NULL OR policy.registration_id = NEW.registration_id)
    ) THEN
        RAISE EXCEPTION 'alert receipt policy does not belong to its registration customer'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_alert_run_receipt_identity_guard ON sec_alert_run_receipts;

CREATE TRIGGER sec_alert_run_receipt_identity_guard
BEFORE INSERT OR UPDATE OF registration_id, deployment, policy_id
ON sec_alert_run_receipts
FOR EACH ROW
EXECUTE FUNCTION validate_alert_run_receipt_identity();

-- No-EID events are allowed to reach the legacy rules only when the explicit
-- legacy polling path marked them as such.  Registered events always use the
-- EID branch above and polling remains reconciliation-only.
CREATE OR REPLACE FUNCTION enqueue_sec_event_email() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    eligible BOOLEAN := FALSE;
BEGIN
    IF COALESCE(NEW.historical_email_suppressed, FALSE) THEN
        RETURN NEW;
    END IF;

    IF COALESCE(NEW.eid, '') <> '' THEN
        SELECT EXISTS (
            SELECT 1
            FROM customers AS customer
            JOIN sec_alert_registrations AS registration
              ON registration.id = NEW.alert_registration_id
             AND registration.customer_id = customer.id
            WHERE customer.id = NEW.customer_id
              AND customer.status = 'active'
              AND customer.alert_delivery_enabled
              AND registration.registration_state = 'active'
              AND registration.delivery_state = 'ready'
              AND registration.delivery_enabled
              AND registration.presence_state IN ('unknown', 'present')
              AND jsonb_typeof(customer.email_config -> 'recipients') = 'array'
              AND jsonb_array_length(customer.email_config -> 'recipients') > 0
              AND cardinality(registration.source_indexes) > 0
              AND NOT EXISTS (
                  SELECT 1
                  FROM unnest(registration.source_indexes) AS source(index_name)
                  WHERE NOT EXISTS (
                      SELECT 1
                      FROM sec_alert_index_ownership AS ownership
                      WHERE ownership.splunk_deployment = registration.splunk_deployment
                        AND ownership.index_name = source.index_name
                        AND ownership.customer_id = registration.customer_id
                        AND ownership.status = 'active'
                  )
              )
        ) INTO eligible;

        IF eligible AND COALESCE((NEW.event_data ->> 'email_held')::BOOLEAN, FALSE) = FALSE THEN
            INSERT INTO sec_event_email_outbox (
                event_id, customer_id, eid, recipient_snapshot, rendering_policy_snapshot
            )
            SELECT NEW.id, NEW.customer_id, NEW.eid,
                   CASE WHEN jsonb_typeof(NEW.event_data -> 'recipient_snapshot') = 'object'
                        THEN NEW.event_data -> 'recipient_snapshot' ELSE customer.email_config END,
                   CASE WHEN jsonb_typeof(NEW.event_data -> 'email_policy') = 'object'
                        THEN NEW.event_data -> 'email_policy' ELSE '{}'::JSONB END
            FROM customers AS customer
            WHERE customer.id = NEW.customer_id
            ON CONFLICT (event_id) DO NOTHING;
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.event_data ->> 'legacy_ingestion_mode' = 'explicit'
       AND COALESCE((NEW.event_data ->> 'email_held')::BOOLEAN, FALSE) = FALSE
       AND EXISTS (
           SELECT 1
           FROM sec_alert_email_rules AS rule
           WHERE rule.enabled
             AND (rule.customer_id IS NULL OR rule.customer_id = NEW.customer_id)
             AND (rule.ruleset_id IS NULL OR rule.ruleset_id = NEW.ruleset_id)
             AND NEW.severity = ANY(rule.severities)
       ) THEN
        INSERT INTO sec_event_email_outbox (event_id, customer_id)
        VALUES (NEW.id, NEW.customer_id)
        ON CONFLICT (event_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sec_events_email_outbox_insert ON sec_events;

CREATE TRIGGER sec_events_email_outbox_insert
AFTER INSERT ON sec_events
FOR EACH ROW
EXECUTE FUNCTION enqueue_sec_event_email();
