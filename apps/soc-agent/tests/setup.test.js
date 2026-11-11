import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const source = readFileSync(new URL('../../../setup.sh', import.meta.url), 'utf8')
// Load only definitions so tests cannot bootstrap a checkout, load deployment
// files, install dependencies, or change branches.
const helpers = source.slice(source.indexOf('trim() {'), source.indexOf('# ---------------------------------------------------------------- main ---'))
const checkoutHelper = source.slice(source.indexOf('fast_forward_checkout() {'), source.indexOf('# Standalone bootstrap:'))
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

function run(commands, { values = {}, input = '', prepare = () => {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'soc-setup-test-'))
  try {
    prepare(directory)
    return spawnSync(bash, ['-c', `
set -euo pipefail
B= G= R= Y= D= N= TMPFILES=
${logging}
REPO_ROOT="$1"
SERVER_ENV="$1/server.env"
HARNESS_ENV="$1/harness.env"
DSH_PROFILE=web
${checkoutHelper}
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

function readerFixture(directory, { installed = '0.1.3', runtime = '0.1.3', available = true } = {}) {
  const app = join(directory, 'apps/soc-agent')
  const pkg = join(app, 'node_modules/@jiaoqsh/dsh-document')
  const wasm = join(pkg, 'node_modules/@firecrawl/pdf-inspector-wasm')
  mkdirSync(wasm, { recursive: true })
  writeFileSync(join(app, 'package.json'), JSON.stringify({ dependencies: { '@jiaoqsh/dsh-document': '0.1.3' } }))
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ version: installed, main: 'index.js' }))
  writeFileSync(join(pkg, 'index.js'), '')
  writeFileSync(join(pkg, 'pdf-worker.js'), '')
  writeFileSync(join(wasm, 'package.json'), JSON.stringify({ exports: { './pdf_inspector_wasm_bg.wasm': './reader.wasm' } }))
  writeFileSync(join(wasm, 'reader.wasm'), '')
  writeFileSync(join(app, 'document-reader.js'), `
const assert = require('node:assert/strict');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => raw += chunk);
process.stdin.on('end', () => {
  assert.deepEqual(JSON.parse(raw), {check:true});
  process.stdout.write(JSON.stringify({ok:true,value:{available:${available},name:'dsh-document',version:${JSON.stringify(runtime)}}}));
});
`)
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

test('setup uses the local document reader without model credentials', shellOptions, () => {
  const result = run('check_parameters')
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout, /LLM_API_KEY|LLM_MODEL|OCR/)
})

test('setup can collect an MCP endpoint after the operator skips installing Node', shellOptions, () => {
  const result = run('PATH="$REPO_ROOT"; ask_parameter SPLUNK_MCP_ENDPOINT; check_parameters', {
    input: 'https://user:password@splunk.example.test/mcp\nhttps://splunk.example.test/mcp\n',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /without credentials/)
})

test('setup installs the lan-access security override idempotently and preserves profile patches', shellOptions, () => {
  const result = run(`
empty_profile="$REPO_ROOT/profiles/empty"
profile="$REPO_ROOT/profiles/web"
mkdir -p "$empty_profile" "$profile"
printf '# empty profile layer\\n[]\\n' > "$empty_profile/cordis.patch.yml"
ensure_lan_access_policy "$empty_profile"
verify_lan_access_policy "$empty_profile"
grep -Fq 'allowRemotePrivileged: false' "$empty_profile/cordis.patch.yml"
printf '# Existing profile layer\\n- id: existing\\n  name: example\\n  config: {}\\n' > "$profile/cordis.patch.yml"
ensure_lan_access_policy "$profile"
verify_lan_access_policy "$profile"
ensure_lan_access_policy "$profile"
test "$(grep -c '^# CITIC_AGENT-managed: dsh-lan-access privileged methods disabled$' "$profile/cordis.patch.yml")" -eq 1
grep -Fq -- '- id: existing' "$profile/cordis.patch.yml"
grep -Fq 'allowRemotePrivileged: false' "$profile/cordis.patch.yml"
`)
  assert.equal(result.status, 0, result.stderr)
})

test('setup refuses to overwrite a conflicting lan-access profile policy', shellOptions, () => {
  const result = run(`
profile="$REPO_ROOT/profiles/web"
mkdir -p "$profile"
printf '%s\\n' "- id: lan-access" "  name: '@woyeshishen/dsh-lan-access'" "  config:" "    allowRemotePrivileged: true" > "$profile/cordis.patch.yml"
if ensure_lan_access_policy "$profile"; then exit 1; fi
grep -Fq 'allowRemotePrivileged: true' "$profile/cordis.patch.yml"
`)
  assert.equal(result.status, 0, result.stderr)
})

test('setup removes retired reader entries from both environments and preserves other values', shellOptions, () => {
  const server = '# deployment\nAPP_POSTGRES_URI="postgresql://keep-server"\nMARKITDOWN_LLM_ENABLED=true\nexport MARKITDOWN_LLM_API_KEY="old-private-key"\n ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS = 123\nCUSTOM_VALUE="MARKITDOWN_LLM_MODEL=literal"\n'
  const harness = '# harness\nAPP_SETTINGS_ENCRYPTION_KEY="keep-harness-key"\nMARKITDOWN_LLM_MODEL=old-model\nMARKITDOWN_LLM_BASE_URL=https://old.invalid/private\n'
  const cleanServer = '# deployment\nAPP_POSTGRES_URI="postgresql://keep-server"\nCUSTOM_VALUE="MARKITDOWN_LLM_MODEL=literal"\n'
  const cleanHarness = '# harness\nAPP_SETTINGS_ENCRYPTION_KEY="keep-harness-key"\n'
  const result = run(`
migrate_document_environment
verify_document_environment
node - "$SERVER_ENV" "$HARNESS_ENV" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
assert.equal(fs.readFileSync(process.argv[2], 'utf8'), ${JSON.stringify(cleanServer)});
assert.equal(fs.readFileSync(process.argv[3], 'utf8'), ${JSON.stringify(cleanHarness)});
for (const file of process.argv.slice(2)) assert.equal(fs.statSync(file).mode & 0o777, 0o600);
NODE
before="$(sha256sum "$SERVER_ENV" "$HARNESS_ENV")"
migrate_document_environment
test "$before" = "$(sha256sum "$SERVER_ENV" "$HARNESS_ENV")"
`, { prepare(directory) {
    writeFileSync(join(directory, 'server.env'), server)
    writeFileSync(join(directory, 'harness.env'), harness)
  } })
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout + result.stderr, /old-private-key|keep-harness-key|old-model|old\.invalid/)
})

test('reader environment audit reports keys without changing files or exposing values', shellOptions, () => {
  const stale = 'MARKITDOWN_LLM_API_KEY=hidden-api-value\nMARKITDOWN_LLM_MODEL=hidden-model-value\n'
  const result = run(`
if verify_document_environment; then exit 1; fi
node - "$SERVER_ENV" <<'NODE'
const assert = require('node:assert/strict');
assert.equal(require('node:fs').readFileSync(process.argv[2], 'utf8'), ${JSON.stringify(stale)});
NODE
`, { prepare(directory) { writeFileSync(join(directory, 'server.env'), stale) } })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /MARKITDOWN_LLM_API_KEY, MARKITDOWN_LLM_MODEL/)
  assert.doesNotMatch(result.stdout + result.stderr, /hidden-api-value|hidden-model-value/)
})

test('reader migration leaves missing environment files absent', shellOptions, () => {
  const result = run('migrate_document_environment; verify_document_environment; test ! -e "$SERVER_ENV"; test ! -e "$HARNESS_ENV"')
  assert.equal(result.status, 0, result.stderr)
})

test('setup verifies the installed reader pin and the bridge readiness response', shellOptions, () => {
  const result = run('verify_document_reader', { prepare: readerFixture })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /dsh-document@0\.1\.3 \(local, on demand\)/)
})

test('setup refuses a mismatched or unloadable reader', shellOptions, () => {
  for (const options of [{ installed: '0.1.2' }, { runtime: '0.1.2' }, { available: false }]) {
    const result = run('verify_document_reader', { prepare: directory => readerFixture(directory, options) })
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stdout, /document reader unavailable/)
  }
})

test('dependency cache checks do not execute an unbuilt bridge and reject missing parser assets', shellOptions, () => {
  const result = run(`
document_reader_check dependencies
if verify_document_reader; then exit 1; fi
rm "$REPO_ROOT/apps/soc-agent/node_modules/@jiaoqsh/dsh-document/pdf-worker.js"
if document_reader_check dependencies; then exit 1; fi
`, { prepare(directory) { readerFixture(directory, { available: false }) } })
  assert.equal(result.status, 0, result.stderr)
})

test('Python setup uses the checked-in dependency lock', shellOptions, () => {
  const result = run(`
SERVER_DIR="$REPO_ROOT"
uv() { printf '%s\\n' "$*" > "$REPO_ROOT/uv-call"; }
ensure_python_server
test "$(cat "$REPO_ROOT/uv-call")" = 'sync --locked --python 3.12'
`)
  assert.equal(result.status, 0, result.stderr)
})

test('a matching install marker still repairs a missing reader dependency', shellOptions, () => {
  const result = run(`
HARNESS_DIR="$REPO_ROOT/harness"
SOC_CLIENT_PACKAGE_NAMES=()
SOC_CLIENT_PACKAGE_DIRS=()
SOC_CLIENT_LIBS=()
mkdir -p "$BUILD_STATE_DIR" "$HARNESS_DIR/node_modules" "$HARNESS_DIR/apps/web/dist" "$HARNESS_DIR/packages/mcp/mcp-client/lib"
: > "$HARNESS_DIR/apps/web/dist/index.html"
: > "$HARNESS_DIR/packages/mcp/mcp-client/lib/index.js"
printf graph > "$HARNESS_INSTALL_MARKER"
printf sources > "$HARNESS_BUILD_MARKER"
harness_install_fingerprint() { printf graph; }
harness_source_fingerprint() { printf sources; }
pnpm() {
  printf '%s\\n' "$*" > "$REPO_ROOT/pnpm-call"
  : > "$REPO_ROOT/apps/soc-agent/node_modules/@jiaoqsh/dsh-document/pdf-worker.js"
}
rm "$REPO_ROOT/apps/soc-agent/node_modules/@jiaoqsh/dsh-document/pdf-worker.js"
ensure_harness_ready
test "$(cat "$REPO_ROOT/pnpm-call")" = 'install --frozen-lockfile --force'
verify_document_reader
`, { prepare: readerFixture })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /cached document reader needs repair/)
})

test('a healthy reader retains the dependency and build caches', shellOptions, () => {
  const result = run(`
HARNESS_DIR="$REPO_ROOT/harness"
SOC_CLIENT_PACKAGE_NAMES=()
SOC_CLIENT_PACKAGE_DIRS=()
SOC_CLIENT_LIBS=()
mkdir -p "$BUILD_STATE_DIR" "$HARNESS_DIR/node_modules" "$HARNESS_DIR/apps/web/dist" "$HARNESS_DIR/packages/mcp/mcp-client/lib"
: > "$HARNESS_DIR/apps/web/dist/index.html"
: > "$HARNESS_DIR/packages/mcp/mcp-client/lib/index.js"
printf graph > "$HARNESS_INSTALL_MARKER"
printf sources > "$HARNESS_BUILD_MARKER"
harness_install_fingerprint() { printf graph; }
harness_source_fingerprint() { printf sources; }
pnpm() { printf 'unexpected install or build\\n' >&2; return 1; }
ensure_harness_ready
`, { prepare: readerFixture })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /skipping pnpm install/)
  assert.match(result.stdout, /skipping pnpm run build/)
})

test('bootstrap stops when the existing checkout cannot fast-forward', shellOptions, () => {
  const result = run(`
git() {
  test "$*" = "-C $REPO_ROOT pull --ff-only"
  return 128
}
fast_forward_checkout "$REPO_ROOT"
printf 'unexpected continuation\\n'
`)
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stdout, /setup stopped; resolve the Git error and retry/)
  assert.doesNotMatch(result.stdout, /unexpected continuation/)
})
