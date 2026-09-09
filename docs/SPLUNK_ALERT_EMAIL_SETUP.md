# Create a Splunk alert and send email through the panels

For Splunk Enterprise 10.x. Panel labels can vary by release, app, and permissions. These instructions describe standard Search & Reporting alerts, not Enterprise Security correlation-search panels. Reviewed against official documentation on 8 September 2026; this guide was not tested by sending live email.

The flow is: **scheduled search → matching results → trigger condition → email action → company SMTP server → mailbox**. Splunk's outgoing-mail settings and the individual alert must both be configured. CITIC_AGENT's MCP token does not configure SMTP.

## 1. Configure outgoing email once

Ask your mail administrator for the SMTP host, port, encryption mode, authentication details, permitted sender, and recipient domains. All `example.invalid` values below are placeholders; replace them before testing.

1. Sign in to Splunk Web with an account allowed to manage server settings.
2. Open **Settings → Server settings → Email settings**.
3. Under **Mail Server Settings**, use the administrator's values:

| Setting | What to enter |
| --- | --- |
| Mail host | Host and port, for example `smtp.example.invalid:587`; do not enter the Splunk MCP URL. |
| Email security / encryption, if shown | Select TLS/STARTTLS or SSL to match the relay. STARTTLS and implicit SSL are different connection modes. If the control is unavailable, have the Splunk administrator configure it. |
| Authentication | Use the approved Simple or OAuth 2.0 option. |
| Username / Password | For Simple authentication, use the approved SMTP account. Leave credentials empty only for an explicitly configured unauthenticated relay. |
| OAuth fields | Obtain Client ID, Shared secret, Scope, and Tenant URL from the administrator. |

The port is part of the mail-host value when no separate port box appears. Do not choose encryption by guessing from a port number. See Splunk's [SMTP configuration reference](https://splunk.portal.heretto.com/en/data-management/splunk-enterprise-admin-manual/10.4/configuration-file-reference/10.4.0-configuration-file-reference/alert_actions.conf).

4. Set **Email Domains** to the approved custom domain list.
5. Under **Email Format**, set **Send emails as** to the authorized sender and **Link hostname** to the reader-accessible Splunk hostname.
6. Click **Save**. If this setup already works, retain it. These are shared settings. See [email setup and panel options](https://help.splunk.com/en/splunk-enterprise/alert-and-respond/alerting-manual/10.2/configure-alert-actions/email-notification-action).

## 2. Build a temporary learning alert

Start with synthetic data so no customer events enter the test email.

1. Open **Apps → Search & Reporting → Search**.
2. Paste this search and click the search button:

```spl
| makeresults
| eval test_marker="SPLUNK_EMAIL_PANEL_TEST", message="Synthetic notification test; no customer data"
| table _time test_marker message
```

3. Confirm the **Statistics** tab contains one row with the marker. Running this search alone does not send email.
4. Select **Save As → Alert**.
5. Complete the panel:

| Field | Learning-example value |
| --- | --- |
| Title | `TEST - Email panel - <your initials>` |
| Description | `Temporary synthetic email test; disable after verification.` |
| Permissions | Private. Use app sharing only when team access is intended. |
| Alert type | Scheduled |
| Schedule selection | Run on Cron Schedule |
| Earliest | `-6m@m` |
| Latest | `-1m@m` |
| Cron expression | `*/5 * * * *` |
| Expires, if shown | 24 hours; this controls triggered-record retention, not when the alert stops running. |
| Trigger alert when | Number of Results, greater than `0` |
| Trigger | Once |
| Throttle | Off for this temporary test |

Continue to the actions below before saving. See [scheduled-alert creation](https://help.splunk.com/en/splunk-cloud-platform/alert-and-respond/alerting-manual/10.3.2512/create-alerts/create-scheduled-alerts).

### Understand the five-minute schedule

The cron expression schedules a run at minutes 00, 05, 10, and so on. The time range covers five minutes with a one-minute ingestion delay. For example, a run at 10:10 examines 10:04–10:09. `@m` rounds to a minute boundary.

For a real detection, confirm the scheduling timezone and ingestion delay with the Splunk administrator. A longer search window can repeat events across runs; a shorter one can leave gaps. The synthetic search creates a row each run, so it demonstrates delivery rather than ingestion coverage. See [alert scheduling guidance](https://help.splunk.com/en/splunk-cloud-platform/alert-and-respond/alerting-manual/10.2.2510/create-alerts/alert-scheduling-tips).

### Avoid the zero-count trap

An ungrouped `stats count` can return **one row whose count is zero**. A trigger checking the number of result rows can therefore fire even when there were no matching events.

For an approved production search, filter the aggregate before using **Number of Results > 0**:

```spl
<your approved, customer-scoped search>
| stats count AS matching_events
| where matching_events > 0
```

The first line is a placeholder, not executable SPL. With no matches, the final filter removes the zero-count row. For a threshold of ten events, use `where matching_events >= 10`. Alternatively, retain the aggregate and configure a **Custom** trigger condition such as `search matching_events >= 10`. See [trigger conditions](https://help.splunk.com/en/splunk-cloud-platform/alert-and-respond/alerting-manual/10.2.2510/manage-alert-trigger-conditions-and-throttling/configure-alert-trigger-conditions).

## 3. Add the email action

1. Under **Trigger Actions**, select **Add Actions → Send email**.
2. Configure:

| Field | Test value |
| --- | --- |
| To | Your own actual mailbox; separate multiple addresses with commas. |
| CC / BCC | Empty |
| Priority | Normal |
| Subject / Message | Templates below |
| Link to Alert / Link to Results | Selected |
| Inline results | Table |
| Attach CSV | Selected to test the attachment |
| Attach PDF / Allow Empty Attachment | Unselected |
| Type | HTML & Plain Text |

3. Also add **Add to Triggered Alerts** for verification.
4. Review the recipient, then click **Save**. Saving a new scheduled alert can start scheduled execution; this test can email every five minutes until disabled. See [email action options](https://help.splunk.com/en/splunk-enterprise/alert-and-respond/alerting-manual/10.2/configure-alert-actions/email-notification-action).

### Copyable email text

**Subject:**

```text
[TEST] $name$ — $job.resultCount$ result(s)
```

**Message:**

```text
This is a synthetic Splunk email-delivery test.

Alert: $name$
Application: $app$
Result rows: $job.resultCount$
Test marker: $result.test_marker$
Search job: $job.sid$
Review results: $results_link$

Disable the temporary test alert after checking delivery.
```

For a production alert, remove the test wording and marker. `$job.resultCount$` counts output rows, not necessarily underlying events. Result tokens require the named field in the output; in a digest they refer to the first result row and do not summarize all rows. Use the table/attachment for multiple results. See [documented email tokens](https://help.splunk.com/en/splunk-cloud-platform/alert-and-respond/alerting-manual/10.3.2512/configure-alert-actions/use-tokens-in-email-notifications).

### Once, per-result, and throttle

**Once** means one action execution per qualifying run, not one email for the alert's lifetime. **For each result** can generate an email for each matching row: fifty rows can produce fifty emails. Use Once for this tutorial. For production, select behavior based on whether the recipient needs a digest or individual findings.

Throttling suppresses repeated triggering for a period. For example, a 15-minute throttle may suppress subsequent qualifying five-minute runs. Per-result suppression requires appropriate result fields identifying the entity; use fields actually returned by the detection. Preserve existing production choices. See [triggering and throttling](https://help.splunk.com/en/splunk-cloud-platform/alert-and-respond/alerting-manual/10.2.2510/manage-alert-trigger-conditions-and-throttling/configure-alert-trigger-conditions).

## 4. Verify, then disable the test

1. Wait for the next five-minute boundary and allow time for the search and SMTP delivery.
2. Open **Activity → Triggered Alerts**, filter by the test title, and open its results. Confirm the synthetic marker and execution time. Listing requires the tracking action and an unexpired record. See [viewing triggered alerts](https://help.splunk.com/splunk-cloud-platform/alert-and-respond/alerting-manual/9.3.2411/view-and-update-alerts/triggered-alerts).
3. Check your inbox and junk/quarantine folders. Verify the subject tokens, inline row, CSV, and result link. A result link still requires Splunk access and available search artifacts.
4. Open **Settings → Searches, reports, and alerts**. Find the exact test by title, app, and owner. Use its **Disable** action (in the row or Edit menu, depending on the panel). Confirm its status is disabled.
5. Check after another scheduled boundary that no new test run triggered. An email already queued can still arrive. Deleting a triggered-history entry does not disable the saved alert.

**Success means:** a scheduled job returned the marker, the alert triggered, and the expected message reached the mailbox. A triggered record alone does not prove email delivery.

### Troubleshooting checklist

| Symptom | What to check next |
| --- | --- |
| Email settings or Save As Alert is missing | Ask the administrator to check your role, scheduling capability, and app permissions. |
| Alert cannot be found | Check app/owner filters and sharing; a private alert may belong to another account. |
| No scheduled execution | Confirm enabled state, cron, timezone, owner access, and whether the scheduler skipped the job. Ask an administrator to inspect scheduler history. |
| Job ran but no triggered record | Check results, threshold, throttle, tracking action, and record expiry. |
| Triggered but no email | Check Send email is present, recipient spelling, allowed domains, spam/quarantine, and relay acceptance. |
| SMTP error | Have administrators check connectivity, port/encryption agreement, authentication, authorized sender, and email-action logs. |
| Empty or unexpected results | Compare the scheduled window and owner/app context with the successful manual search. Check aggregate filters. |
| Too many emails | Check per-result mode, repeated qualifying runs, overlapping windows, duplicate alerts, and throttle settings. |
| Missing token or incorrect count | Check field names in Statistics and whether the value describes rows or aggregated events. |
| Link fails or attachment is incomplete | Check link hostname, permissions, artifact expiry, and configured result/attachment limits. Do not assume email contains every event. |

Record the alert name, app, run time, job ID, and error text when asking for help. Keep SMTP secrets out of screenshots and tickets.

## 5. Add email to an existing CITIC detection

Use the existing approved detection rather than replacing its SPL with the learning example.

1. In **Settings → Searches, reports, and alerts**, filter to the detection's app and find its exact title and owner. Confirm customer scope and disabled state.
2. Record the existing schedule, trigger, throttle, and actions before editing.
3. Use **Edit → Edit alert** to review scheduling and triggering. Some panels separate **Edit schedule** and **Edit actions**; in Search & Reporting's **Alerts** page, **Edit → Edit actions** opens action configuration.
4. Add **Send email** and enter the approved customer-specific recipients and message. Preserve the existing trigger behavior and required actions. Do not automatically apply the tutorial's five-minute interval.
5. Retain **Add to Triggered Alerts** and **Log Event**, including the existing generated event text:

| CITIC Log Event field | Required existing value |
| --- | --- |
| Source | `$name$` |
| Sourcetype | `ticket_details` |
| Host | Empty |
| Index | `ticket_summary` |
| Event text | Preserve the compiler-generated text from the detection's final table. |

6. Save configuration, reopen it, and verify that the detection remains disabled and the required actions remain present.
7. Activation is a separate authorized operational step. Follow the organization's controlled Splunk activation process, then verify an expected scheduled run and delivery.

CITIC_AGENT draft tools require harness approval and an explicit authenticated editor **Save**; they persist detections disabled. Splunk Web has its own controls, so do not assume every Web save forces disabled status. The [repository detection workflow](../README.md#configure-splunk-alerts) defines the existing CITIC requirements.

**Attach CSV** sends a result attachment through the email action. It does not require adding `outputcsv` or `sendemail` to investigation SPL. Preserve existing compiled production logic and do not execute production write clauses merely to test email.
