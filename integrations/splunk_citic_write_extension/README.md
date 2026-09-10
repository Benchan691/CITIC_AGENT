# CITIC saved-search write extension

This is a separately deployed, authenticated MCP extension used only for the
approved editor Save flow. It is not imported by the SOC backend and it does
not allocate CID, AID, or EID values.

The extension enforces the write boundary itself:

- Bearer authentication uses `CITIC_WRITE_MCP_TOKEN`.
- Only `CITIC_WRITE_ALLOWED_APPS` and `CITIC_WRITE_ALLOWED_OWNERS` are accepted.
- Only the allow-listed saved-search fields and the explicit backend-owned
  `action.citic_alert_delivery` parameter set are accepted.
- The definition must be disabled and must explicitly select `citic_alert_delivery`.
- SQLite stores idempotency keys and operation status so timeouts are reconciled
  instead of retried as a second write.
- Every successful create/update is read back from Splunk and compared with the
  approved disabled definition, action, namespace, and revision contract.

Install the `mcp` package in the extension environment, configure
`CITIC_WRITE_SPLUNK_URL` and `CITIC_WRITE_SPLUNK_TOKEN`, and run:

```text
python bin/citic_saved_search_write_extension.py
```

Put the service behind the deployment’s HTTPS/mTLS or authenticated reverse
proxy. The SOC server connects to its streamable HTTP `/mcp` endpoint with
`SPLUNK_WRITE_MCP_ENDPOINT`, `SPLUNK_WRITE_MCP_TOKEN`, and the configured tool
name. Use `CITIC_WRITE_DRY_RUN=1` only in a test environment.

Keep `CITIC_WRITE_OPERATION_DB` on persistent storage owned by the extension
service account. Runtime SQLite files are deployment state and must not be
packaged with this source directory.
