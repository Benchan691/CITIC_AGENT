#!/usr/bin/env bash
#
# SOC Agent setup doctor.
#
# Checks prerequisites (node, pnpm, uv) and every required runtime parameter
# (PostgreSQL, settings encryption key, Splunk, Zimbra, subscription server,
# LLM API key). Anything missing or invalid is re-prompted until it validates,
# then the collected values are written to the two env files the app reads:
#
#   apps/soc-agent/server/.env      Python MCP server (Splunk/Zimbra/DB secrets)
#   vendor/deepseek-harness/.env    Node harness process (loaded at `pnpm dsh web`)
#
# Existing values (current shell, existing .env files, .env.example) are kept
# and used as defaults; only broken or missing parameters are asked for.
#
# Usage:
#   ./setup.sh            interactive: check, re-ask until valid, write files,
#                         install/build the harness, repair drifted artifacts,
#                         wire the profile
#   ./setup.sh --check    report only; exits 1 when something is missing
#   ./setup.sh --plugins  non-interactive: install, build, repair, wire profile

set -euo pipefail

# ------------------------------------------------------------- layout ----

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
HARNESS_DIR="$REPO_ROOT/vendor/deepseek-harness"
SERVER_DIR="$REPO_ROOT/apps/soc-agent/server"
HARNESS_ENV="$HARNESS_DIR/.env"
SERVER_ENV="$SERVER_DIR/.env"
SERVER_ENV_EXAMPLE="$SERVER_DIR/.env.example"
PLUGIN_REQUIREMENTS="$REPO_ROOT/requirements.txt"
PLUGIN_PATCH="$REPO_ROOT/patches/dsh-auto-collapse@0.1.4.patch"

for _d in "$HARNESS_DIR" "$SERVER_DIR"; do
  if [ ! -d "$_d" ]; then
    echo "error: expected directory '$_d' is missing." >&2
    echo "       Run this script from the CITIC_AGENT repository root." >&2
    exit 1
  fi
done

# Corepack's default install location is not always on a non-login PATH.
if ! command -v pnpm >/dev/null 2>&1 && [ -x "$HOME/.local/share/pnpm/bin/pnpm" ]; then
  export PATH="$HOME/.local/share/pnpm/bin:$PATH"
fi

DSH_PROFILE="${DSH_PROFILE:-web}"

# The browser-facing artifact of the SOC settings UI. Its health is guarded
# below: it is rebuilt by `prepare` on every pnpm install and can silently
# drift (see ensure_harness_ready).
SOC_CLIENT_LIB="$REPO_ROOT/packages/soc-agent-client/lib/client.js"

if [ ! -f "$SERVER_ENV_EXAMPLE" ]; then
  echo "error: template '$SERVER_ENV_EXAMPLE' is missing." >&2
  exit 1
fi
if [ ! -f "$PLUGIN_REQUIREMENTS" ]; then
  echo "error: plugin requirements '$PLUGIN_REQUIREMENTS' is missing." >&2
  exit 1
fi
if [ ! -f "$PLUGIN_PATCH" ]; then
  echo "error: plugin patch '$PLUGIN_PATCH' is missing." >&2
  exit 1
fi

# ------------------------------------------------------------- output ----

if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; D=$'\033[2m'; N=$'\033[0m'
else
  B=""; G=""; R=""; Y=""; D=""; N=""
fi
ok()   { printf '%s[ok]%s   %s\n' "$G" "$N" "$1"; }
bad()  { printf '%s[FAIL]%s %s\n' "$R" "$N" "$1"; }
warn() { printf '%s[warn]%s %s\n' "$Y" "$N" "$1"; }
info() { printf '%s[info]%s %s\n' "$D" "$N" "$1"; }

TMPFILES=""
cleanup() { [ -n "$TMPFILES" ] && rm -f $TMPFILES 2>/dev/null || true; }
trap cleanup EXIT

# ------------------------------------------------------------ helpers ----

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

PLUGIN_NAMES=(
  "@linxin666/dsh-client-ui-skin-center"
  "dsh-auto-collapse"
)
PLUGIN_SPECS=()

read_plugin_requirements() {
  PLUGIN_SPECS=()
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="$(trim "$line")"
    case "$line" in
      ''|\#*) continue ;;
      -*) bad "$PLUGIN_REQUIREMENTS contains a pnpm option instead of a package spec: $line"; return 1 ;;
      *[[:space:]]*) bad "$PLUGIN_REQUIREMENTS contains whitespace in a package spec: $line"; return 1 ;;
    esac
    PLUGIN_SPECS+=("$line")
  done < "$PLUGIN_REQUIREMENTS"
  if [ "${#PLUGIN_SPECS[@]}" -ne "${#PLUGIN_NAMES[@]}" ]; then
    bad "$PLUGIN_REQUIREMENTS must contain exactly ${#PLUGIN_NAMES[@]} package specs"
    return 1
  fi
}

# Strip one pair of surrounding single/double quotes, if both ends match.
strip_quotes() {
  local s="$1"
  [ "${#s}" -ge 2 ] || { printf '%s' "$s"; return 0; }
  local f="${s:0:1}" l="${s: -1}"
  if [ "$f" = "$l" ] && [ "$f" = '"' -o "$f" = "'" ]; then
    s="${s:1:$(( ${#s} - 2 ))}"
  fi
  printf '%s' "$s"
}

env_value() { # $1 = key -> value from the current environment, or empty
  printenv "$1" 2>/dev/null || true
}

# ------------------------------------------------------------ loading ----

# Merged view of known values: .env.example < harness .env < server .env < environment.
declare -A FILEVAL=()

load_env_file() { # $1 = file
  local file="$1" line key value
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|\#*) continue ;; esac
    case "$line" in *=*) ;; *) continue ;; esac
    key="$(trim "${line%%=*}")"
    value="$(strip_quotes "$(trim "${line#*=}")")"
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      FILEVAL["$key"]="$value"
    fi
  done < "$file"
}

lookup() { # $1 = key -> environment wins, then files; prints value
  local v
  v="$(env_value "$1")"
  if [ -n "$v" ]; then printf '%s' "$v"; else printf '%s' "${FILEVAL[$1]-}"; fi
}

# ---------------------------------------------------------- validators ---

REASON=""

is_nonempty() {
  if [ -n "$(trim "$1")" ]; then return 0; fi
  REASON="the value must not be empty"
  return 1
}

is_http_url() {
  if [[ "$1" =~ ^https?://[^[:space:]]+$ ]]; then return 0; fi
  REASON="must be a URL starting with http:// or https:// (no spaces)"
  return 1
}

is_pg_uri() {
  if [[ "$1" =~ ^postgres(ql)?://[^[:space:]]+$ ]]; then return 0; fi
  REASON="must look like postgresql://user:password@host:5432/dbname"
  return 1
}

is_host_or_url() {
  case "$1" in
    *://*) is_http_url "$1"; return $? ;;
    *)
      if [[ "$1" =~ ^[^[:space:]]+$ ]]; then return 0; fi
      REASON="must be a hostname (splunk.example.com) or a full http(s):// URL"
      return 1
      ;;
  esac
}

is_port() {
  if [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; then return 0; fi
  REASON="must be a TCP port between 1 and 65535"
  return 1
}

# Best-effort connectivity probe; skipped when psql is unavailable.
pg_reachable() {
  command -v psql >/dev/null 2>&1 || return 0
  PGCONNECT_TIMEOUT=5 psql "$1" -c 'SELECT 1;' >/dev/null 2>&1 </dev/null
}

# ------------------------------------------------------ prompt helpers ---

declare -A VALUES=()

ask_value() { # $1=key $2=label $3=validator $4=default $5=secret(anything)
  local key="$1" label="$2" validator="$3" default="${4-}" secret="${5-}" input
  while :; do
    if [ -n "$secret" ] && [ -n "$default" ]; then
      printf '%s [press Enter to keep the existing value]: ' "$label" >&2
    elif [ -n "$default" ]; then
      printf '%s [%s]: ' "$label" "$default" >&2
    else
      printf '%s: ' "$label" >&2
    fi
    if [ -n "$secret" ]; then
      IFS= read -rs input || exit 1
      printf '\n' >&2
    else
      IFS= read -r input || exit 1
    fi
    input="${input%$'\r'}"
    if [ -z "$input" ]; then input="$default"; fi
    if "$validator" "$input"; then
      VALUES["$key"]="$(trim "$input")"
      return 0
    fi
    printf '%s  invalid: %s. Please type it again.%s\n' "$Y" "$REASON" "$N" >&2
  done
}

ask_bool() { # $1=key $2=label $3=default(true|false)
  local key="$1" label="$2" def="$3" input
  while :; do
    printf '%s [true/false, default %s]: ' "$label" "$def" >&2
    IFS= read -r input || exit 1
    input="${input%$'\r'}"
    input="$(trim "${input:-$def}")"
    case "${input,,}" in
      1|y|yes|true|on)  VALUES["$key"]=true;  return 0 ;;
      0|n|no|false|off) VALUES["$key"]=false; return 0 ;;
    esac
    printf '%s  Please answer true or false.%s\n' "$Y" "$N" >&2
  done
}

generate_key() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

# ------------------------------------------------------- prerequisites ---

node_version_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local v; v="$(node -v 2>/dev/null)" || return 1
  [[ "$v" =~ ^v([0-9]+)\.([0-9]+) ]] || return 1
  local major="${BASH_REMATCH[1]}" minor="${BASH_REMATCH[2]}"
  if [ "$major" -ge 24 ]; then return 0; fi
  [ "$major" -eq 22 ] && [ "$minor" -ge 19 ]
}

check_node() { node_version_ok; }
check_pnpm() { command -v pnpm >/dev/null 2>&1; }
check_uv()   { command -v uv >/dev/null 2>&1; }

version_of() { # $1 = tool name -> one-line version string (may be empty)
  case "$1" in
    node) node -v 2>/dev/null || true ;;
    pnpm) pnpm -v 2>/dev/null || true ;;
    uv)   uv --version 2>/dev/null | cut -d' ' -f2 || true ;;
  esac
}

PREREQ_WARNINGS=()

prereq_loop() { # $1=name $2=checkfn $3=hint
  local name="$1" fn="$2" hint="$3" answer
  if "$fn"; then
    ok "$name ${D}($(version_of "$name"))$N"
    return 0
  fi
  bad "$name is missing or too old"
  while ! "$fn"; do
    printf '%s\n' "  $hint" >&2
    printf 'Install it, then press Enter to re-check (or type %sskip%s to continue without it): ' "$B" "$N" >&2
    IFS= read -r answer || exit 1
    if [ "${answer%$'\r'}" = "skip" ]; then
      PREREQ_WARNINGS+=("$name")
      warn "continuing without $name — the app will not boot until it is installed."
      return 0
    fi
  done
  ok "$name ${D}($(version_of "$name"))$N"
}

run_prereq_checks() {
  echo "${B}Prerequisites${N}"
  prereq_loop "node"  check_node \
    "The harness needs Node.js ^22.19.0 or >=24.0.0 (e.g.: nvm install 22 && nvm use 22, or https://nodejs.org)."
  prereq_loop "pnpm"  check_pnpm \
    "Enable Corepack to get the pinned pnpm:  corepack enable   (or: npm install -g pnpm@11)"
  prereq_loop "uv"    check_uv \
    "The Python MCP server boots through uv:  curl -LsSf https://astral.sh/uv/install.sh | sh"
  echo
}

# ---------------------------------------------------------- parameters ---

collect_parameters() {
  echo "${B}Required parameters${N} ${D}(Enter keeps the value shown in brackets)${N}"
  echo

  # -- PostgreSQL ---------------------------------------------------------
  local cur answer
  cur="$(lookup APP_POSTGRES_URI)"
  while :; do
    ask_value APP_POSTGRES_URI "PostgreSQL URI" is_pg_uri "$cur"
    if pg_reachable "${VALUES[APP_POSTGRES_URI]}"; then
      break
    fi
    warn "psql could not connect to that URI within 5s."
    printf 'Type %sr%s to re-enter the URI, or %sk%s to keep it anyway: ' "$B" "$N" "$B" "$N" >&2
    IFS= read -r answer || exit 1
    if [ "${answer%$'\r'}" = "k" ]; then break; fi
  done

  # -- Settings encryption key -------------------------------------------
  cur="$(lookup APP_SETTINGS_ENCRYPTION_KEY)"
  if [ -z "$cur" ]; then
    printf 'APP_SETTINGS_ENCRYPTION_KEY [press Enter to auto-generate a secure key]: ' >&2
    local input
    IFS= read -rs input || exit 1
    printf '\n' >&2
    input="${input%$'\r'}"
    if [ -n "$(trim "$input")" ]; then
      VALUES[APP_SETTINGS_ENCRYPTION_KEY]="$(trim "$input")"
    else
      VALUES[APP_SETTINGS_ENCRYPTION_KEY]="$(generate_key)"
      info "generated a new encryption key (it encrypts settings stored in PostgreSQL)"
    fi
  else
    ask_value APP_SETTINGS_ENCRYPTION_KEY "APP_SETTINGS_ENCRYPTION_KEY" is_nonempty "$cur" secret
  fi

  # -- Splunk connection ---------------------------------------------------
  local cur_host cur_url default_splunk
  cur_host="$(lookup SPLUNK_HOST)"
  cur_url="$(lookup SPLUNK_URL)"
  if [ -n "$cur_url" ]; then default_splunk="$cur_url"; else default_splunk="$cur_host"; fi
  while :; do
    printf 'Splunk connection (hostname, or full URL like https://splunk.example.com:8089)'
    if [ -n "$default_splunk" ]; then printf ' [%s]' "$default_splunk"; fi
    printf ': ' >&2
    IFS= read -r input || exit 1
    input="${input%$'\r'}"
    if [ -z "$input" ]; then input="$default_splunk"; fi
    if [ -z "$input" ]; then
      printf '%s  A Splunk host or URL is required. Please type it again.%s\n' "$Y" "$N" >&2
      continue
    fi
    case "$input" in
      *://*)
        if is_http_url "$input"; then
          VALUES[SPLUNK_URL]="$input"; VALUES[SPLUNK_HOST]=""; VALUES[SPLUNK_PORT]=""
          break
        fi
        printf '%s  invalid: %s. Please type it again.%s\n' "$Y" "$REASON" "$N" >&2
        ;;
      *)
        if is_host_or_url "$input"; then
          VALUES[SPLUNK_HOST]="$input"; VALUES[SPLUNK_URL]=""
          break
        fi
        printf '%s  invalid: %s. Please type it again.%s\n' "$Y" "$REASON" "$N" >&2
        ;;
    esac
  done

  # Splunk port: only relevant for the plain-host form without an embedded port.
  if [ -n "${VALUES[SPLUNK_HOST]-}" ]; then
    cur="$(lookup SPLUNK_PORT)"
    ask_value SPLUNK_PORT "Splunk management port" is_port "${cur:-8089}"
  fi

  # Splunk credentials: a token wins over user/password when both exist.
  if [ -n "$(lookup SPLUNK_TOKEN)" ]; then
    ok "Splunk token found (SPLUNK_TOKEN)"
    VALUES[SPLUNK_TOKEN]="$(lookup SPLUNK_TOKEN)"
    VALUES[SPLUNK_USERNAME]=""; VALUES[SPLUNK_PASSWORD]=""
  elif [ -n "$(lookup SPLUNK_USERNAME)" ] && [ -n "$(lookup SPLUNK_PASSWORD)" ]; then
    ok "Splunk basic auth found (SPLUNK_USERNAME / SPLUNK_PASSWORD)"
    VALUES[SPLUNK_USERNAME]="$(lookup SPLUNK_USERNAME)"
    VALUES[SPLUNK_PASSWORD]="$(lookup SPLUNK_PASSWORD)"
    VALUES[SPLUNK_TOKEN]=""
  else
    while :; do
      printf 'Splunk authentication — enter %s1%s for a session token, %s2%s for username/password: ' "$B" "$N" "$B" "$N" >&2
      IFS= read -r answer || exit 1
      case "${answer%$'\r'}" in
        1)
          ask_value SPLUNK_TOKEN "Splunk token" is_nonempty "" secret
          VALUES[SPLUNK_USERNAME]=""; VALUES[SPLUNK_PASSWORD]=""
          break
          ;;
        2)
          ask_value SPLUNK_USERNAME "Splunk username" is_nonempty ""
          ask_value SPLUNK_PASSWORD "Splunk password" is_nonempty "" secret
          VALUES[SPLUNK_TOKEN]=""
          break
          ;;
        *) printf '%s  Please answer 1 or 2.%s\n' "$Y" "$N" >&2 ;;
      esac
    done
  fi

  cur="$(lookup SPLUNK_VERIFY_SSL)"
  ask_bool SPLUNK_VERIFY_SSL "Verify Splunk TLS certificate" "${cur:-true}"

  # -- Zimbra ---------------------------------------------------------------
  cur="$(lookup ZIMBRA_HOST)"
  ask_value ZIMBRA_HOST "Zimbra server URL" is_http_url "$cur"
  case "${VALUES[ZIMBRA_HOST]}" in
    *example.com*) warn "ZIMBRA_HOST still looks like a placeholder — set your real Zimbra server before going live." ;;
  esac
  cur="$(lookup ZIMBRA_VERIFY_SSL)"
  ask_bool ZIMBRA_VERIFY_SSL "Verify Zimbra TLS certificate" "${cur:-false}"

  # -- Subscription webserver ----------------------------------------------
  cur="$(lookup SUBSCRIPTION_SERVER_URL)"
  ask_value SUBSCRIPTION_SERVER_URL "Subscription server URL" is_http_url "$cur"
  cur="$(lookup SUBSCRIPTION_SERVER_USER)"
  ask_value SUBSCRIPTION_SERVER_USER "Subscription server username" is_nonempty "$cur"
  cur="$(lookup SUBSCRIPTION_SERVER_PASSWORD)"
  ask_value SUBSCRIPTION_SERVER_PASSWORD "Subscription server password" is_nonempty "$cur" secret

  # -- LLM API key ----------------------------------------------------------
  cur="$(lookup DEEPSEEK_API_KEY)"
  ask_value DEEPSEEK_API_KEY "LLM API key (DEEPSEEK_API_KEY)" is_nonempty "$cur" secret
  case "${VALUES[DEEPSEEK_API_KEY]}" in
    sk-*) : ;;
    *) warn "the API key does not start with 'sk-' — double-check it if model calls fail." ;;
  esac
  echo
}

# ------------------------------------------------------------- writing ---

env_quote() { # $1 = raw value -> safely quoted for .env consumers
  local v="$1"
  # shellcheck disable=SC2196
  local safe_re='^[A-Za-z0-9._~:/?#@!&(),;=%+*-]+$'
  if [[ "$v" =~ $safe_re ]]; then
    printf '%s' "$v"
  else
    v="${v//\'/\'\\\'\'}"
    printf "'%s'" "$v"
  fi
}

# Rewrite $1 replacing every KEY= line whose key is listed, appending the
# missing ones; comments and unrelated lines are preserved.
upsert_env_file() { # $1=file $2...=keys
  local file="$1"; shift
  local -a wanted=("$@")
  local -A seen=()
  local tmp
  tmp="$(mktemp "${file}.XXXXXX")"
  TMPFILES="$TMPFILES $tmp"
  local line key k
  while IFS= read -r line || [ -n "$line" ]; do
    key=""
    case "$line" in
      ''|\#*) : ;;
      *=*)
        key="$(trim "${line%%=*}")"
        ;;
    esac
    if [ -n "$key" ] && [ -n "${VALUES[$key]+x}" ]; then
      printf '%s=%s\n' "$key" "$(env_quote "${VALUES[$key]}")"
      seen["$key"]=1
    else
      printf '%s\n' "$line"
    fi
  done < "$file" > "$tmp"
  for k in "${wanted[@]}"; do
    if [ -z "${seen[$k]+x}" ]; then
      printf '%s=%s\n' "$k" "$(env_quote "${VALUES[$k]}")" >> "$tmp"
    fi
  done
  mv "$tmp" "$file"
  chmod 600 "$file"
  TMPFILES="${TMPFILES// $tmp/}"
}

ensure_git_ignored() { # $1 = repo-relative path
  if git -C "$REPO_ROOT" check-ignore -q "$1" 2>/dev/null; then return 0; fi
  if [ -f "$REPO_ROOT/.gitignore" ] && grep -qE '(^|[[:space:]])\.env([[:space:]]|$)' "$REPO_ROOT/.gitignore"; then
    return 0
  fi
  printf '\n# Local env files with credentials (added by setup.sh)\n.env\n**/.env\n' >> "$REPO_ROOT/.gitignore"
  info "added .env patterns to .gitignore so secrets never get committed"
  if ! git -C "$REPO_ROOT" check-ignore -q "$1" 2>/dev/null; then
    warn "could not confirm $1 is git-ignored — verify before committing"
  fi
}

write_files() {
  # Seed the server .env from the template when it does not exist yet, so all
  # documented keys (and their comments) are preserved.
  if [ ! -f "$SERVER_ENV" ]; then
    cp "$SERVER_ENV_EXAMPLE" "$SERVER_ENV"
    info "seeded $SERVER_ENV from .env.example"
  fi

  upsert_env_file "$SERVER_ENV" \
    APP_POSTGRES_URI APP_SETTINGS_ENCRYPTION_KEY \
    SPLUNK_URL SPLUNK_HOST SPLUNK_PORT \
    SPLUNK_TOKEN SPLUNK_USERNAME SPLUNK_PASSWORD SPLUNK_VERIFY_SSL \
    ZIMBRA_HOST ZIMBRA_VERIFY_SSL \
    SUBSCRIPTION_SERVER_URL SUBSCRIPTION_SERVER_USER SUBSCRIPTION_SERVER_PASSWORD

  if [ ! -f "$HARNESS_ENV" ]; then
    printf '# Loaded by the DeepSeek Harness boot when `pnpm dsh web` runs from\n# vendor/deepseek-harness (cwd .env layer). Managed by setup.sh.\n' > "$HARNESS_ENV"
    info "created $HARNESS_ENV"
  fi
  upsert_env_file "$HARNESS_ENV" \
    DEEPSEEK_API_KEY APP_POSTGRES_URI APP_SETTINGS_ENCRYPTION_KEY

  ensure_git_ignored "apps/soc-agent/server/.env"
  ensure_git_ignored "vendor/deepseek-harness/.env"

  # Values exported in the current shell override the files at runtime.
  local key
  for key in "${!VALUES[@]}"; do
    if [ -n "$(env_value "$key")" ] && [ "$(env_value "$key")" != "${VALUES[$key]}" ]; then
      warn "$key is also exported in your current shell with a different value — the export wins at runtime (consider unsetting it)."
    fi
  done
}

# ------------------------------------------------- harness build & wiring ---
#
# Three things must hold before `pnpm dsh web` boots the full SOC product:
#
#   1. Harness JavaScript dependencies are installed (pnpm install).
#   2. The framework is built (pnpm run build) — this produces
#      vendor/schemastery/lib and the served web dist. schemastery's lib/ is
#      a hard prerequisite for a healthy SOC client bundle: the vendored
#      package is inline-only in client bundles, and a bundle built before
#      its lib/ exists silently emits require("@deepseek-ai/schemastery"),
#      which the browser module table can never answer ("missed the module
#      table" at boot).
#   3. The SOC client bundle artifact is drift-free. packages/soc-agent-client's
#      `prepare` script rebuilds it during EVERY pnpm install — on a fresh
#      clone that runs before schemastery exists, so the committed healthy
#      artifact gets overwritten with a drifted one. The guard below detects
#      the drift and the repair rebuilds the package after the framework
#      build, when inlining succeeds.
#
# The wiring itself (registering the product bundle in the harness `web`
# profile) then follows in ensure_soc_bundle.

# Specifiers a client bundle may require externally (module-table rows).
# Anything else found as a literal require() in lib/client.js is drift.
client_external_violations() {
  local allow='^(react|react/jsx-runtime|react-dom|react-dom/client|@deepseek-ai/cordis|@deepseek-ai/dsh-client-ui-slots|@deepseek-ai/dsh-client-ui-primitives|@deepseek-ai/dsh-client-runtime/client)$'
  grep -o 'require("[^"]*")' "$SOC_CLIENT_LIB" 2>/dev/null \
    | sed -e 's/^require("//' -e 's/")$//' \
    | sort -u \
    | grep -vE "$allow" || true
}

ensure_python_server() {
  echo "${B}Python MCP server environment${N}"
  if [ -d "$SERVER_DIR/.venv" ]; then
    ok "Python environment present"
    return 0
  fi
  echo "Syncing Python dependencies (uv sync --python 3.12) — this can take a few minutes…"
  if (cd "$SERVER_DIR" && uv sync --python 3.12); then
    ok "Python environment ready"
  else
    bad "uv sync failed — run: cd apps/soc-agent/server && uv sync --python 3.12"
    PREREQ_WARNINGS+=("Python MCP environment")
    return 1
  fi
}

ensure_harness_ready() {
  echo "${B}Harness build${N}"

  if [ ! -d "$HARNESS_DIR/node_modules" ]; then
    echo "Installing harness dependencies — this can take a few minutes…"
    if (cd "$HARNESS_DIR" && pnpm install --frozen-lockfile); then
      ok "harness dependencies installed"
    else
      bad "pnpm install failed — fix the error above and re-run ./setup.sh"
      PREREQ_WARNINGS+=("harness build")
      return 1
    fi
  else
    ok "harness dependencies present"
  fi

  if [ -f "$HARNESS_DIR/vendor/schemastery/lib/index.cjs" ] \
    && [ -f "$HARNESS_DIR/apps/web/dist/index.html" ]; then
    ok "framework build present"
  else
    echo "Building the harness (framework libs, schemastery, web dist) — this can take several minutes…"
    if (cd "$HARNESS_DIR" && pnpm run build); then
      ok "framework build complete"
    else
      bad "pnpm run build failed — fix the error above and re-run ./setup.sh"
      PREREQ_WARNINGS+=("harness build")
      return 1
    fi
  fi

  local need_repair=0 violations
  if [ ! -f "$SOC_CLIENT_LIB" ]; then
    warn "SOC client bundle artifact is missing"
    need_repair=1
  else
    violations="$(client_external_violations)"
    if [ -n "$violations" ]; then
      warn "SOC client bundle artifact drifted — browser-unservable external requires:"
      printf '%s\n' "$violations"
      need_repair=1
    fi
  fi
  if [ "$need_repair" = 1 ]; then
    echo "Rebuilding packages/soc-agent-client against the built framework…"
    if (cd "$HARNESS_DIR" && pnpm --filter dsh-soc-agent-client run build); then
      ok "SOC client bundle rebuilt"
    else
      bad "SOC client rebuild failed"
      PREREQ_WARNINGS+=("SOC client artifact")
      return 1
    fi
    violations="$(client_external_violations)"
    if [ ! -f "$SOC_CLIENT_LIB" ] || [ -n "$violations" ]; then
      bad "SOC client bundle is still unhealthy after rebuild"
      PREREQ_WARNINGS+=("SOC client artifact")
      return 1
    fi
  fi
  ok "SOC client bundle artifact verified"
}

# --- profile wiring ---------------------------------------------------------
#
# The SOC product (login, admin host, MCP bridge, memory, scheduler, settings
# UI) only exists when `apps/soc-agent/cordis.patch.yml` is part of the boot
# composition. The supported wiring registers the product bundle in the
# harness `web` profile so a plain `pnpm dsh web` boots it:
#
#   1. `dsh plugin --profile web add` links `apps/soc-agent` (and the client
#      package) into the profile and appends `dsh-soc-agent` to the bundle
#      layer stack.
#   2. `@citic/soc-memory` must resolve as a bare name from the profile, but
#      it must NOT be registered as a bundle: its own `dsh.bundle` patch would
#      replace the product's `soc-memory` row (id-targeted patches replace the
#      whole config). A plain symlink in the profile's node_modules provides
#      resolution without becoming a layer. pnpm may prune that link on a
#      future profile install; ensure_soc_bundle re-creates it on every run.

profile_dir() {
  printf '%s/profiles/%s' "${DSH_HOME:-$HOME/.dsh}" "$DSH_PROFILE"
}

profile_has_dependency() {
  node -e '
    const fs = require("fs");
    try {
      const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      process.exit(Object.prototype.hasOwnProperty.call(manifest.dependencies || {}, process.argv[2]) ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$1" "$2"
}

profile_has_bundle() {
  node -e '
    const fs = require("fs");
    try {
      const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const bundles = manifest.dsh?.profile?.bundles || [];
      process.exit(bundles.includes(process.argv[2]) ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$1" "$2"
}

ensure_profile_patch() {
  local pdir workspace target patch_entry tmp
  pdir="$(profile_dir)"
  workspace="$pdir/pnpm-workspace.yaml"
  target="$pdir/patches/$(basename "$PLUGIN_PATCH")"
  patch_entry='  dsh-auto-collapse@0.1.4: patches/dsh-auto-collapse@0.1.4.patch'

  mkdir -p "$pdir/patches"
  if [ -e "$target" ]; then
    if ! cmp -s "$PLUGIN_PATCH" "$target"; then
      bad "profile patch differs from the repository copy: $target"
      return 1
    fi
  elif ! cp "$PLUGIN_PATCH" "$target"; then
    bad "could not copy the dsh-auto-collapse patch into the profile"
    return 1
  fi

  if [ ! -f "$workspace" ]; then
    printf '%s\n' \
      'packages:' \
      '  - .' \
      '' \
      'nodeLinker: hoisted' \
      'autoInstallPeers: false' \
      '' \
      'patchedDependencies:' \
      "$patch_entry" > "$workspace"
    return 0
  fi

  if grep -Fqx "$patch_entry" "$workspace"; then
    return 0
  fi
  if grep -q '^[[:space:]]*dsh-auto-collapse@0\.1\.4:' "$workspace"; then
    bad "profile pnpm-workspace.yaml has a different dsh-auto-collapse patch entry"
    return 1
  fi

  if grep -q '^patchedDependencies:[[:space:]]*$' "$workspace"; then
    tmp="$(mktemp "${workspace}.XXXXXX")"
    if awk -v entry="$patch_entry" '
      /^patchedDependencies:[[:space:]]*$/ { print; in_patched=1; next }
      in_patched && /^[^[:space:]#]/ { print entry; in_patched=0 }
      { print }
      END { if (in_patched) print entry }
    ' "$workspace" > "$tmp" && mv "$tmp" "$workspace"; then
      return 0
    fi
    rm -f "$tmp"
    bad "could not register the dsh-auto-collapse patch in $workspace"
    return 1
  fi
  if grep -q '^patchedDependencies:' "$workspace"; then
    bad "cannot update inline patchedDependencies in $workspace"
    return 1
  fi

  printf '\npatchedDependencies:\n%s\n' "$patch_entry" >> "$workspace"
}

verify_external_profile() {
  local pdir="$1" name all_ok=0 profile_patch
  local patch_entry='  dsh-auto-collapse@0.1.4: patches/dsh-auto-collapse@0.1.4.patch'
  if [ ! -f "$pdir/package.json" ]; then
    bad "DeepSeek Harness profile '$DSH_PROFILE' is missing"
    return 1
  fi

  for name in "${PLUGIN_NAMES[@]}"; do
    if profile_has_dependency "$pdir/package.json" "$name"; then
      ok "external dependency: $name"
    else
      bad "external dependency missing: $name"
      all_ok=1
    fi
    if profile_has_bundle "$pdir/package.json" "$name"; then
      ok "external bundle: $name"
    else
      bad "external bundle missing: $name"
      all_ok=1
    fi
  done

  profile_patch="$pdir/patches/$(basename "$PLUGIN_PATCH")"
  if [ -f "$profile_patch" ] && cmp -s "$PLUGIN_PATCH" "$profile_patch"; then
    ok "dsh-auto-collapse patch copied to the profile"
  else
    bad "dsh-auto-collapse patch is missing or differs in the profile"
    all_ok=1
  fi
  if [ -f "$pdir/pnpm-workspace.yaml" ] \
    && grep -Fqx "$patch_entry" "$pdir/pnpm-workspace.yaml"; then
    ok "dsh-auto-collapse patch registered in the profile"
  else
    bad "dsh-auto-collapse patch is not registered in the profile"
    all_ok=1
  fi
  return "$all_ok"
}

ensure_external_plugins() {
  local pdir
  echo "${B}DeepSeek Harness external plugins${N}"
  if ! read_plugin_requirements; then
    return 1
  fi

  pdir="$(profile_dir)"
  if ! ensure_profile_patch; then
    return 1
  fi

  echo "Installing external plugin bundles into the '$DSH_PROFILE' profile…"
  if (cd "$HARNESS_DIR" && pnpm dsh plugin --profile "$DSH_PROFILE" add "${PLUGIN_SPECS[@]}"); then
    ok "external plugin installation complete"
  else
    bad "external plugin installation failed"
    return 1
  fi
  verify_external_profile "$pdir"
}

profile_lists() { # $1=manifest $2=package name -> exit 0 when bundled or depended on
  node -e '
    const fs = require("fs");
    try {
      const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const bundles = (m.dsh && m.dsh.profile && m.dsh.profile.bundles) || [];
      const deps = Object.keys(m.dependencies || {});
      process.exit(bundles.includes(process.argv[2]) || deps.includes(process.argv[2]) ? 0 : 1);
    } catch { process.exit(1); }
  ' "$1" "$2"
}

verify_profile_resolution() { # $1 = profile dir; prints one line per plugin name
  local anchor="$1/package.json" spec all_ok=0
  # Harness-owned names need not resolve from the profile on a never-booted
  # machine: the first boot heals $DSH_HOME/profiles/node_modules from the
  # installation's dependency closure before mounting anything. For them,
  # resolvability from the install anchor is the correct boot-readiness test.
  local harness_anchor="$HARNESS_DIR/apps/cli/package.json"
  for spec in \
    dsh-soc-agent/auth-host \
    dsh-soc-agent/host \
    dsh-soc-agent/scheduler \
    dsh-soc-agent-client \
    @citic/soc-memory \
    @deepseek-ai/dsh-time-context \
    @linxin666/dsh-client-ui-skin-center \
    dsh-auto-collapse
  do
    if node -e '
      const { createRequire } = require("module");
      try { createRequire(process.argv[1]).resolve(process.argv[2]); }
      catch { process.exit(1); }
    ' "$anchor" "$spec" \
      || node -e '
        const { createRequire } = require("module");
        try { createRequire(process.argv[1]).resolve(process.argv[2]); }
        catch { process.exit(1); }
      ' "$harness_anchor" "$spec"; then
      ok "resolves: $spec"
    else
      bad "cannot resolve: $spec"
      all_ok=1
    fi
  done
  return "$all_ok"
}

ensure_soc_bundle() {
  local pdir
  pdir="$(profile_dir)"

  echo "${B}Harness profile (SOC product bundle)${N}"

  if [ ! -d "$HARNESS_DIR/node_modules" ]; then
    warn "harness dependencies are not installed — run:"
    warn "  cd vendor/deepseek-harness && pnpm install --frozen-lockfile"
    warn "then re-run ./setup.sh to wire the SOC bundle into the profile."
    PREREQ_WARNINGS+=("harness profile wiring")
    return 1
  fi

  if profile_lists "$pdir/package.json" "dsh-soc-agent" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-client"; then
    ok "SOC bundle already registered in the '$DSH_PROFILE' profile"
  else
    echo "Registering the SOC product bundle in the '$DSH_PROFILE' profile…"
    if (cd "$HARNESS_DIR" && pnpm dsh plugin --profile "$DSH_PROFILE" add \
        "$REPO_ROOT/apps/soc-agent" "$REPO_ROOT/packages/soc-agent-client" 2>&1 | tail -n 3); then
      ok "installed dsh-soc-agent and dsh-soc-agent-client"
    else
      bad "could not install the SOC bundle into the harness profile (see output above)"
      PREREQ_WARNINGS+=("harness profile wiring")
      return 1
    fi
  fi

  # Resolution-only link: never a bundle layer (see the section comment).
  local mem_link="$pdir/node_modules/@citic/soc-memory"
  if [ -L "$mem_link" ] && [ "$(readlink "$mem_link")" = "$REPO_ROOT/packages/soc-memory" ]; then
    ok "@citic/soc-memory resolvable from the profile"
  else
    mkdir -p "$(dirname "$mem_link")"
    ln -sfn "$REPO_ROOT/packages/soc-memory" "$mem_link"
    ok "linked @citic/soc-memory into the profile (resolution only)"
  fi

  if verify_profile_resolution "$pdir"; then
    ok "every SOC plugin name resolves from the profile"
  else
    warn "the boot would fail on unresolved plugin names — fix the failures above and re-run ./setup.sh"
    PREREQ_WARNINGS+=("SOC plugin resolution")
    return 1
  fi
}

# ------------------------------------------------------------ reporting ---

mask() { # $1=value
  local v="$1"
  if [ -z "$v" ]; then printf '(empty)'
  elif [ "${#v}" -le 8 ]; then printf '****'
  else printf '%s…(%s chars)' "${v:0:4}" "${#v}"
  fi
}

summary() {
  echo "${B}Setup complete — written values${N}"
  printf '  %-32s %s\n' "APP_POSTGRES_URI" "${VALUES[APP_POSTGRES_URI]}"
  printf '  %-32s %s\n' "APP_SETTINGS_ENCRYPTION_KEY" "$(mask "${VALUES[APP_SETTINGS_ENCRYPTION_KEY]}")"
  if [ -n "${VALUES[SPLUNK_URL]-}" ]; then
    printf '  %-32s %s\n' "Splunk URL" "${VALUES[SPLUNK_URL]}"
  else
    printf '  %-32s %s:%s\n' "Splunk" "${VALUES[SPLUNK_HOST]}" "${VALUES[SPLUNK_PORT]}"
  fi
  if [ -n "${VALUES[SPLUNK_TOKEN]-}" ]; then
    printf '  %-32s %s\n' "Splunk auth" "token $(mask "${VALUES[SPLUNK_TOKEN]}")"
  else
    printf '  %-32s %s / %s\n' "Splunk auth" "${VALUES[SPLUNK_USERNAME]}" "$(mask "${VALUES[SPLUNK_PASSWORD]}")"
  fi
  printf '  %-32s %s\n' "SPLUNK_VERIFY_SSL" "${VALUES[SPLUNK_VERIFY_SSL]}"
  printf '  %-32s %s\n' "ZIMBRA_HOST" "${VALUES[ZIMBRA_HOST]}"
  printf '  %-32s %s\n' "ZIMBRA_VERIFY_SSL" "${VALUES[ZIMBRA_VERIFY_SSL]}"
  printf '  %-32s %s\n' "SUBSCRIPTION_SERVER_URL" "${VALUES[SUBSCRIPTION_SERVER_URL]}"
  printf '  %-32s %s / %s\n' "Subscription auth" "${VALUES[SUBSCRIPTION_SERVER_USER]}" "$(mask "${VALUES[SUBSCRIPTION_SERVER_PASSWORD]}")"
  printf '  %-32s %s\n' "DEEPSEEK_API_KEY" "$(mask "${VALUES[DEEPSEEK_API_KEY]}")"
  echo
  echo "${B}Files written${N}"
  echo "  $SERVER_ENV          (Python MCP server; chmod 600)"
  echo "  $HARNESS_ENV  (Node harness process; chmod 600)"
  if [ "${#PREREQ_WARNINGS[@]}" -gt 0 ]; then
    echo
    warn "skipped prerequisites: ${PREREQ_WARNINGS[*]} — the app will not boot until they are installed."
  fi
  echo
  echo "${B}Next steps${N}"
  echo "  1. Start the web app:  cd vendor/deepseek-harness && pnpm dsh web --no-open"
  echo "     (the SOC product bundle is registered in the '$DSH_PROFILE' profile —"
  echo "      restart any running instance so it picks the plugins up)"
  echo "  2. Open http://127.0.0.1:3080 (remote: ssh -L 3080:127.0.0.1:3080 usr@ip)"
  echo
  echo "${D}Re-run ./setup.sh any time; --check audits without changing anything,"
  echo "${D}--plugins re-runs install/build/repair/wiring without prompts.${N}"
}

# ------------------------------------------------------------- check mode ---

run_check_mode() {
  local fails=0

  echo "${B}Prerequisites${N}"
  if check_node; then ok "node ($(node -v 2>/dev/null))"; else bad "node ^22.19.0 or >=24.0.0"; fails=$((fails+1)); fi
  if check_pnpm; then ok "pnpm ($(pnpm -v 2>/dev/null))"; else bad "pnpm is not installed (corepack enable)"; fails=$((fails+1)); fi
  if check_uv; then ok "uv ($(uv --version 2>/dev/null))"; else bad "uv is not installed"; fails=$((fails+1)); fi

  echo
  echo "${B}Parameters${N} ${D}(environment > apps/soc-agent/server/.env > vendor/deepseek-harness/.env > .env.example)${N}"

  local v
  v="$(lookup APP_POSTGRES_URI)"
  if is_pg_uri "$v"; then
    if pg_reachable "$v"; then ok "APP_POSTGRES_URI (and psql can connect)"
    else warn "APP_POSTGRES_URI is set but psql cannot connect within 5s"; fi
  else bad "APP_POSTGRES_URI missing or invalid"; fails=$((fails+1)); fi

  if [ -n "$(lookup APP_SETTINGS_ENCRYPTION_KEY)" ]; then ok "APP_SETTINGS_ENCRYPTION_KEY"
  else bad "APP_SETTINGS_ENCRYPTION_KEY missing"; fails=$((fails+1)); fi

  if is_host_or_url "$(lookup SPLUNK_URL)" || is_host_or_url "$(lookup SPLUNK_HOST)"; then
    ok "Splunk host/URL"
  else bad "SPLUNK_URL / SPLUNK_HOST missing or invalid"; fails=$((fails+1)); fi

  if [ -n "$(lookup SPLUNK_TOKEN)" ] || { [ -n "$(lookup SPLUNK_USERNAME)" ] && [ -n "$(lookup SPLUNK_PASSWORD)" ]; }; then
    ok "Splunk credentials (token or username/password)"
  else bad "SPLUNK_TOKEN or SPLUNK_USERNAME+SPLUNK_PASSWORD missing"; fails=$((fails+1)); fi

  if is_http_url "$(lookup ZIMBRA_HOST)"; then ok "ZIMBRA_HOST"
  else bad "ZIMBRA_HOST missing or not an http(s) URL"; fails=$((fails+1)); fi

  if is_http_url "$(lookup SUBSCRIPTION_SERVER_URL)"; then ok "SUBSCRIPTION_SERVER_URL"
  else bad "SUBSCRIPTION_SERVER_URL missing or not an http(s) URL"; fails=$((fails+1)); fi
  if [ -n "$(lookup SUBSCRIPTION_SERVER_USER)" ] && [ -n "$(lookup SUBSCRIPTION_SERVER_PASSWORD)" ]; then
    ok "Subscription server credentials"
  else bad "SUBSCRIPTION_SERVER_USER / SUBSCRIPTION_SERVER_PASSWORD missing"; fails=$((fails+1)); fi

  if [ -n "$(lookup DEEPSEEK_API_KEY)" ]; then ok "DEEPSEEK_API_KEY"
  else bad "DEEPSEEK_API_KEY missing"; fails=$((fails+1)); fi

  echo
  echo "${B}Harness build & profile${N}"
  if read_plugin_requirements; then
    ok "third-party plugin requirements present"
  else
    fails=$((fails+1))
  fi
  local pdir
  pdir="$(profile_dir)"
  if verify_external_profile "$pdir"; then
    :
  else
    fails=$((fails+1))
  fi
  if [ -d "$HARNESS_DIR/node_modules" ]; then
    if [ -f "$HARNESS_DIR/vendor/schemastery/lib/index.cjs" ] && [ -f "$HARNESS_DIR/apps/web/dist/index.html" ]; then
      ok "framework build present"
    else
      bad "framework build incomplete — run: ./setup.sh --plugins"; fails=$((fails+1))
    fi
    if [ -f "$SOC_CLIENT_LIB" ]; then
      local viol
      viol="$(client_external_violations)"
      if [ -z "$viol" ]; then
        ok "SOC client bundle artifact healthy"
      else
        bad "SOC client bundle artifact drifted — run: ./setup.sh --plugins"; fails=$((fails+1))
      fi
    else
      bad "SOC client bundle artifact missing — run: ./setup.sh --plugins"; fails=$((fails+1))
    fi
    if profile_lists "$pdir/package.json" "dsh-soc-agent"; then
      ok "dsh-soc-agent registered in the '$DSH_PROFILE' profile"
    else
      bad "SOC bundle not registered — run: ./setup.sh --plugins"; fails=$((fails+1))
    fi
    if verify_profile_resolution "$pdir"; then
      :
    else
      fails=$((fails+1))
    fi
  else
    warn "harness dependencies not installed — build/profile not auditable yet (run: ./setup.sh --plugins)"
  fi

  echo
  if [ "$fails" -gt 0 ]; then
    bad "$fails item(s) need attention — run ./setup.sh to fix them interactively."
    exit 1
  fi
  echo "${G}Everything required is set up.${N}"
}

# ---------------------------------------------------------------- main ---

load_env_file "$SERVER_ENV_EXAMPLE"
load_env_file "$HARNESS_ENV"
load_env_file "$SERVER_ENV"

case "${1:-}" in
  --check)
    run_check_mode
    exit 0
    ;;
  --plugins)
    echo "${B}SOC Agent setup doctor — install, build, repair, wire${N}"
    run_prereq_checks
    ensure_python_server || true
    ensure_harness_ready || true
    if ! ensure_external_plugins; then
      exit 1
    fi
    ensure_soc_bundle || true
    exit 0
    ;;
  "")
    echo "${B}SOC Agent setup doctor${N}"
    run_prereq_checks
    collect_parameters
    write_files
    ensure_python_server || true
    ensure_harness_ready || true
    if ! ensure_external_plugins; then
      exit 1
    fi
    ensure_soc_bundle || true
    echo
    summary
    ;;
  *)
    echo "usage: $0 [--check|--plugins]" >&2
    exit 2
    ;;
esac
