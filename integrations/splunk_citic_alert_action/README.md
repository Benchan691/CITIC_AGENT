# CITIC Alert Delivery custom action

Install this directory as a Splunk app on every search head that owns CITIC
alerts. Configure the action command environment with:

- `CITIC_ALERT_INGEST_URL`, for example `https://soc.example/api/soc-alerts/v1/runs`;
- `CITIC_ALERT_INGEST_SECRET`, the secret dedicated to this Splunk deployment
  and mapped to the deployment in the SOC host's
  `ALERT_INGEST_WEBHOOK_SECRETS_JSON`;
- `CITIC_ALERT_DEPLOYMENT`, matching `SPLUNK_DEPLOYMENT_ID` on the backend;
- `CITIC_ALERT_POLICY_ID`, `CITIC_ALERT_POLICY_REVISION`, and
  `CITIC_ALERT_DEFINITION_REVISION`, supplied by the approved publisher;
  missing values are resolved from the signed `/api/soc-alerts/v1/action-context`
  endpoint for alerts created directly in Splunk Web.
- optionally set `CITIC_ALERT_POLICY_URL` when the context endpoint is not the
  `/action-context` sibling of `CITIC_ALERT_INGEST_URL`.
- optional `CITIC_ALERT_SOURCE_INDEXES`, `CITIC_ALERT_SPL`, and
  `CITIC_ALERT_STABLE_ID` values supplied by the approved publisher. The
  source indexes or SPL are required when a run can arrive before discovery
  has registered the definition.

The action durably freezes the original CSV result file before its first
network request. It reads the path from the standard nested configuration or
`SPLUNK_ALERT_RESULTS_FILE`/`SPLUNK_ARG_8`, and detects gzip by content rather
than filename. A deployment wrapper may instead send a JSON object on stdin with
`results_file`, `sid`, `search_name`, `trigger_time`, `definition`, and `rows`.
The action sends original result fields (the backend applies the administrator
policy), preserves original row positions, excludes `_raw`, and records
bounded truncation metadata. A durable local spool survives action-process
restarts and copies the original result artifact before the Splunk job can
remove it. The included scripted input drains that spool every 30 seconds,
even when no later alert fires. Configure `CITIC_ALERT_SPOOL_DIR`,
`CITIC_ALERT_SPOOL_MAX_RUNS`, and `CITIC_ALERT_SPOOL_MAX_BYTES` for the Splunk
service account, and monitor the `_internal` sourcetype
`citic:alert:delivery:spool` for saturation or permanent failures.

Select **CITIC Alert Delivery** in the saved-search alert actions. Discovery
does not silently enable this action on existing searches. The SOC backend
validates the deployment, registered definition, customer index ownership,
definition revision, signature, and SID before storing a run.
