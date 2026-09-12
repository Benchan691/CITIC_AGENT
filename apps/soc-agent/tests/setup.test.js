import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const source = readFileSync(new URL('../../../setup.sh', import.meta.url), 'utf8')
// Load only definitions so tests cannot bootstrap a checkout, load deployment
// files, install dependencies, or change branches.
const helpers = source.slice(source.indexOf('trim() {'), source.indexOf('# ---------------------------------------------------------------- main ---'))
const logging = source.slice(source.indexOf('ok()'), source.indexOf('# ------------------------------------------------------------ layout'))
const bash = process.env.BASH || 'bash'
const version = spawnSync(bash, ['-c', 'printf "%s" "${BASH_VERSINFO[0]}"'], { encoding: 'utf8' })
const shellOptions = { skip: Number(version.stdout) < 4 || version.status !== 0 }
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`
const configured = {
  APP_POSTGRES_URI: 'postgresql://soc:database-secret@db.invalid/soc',
  APP_SETTINGS_ENCRYPTION_KEY: 'settings-secret',
  SOC_ADMIN_EMAIL: 'admin@example.test',
  SOC_ADMIN_PASSWORD: 'admin-secret',
  SPLUNK_MCP_ENDPOINT: 'https://splunk.example.test/services/mcp',
  SPLUNK_TOKEN: 'splunk-secret',
  ZIMBRA_HOST: 'https://mail.example.test',
  SUBSCRIPTION_SERVER_URL: 'https://subscription.example.test',
  SUBSCRIPTION_SERVER_USER: 'soc',
  SUBSCRIPTION_SERVER_PASSWORD: 'subscription-secret',
}

function run(commands, { values = {}, input = '' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'soc-setup-test-'))
  try {
    return spawnSync(bash, ['-c', `
set -euo pipefail
B= G= R= Y= D= N= TMPFILES=
${logging}
REPO_ROOT="$1"
SERVER_ENV="$1/server.env"
HARNESS_ENV="$1/harness.env"
DSH_PROFILE=web
${helpers}
pg_reachable() { return 0; }
${Object.entries({ ...configured, ...values }).map(([key, value]) => `FILEVAL[${key}]=${quote(value)}`).join('\n')}
${commands}
`, 'setup-test', directory], {
      encoding: 'utf8', input, timeout: 10_000,
      env: { PATH: process.env.PATH, TMPDIR: directory },
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('setup check requires the official connection even when legacy REST credentials exist', shellOptions, () => {
  const result = run('check_parameters', { values: {
    SPLUNK_MCP_ENDPOINT: '', SPLUNK_TOKEN: '',
    SPLUNK_URL: 'https://legacy.example.test:8089',
    SPLUNK_USERNAME: 'legacy-user', SPLUNK_PASSWORD: 'legacy-secret',
  } })
  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stdout, /\[FAIL\] SPLUNK_MCP_ENDPOINT:/)
  assert.match(result.stdout, /\[FAIL\] SPLUNK_TOKEN:/)
  assert.doesNotMatch(result.stdout, /legacy-secret|database-secret|admin-secret/)
})

test('setup prompts and checks share defaults and keep credentials out of output', shellOptions, () => {
  const result = run('collect_parameters; check_parameters; summary', { input: '\n'.repeat(30) })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /SPLUNK_VERIFY_SSL\s+true/)
  assert.match(result.stdout, /SPLUNK_SANITIZE_OUTPUT\s+true/)
  assert.match(result.stdout, /SPLUNK_ALLOW_INSECURE_HTTP\s+false/)
  assert.match(result.stdout, /SPLUNK_TOKEN\s+\[set\]/)
  assert.doesNotMatch(result.stdout + result.stderr, /database-secret|settings-secret|admin-secret|splunk-secret|subscription-secret/)
})

test('setup rejects unsafe MCP URLs and requires the same HTTP opt-in when prompting and checking', shellOptions, () => {
  for (const endpoint of [
    'http://splunk.example.test/mcp',
    'https://user:password@splunk.example.test/mcp',
    'https://splunk.example.test/mcp?token=secret',
    'https://splunk.example.test/mcp#secret',
    'https://splunk.example.test:99999/mcp',
  ]) {
    const result = run('check_parameters', { values: { SPLUNK_MCP_ENDPOINT: endpoint } })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stdout, /\[FAIL\] SPLUNK_MCP_ENDPOINT:/)
  }
  const prompt = run('ask_parameter SPLUNK_MCP_ENDPOINT; check_parameters', {
    input: 'http://splunk.example.test/mcp\nhttps://splunk.example.test/mcp\n',
  })
  assert.equal(prompt.status, 0, prompt.stderr)
  assert.match(prompt.stderr, /SPLUNK_ALLOW_INSECURE_HTTP is not true/)
  const allowed = run('check_parameters', { values: {
    SPLUNK_MCP_ENDPOINT: 'http://splunk.example.test/mcp',
    SPLUNK_ALLOW_INSECURE_HTTP: 'true', SPLUNK_VERIFY_SSL: 'false',
  } })
  assert.equal(allowed.status, 0, allowed.stderr)
})

test('setup validates optional OCR fields only when enabled and writes values without evaluating them', shellOptions, () => {
  const enabled = run('check_parameters', { values: { MARKITDOWN_LLM_ENABLED: 'true' } })
  assert.equal(enabled.status, 2, enabled.stderr)
  assert.match(enabled.stdout, /\[FAIL\] MARKITDOWN_LLM_API_KEY:/)
  assert.match(enabled.stdout, /\[FAIL\] MARKITDOWN_LLM_MODEL:/)
  const result = run(`
collect_parameters
printf '# synthetic config\nUNCHANGED=keep\n' > "$SERVER_ENV"
upsert_env_file "$SERVER_ENV" "\${SETUP_FIELDS[@]}"
node - "$SERVER_ENV" <<'NODE'
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { parseEnv } = require('node:util');
const values = parseEnv(readFileSync(process.argv[2], 'utf8'));
assert.equal(values.UNCHANGED, 'keep');
assert.equal(values.SPLUNK_TOKEN, 'token with $(printf must-not-run) and \`backticks\`');
assert.equal(values.SPLUNK_VERIFY_SSL, 'true');
NODE
`, { values: { SPLUNK_TOKEN: 'token with $(printf must-not-run) and `backticks`' }, input: '\n'.repeat(30) })
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout + result.stderr, /must-not-run|backticks/)
})

test('setup can collect an MCP endpoint after the operator skips installing Node', shellOptions, () => {
  const result = run('PATH="$REPO_ROOT"; ask_parameter SPLUNK_MCP_ENDPOINT; check_parameters', {
    input: 'https://user:password@splunk.example.test/mcp\nhttps://splunk.example.test/mcp\n',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /without credentials/)
})
