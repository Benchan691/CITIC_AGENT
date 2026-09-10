# Create a Splunk alert and deliver it through CITIC_AGENT

This is the current CID → AID → EID workflow for Splunk Enterprise 10.x.
Panel labels vary by release, app, and permissions. Customer delivery uses the
**CITIC Alert Delivery** custom action and the SOC backend's administrator
policy; the standard Splunk **Send email** action is not the customer-delivery
route.

## Before creating an alert

An administrator must:

1. Create or verify the active customer. The unique `customer_code` is the
   public CID; customer creation and ownership changes are administrator-only.
2. Register each exact source index in the deployment/index ownership registry.
   Every index used by the search must belong to the same customer. Shared,
   wildcard, dynamic, unresolved-macro, and cross-customer sources require
   review and cannot deliver customer email automatically.
3. Configure customer recipients, delivery enablement, severity fallback,
   selected detail columns, filters, required/optional mappings, row limits,
   language, and branding in `/admin/alert-email`.
4. Install the `integrations/splunk_citic_alert_action` app on every search head
   that owns these alerts. Configure the HTTPS ingest URL, the deployment's
   dedicated webhook secret, and the matching deployment ID. Do not put
   secrets, recipients, CID, AID, or EID values in SPL.

Apply all numbered migrations through 024 with email sending stopped, review
the exact preview run in the administrator dashboard, and apply that same run
ID before enabling production delivery. A changed or already-used preview is
rejected. The backend allocates AIDs; neither a person, SPL, nor an agent
constructs them. Install and capability-test the separately deployed
`integrations/splunk_citic_write_extension` before allowing editor Save. Its
operation database must be on persistent storage.

## Create a safe test alert in Splunk Web

Use synthetic data first:

```spl
| makeresults
| eval test_marker="SPLUNK_CITIC_ALERT_TEST", device="synthetic-host", severity="low"
| table _time test_marker device severity
```

1. Run the search and confirm its single synthetic result.
2. Select **Save As → Alert**.
3. Use a unique title, for example `TEST - CITIC Alert Delivery - <initials>`.
4. Set the intended schedule, time window, trigger condition, expiry, and
   throttle. For a five-minute test, `*/5 * * * *` with `-6m@m` through
   `-1m@m` is a reasonable bounded example.
5. Keep the saved search disabled until registration and review are complete.
6. Under **Trigger Actions**, select **CITIC Alert Delivery**. Do not add
   `outputcsv`, `logevent`, or standard **Send email** for this route.
7. Save the alert. The discovery worker registers it, or the first custom
   action invocation performs the same conservative registration checks when
   discovery has not completed.

The definition receives one AID such as `CPC001-0000`. A triggered run carries
the original Splunk SID and trigger time; the backend creates one EID such as
`CPC001-0000-20260909T081530123456Z-000001`. A run with many rows still creates
one EID and one outbox record.

## Configure result details

The search should return detection fields only. Do not add identity fields:

```spl
<approved customer-scoped detection logic>
| table _time device severity source
```

The administrator policy determines what is retained and displayed. An empty
detail policy intentionally transmits and stores no detail fields. `_raw` is
excluded by default. Filters are applied before retention limits; the first 50
matching rows are displayed by default, with at most 1,000 selected rows and
5 MiB stored per run. Original row positions, total rows, matching rows,
retained rows, displayed rows, and truncation are reported separately.

Missing required fields hold delivery for review. Missing optional fields are
blank. Severity comes from the configured source/mapping, then the configured
fallback, otherwise `unknown`; it never silently becomes `high`.

## Verify the test

1. Have an authorized operator activate the disabled test alert through the
   controlled Splunk process.
2. Wait for a qualifying run and open the SOC administrator dashboard.
3. Confirm the same CID, AID, EID, alert name, trigger time, severity, total
   count, retained/displayed counts, and one delivery-history record.
4. Check the SMTP outbox and relay acceptance. Relay acceptance is not proof
   of mailbox delivery; check the test mailbox and spam/quarantine folders.
5. Send the same run again or allow polling to observe it. Confirm the
   existing EID and outbox record are reused, with no duplicate email.
6. Disable and remove the synthetic test after verification.

Direct Splunk Web definitions show **Action missing** until the action is
selected and verified. Discovery does not silently enable an action. Renames
preserve identity only when a native stable identity proves continuity;
ambiguous copies or recreations require administrator relinking. A copied
saved search must receive a new AID.

## Agent/editor workflow

The agent/compiler accepts result-producing SPL and does not require
`GID`, `Event_GID`, or `Event_Rulenum`. The authenticated Save flow stages a
disabled draft, registers the alert, installs backend-owned action parameters,
and requires harness approval plus the explicit editor Save. Activation and
catalog publication remain separate operator actions. A failed publication
retains its allocated AID for reconciliation.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Alert is in **Needs customer review** | Inspect exact indexes, macros, subsearch branches, shared ownership, and deployment mapping. Resolve in the administrator dashboard. |
| **Action missing** | Select **CITIC Alert Delivery** in the saved-search actions and verify the app is installed; discovery never enables it automatically. |
| No EID or email | Check customer and per-alert delivery enablement, active ownership, recipients, policy revision, required columns, and quarantine/held-event review. |
| Duplicate alert or email | Check the registered AID and Splunk SID. Retries and polling should reconcile to the same receipt, EID, and outbox row. |
| Detail fields are blank | Confirm the administrator policy selected those source fields and that the search returns them. Sender-selected fields are ignored when no policy is configured. |
| Payload rejected | Check HTTPS, deployment-specific signature, replay/timestamp headers, supported payload version, original trigger time, policy revision, definition revision, and bounded result size. |
| SMTP accepted but mailbox is empty | Ask the relay administrator to inspect recipient acceptance, quarantine, and relay logs. Do not manually replay an uncertain outbox row without checking delivery records. |

Record the alert name, app, owner, Splunk SID, AID, EID, trigger time, and
backend review/error code when requesting help. Keep credentials and customer
data out of screenshots and tickets.
