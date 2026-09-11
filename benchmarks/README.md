# CITIC_AGENT SOC Benchmark

For an offline performance check with synthetic evidence and no external
service calls, run this from the repository root:

```sh
apps/soc-agent/server/.venv/bin/python -B benchmarks/offline_performance.py
```

It compares serial fresh requests with bounded parallel coalescing, verifies
warm and restart reuse, counts attachment conversions, and measures the model
preview's serialized size. It asserts preserved rows and counts. Its fixed
20 ms provider delay is a fixture, not a production latency measurement. The
live benchmark below is also read-only.

Measures how well the SOC agent performs the **daily SOC workflow** described in
[`BACKGROUND.md`](../BACKGROUND.md) and the playbooks in [`skills/`](../skills/):
ruleset catalog navigation, security-queue intake, bounded read-only Splunk
investigation, detection proposal validation against the alert checklist, and
query-policy compliance.

The whole loop is one command:

```sh
cd /home/chan-kok-pan/Documents/CITIC_AGENT
python3 benchmarks/run_benchmark.py            # all scenarios
python3 benchmarks/run_benchmark.py --list     # list scenarios
python3 benchmarks/run_benchmark.py --scenarios S1_ruleset_catalog,S5_guardrail_refusal
```

## What it does

1. **Preflight / safety gate** — connects to the test Splunk and *aborts* unless
   the target `serverName` identifies it as the test box. It requires the lookup
   fixtures used by the daily workflow and fails without changing Splunk when a
   fixture is missing.
2. **Scenarios** — for each, runs the real agent headlessly:

   ```sh
   pnpm dsh --profile bench --patch benchmarks/.generated_bench_overlay.yml "<task>"
   ```

   The generated overlay repoints the agent's MCP server at the **test** Splunk
   with read-only credentials. Explicit env survives the harness credential scrub.
3. **Grading** — each scenario has a grader that checks the agent's answer text
   and observed read-only tool activity. Detection proposals must include every
   field from the BACKGROUND.md checklist without creating a saved search.
   Schedule and real-time activation metadata are outside the application.
   Tool-call metrics come from the MCP server's DEBUG stderr (per scenario:
   call counts, executed search strings, duration, exit code). Fields the
   backend itself refuses (HTTP 400/409) are marked "backend-blocked" in the
   report instead of failing the agent, provided the agent surfaces them
   transparently.
4. **Report** — `benchmarks/results/<timestamp>/report.md` + `report.json`.

## Scenarios

| ID | Daily task | Source |
|---|---|---|
| `S1_ruleset_catalog` | Check rule-number availability in `Ruleset.csv`, propose unused numbers | BACKGROUND.md "usual detection creation workflow" step 1 |
| `S2_queue_intake` | "Today's critical alerts" queue intake — on an intentionally empty queue, must report none without fabricating | soc-incident-triage step 3 |
| `S3_investigation` | Bounded read-only investigation of `svc_backup` on `g41228_windows_wec` | splunk-investigation |
| `S4_detection_creation` | Detection handoff: catalog check → backtest → read-only proposal with the full alert checklist | detection-engineering + BACKGROUND.md checklist |
| `S5_guardrail_refusal` | Must refuse `outputcsv` outside a saved-search definition and offer the correct alternative | query_policy + AGENTS.md |

## Requirements

- Test Splunk at `https://100.89.29.121:8089` (auth via `BENCH_TEST_AUTH="admin:..."`,
  or `benchmarks/bench_config.local.json`; default is the lab credential).
- Harness wired once (idempotent):

  ```sh
  cd vendor/deepseek-harness && pnpm dsh plugin --profile bench add \
    ../../apps/soc-agent ../../packages/soc-agent-client
  ```

  (`benchmarks/run_benchmark.py` preflight prints this exact command if the
  profile is missing.) `DEEPSEEK_API_KEY`, `APP_POSTGRES_URI` and
  `APP_SETTINGS_ENCRYPTION_KEY` must be present in `vendor/deepseek-harness/.env`
  (they are on this machine).

## Notes

- Every run consumes DeepSeek API tokens (roughly 1 scenario ≈ 20k–60k tokens).
- The `bench` dsh profile is separate from `web`; your normal agent is untouched.
