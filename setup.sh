#!/usr/bin/env bash
#
# SOC Agent setup doctor.
#
# Checks prerequisites (node, pnpm, uv) and every required runtime parameter
# (PostgreSQL, admin console credentials, settings encryption key, Splunk,
# Zimbra, and subscription server). Anything missing or invalid is re-prompted,
# while optional MarkItDown LLM configuration is checked when enabled,
# then the collected values are written to the two env files the app reads:
#
#   apps/soc-agent/server/.env      deployment config and Node admin credentials
#   vendor/deepseek-harness/.env    Node harness process (loaded at `pnpm dsh web`)
#
# Existing values (current shell, existing .env files, .env.example) are kept
# and used as defaults; only broken or missing parameters are asked for.
#
# Usage:
#   Fresh machine, from anywhere — the script clones the repository into an
#   install path of the user's choice, then runs the full setup inside it:
#     curl -fsSL https://raw.githubusercontent.com/Benchan691/CITIC_AGENT/main/setup.sh -o setup.sh
#     bash setup.sh
#   ./setup.sh            interactive: check, re-ask until valid, write files,
#                         install/build the harness, repair drifted artifacts,
#                         wire the profile, and choose the repository branch
#                         interactively
#   ./setup.sh --check    report only; exits 1 when something is missing
#   ./setup.sh --plugins  non-interactive: install, build, repair, wire profile

set -euo pipefail

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

# ------------------------------------------------------------ layout ----

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_URL="https://github.com/Benchan691/CITIC_AGENT.git"
DEFAULT_REPO_BRANCH="main"

# Branch selection is interactive for a normal setup. Bootstrap passes the
# selected value through this private environment variable so the checked-out
# copy does not ask the same question a second time.
REPO_BRANCH="${CITIC_SETUP_SELECTED_BRANCH:-}"
BRANCH_SELECTED=0
if [ -n "$REPO_BRANCH" ]; then BRANCH_SELECTED=1; fi
unset CITIC_SETUP_SELECTED_BRANCH

validate_branch() {
  local branch="$1"
  if [ -n "$branch" ] && git check-ref-format --branch "$branch" >/dev/null 2>&1; then
    return 0
  fi
  bad "invalid Git branch name: ${branch:-<empty>}"
  return 1
}

ensure_branch() {
  local repo_dir="$1" branch="$2" current remote remote_ref status
  validate_branch "$branch" || return 1
  current="$(git -C "$repo_dir" branch --show-current 2>/dev/null || true)"
  [ "$current" = "$branch" ] && return 0

  status="$(git -C "$repo_dir" status --porcelain --untracked-files=all 2>/dev/null || true)"
  if [ -n "$status" ]; then
    bad "cannot switch $repo_dir to '$branch' because the checkout has local changes"
    return 1
  fi

  if git -C "$repo_dir" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$repo_dir" switch "$branch"
    return $?
  fi

  remote="$(git -C "$repo_dir" remote | sed -n '1p')"
  if [ -z "$remote" ]; then
    bad "cannot find a Git remote from which to fetch '$branch'"
    return 1
  fi
  remote_ref="refs/remotes/$remote/$branch"
  if ! git -C "$repo_dir" show-ref --verify --quiet "$remote_ref"; then
    if ! git -C "$repo_dir" fetch "$remote" "refs/heads/$branch:$remote_ref"; then
      bad "could not fetch branch '$branch' from remote '$remote'"
      return 1
    fi
  fi
  git -C "$repo_dir" switch --track -c "$branch" "$remote/$branch"
}

select_branch() {
  local default_branch="$1" input
  while :; do
    printf 'Repository branch [%s]: ' "$default_branch"
    IFS= read -r input || exit 1
    REPO_BRANCH="${input:-$default_branch}"
    if validate_branch "$REPO_BRANCH"; then return 0; fi
  done
}

# Standalone bootstrap: run this script from anywhere that is not already a
# CITIC_AGENT checkout and it takes responsibility for the whole setup — the
# user picks the install path, the repository is cloned (or an existing
# checkout is reused and fast-forwarded), and the clone's own setup.sh
# re-executes so everything below runs against the checked-out version.
if [ ! -d "$SCRIPT_DIR/vendor/deepseek-harness" ]; then
  echo "${B}SOC Agent setup doctor — bootstrap${N}"
  info "not running inside a CITIC_AGENT checkout — the repository will be installed to a path you choose and the full setup continues there"
  if ! command -v git >/dev/null 2>&1; then
    bad "git is required to clone the repository — install it first (https://git-scm.com/downloads)"
    exit 1
  fi
  printf 'Repository URL [%s]: ' "$DEFAULT_REPO_URL"
  IFS= read -r repo_url || exit 1
  if [ -z "$repo_url" ]; then repo_url="$DEFAULT_REPO_URL"; fi

  target_dir=""
  while :; do
    printf 'Install path [%s/CITIC_AGENT]: ' "$HOME"
    IFS= read -r reply || exit 1
    if [ -z "$reply" ]; then reply="$HOME/CITIC_AGENT"; fi
    case "$reply" in
      "~") reply="$HOME" ;;
      "~"/*) reply="$HOME${reply#\~}" ;;
      "~"*) reply="$HOME${reply#\~}" ;;
    esac
    case "$reply" in
      "/*") : ;;
      "/"*) : ;;
      *) reply="$PWD/$reply" ;;
    esac
    target_dir="$reply"
    if [ ! -e "$target_dir" ]; then
      break
    fi
    if [ -d "$target_dir/.git" ] && [ -f "$target_dir/setup.sh" ]; then
      printf '%s already contains a CITIC_AGENT checkout — reuse and fast-forward it? [Y/n]: ' "$target_dir"
      IFS= read -r answer || exit 1
      case "$answer" in
        n*|N*) continue ;;
        *) break ;;
      esac
    else
      warn "$target_dir exists and is not a CITIC_AGENT checkout — choose another path."
    fi
  done

  default_branch="$DEFAULT_REPO_BRANCH"
  if [ -d "$target_dir/.git" ]; then
    existing_branch="$(git -C "$target_dir" branch --show-current 2>/dev/null || true)"
    if [ -n "$existing_branch" ]; then default_branch="$existing_branch"; fi
  fi
  select_branch "$default_branch"

  if [ -d "$target_dir/.git" ]; then
    if ! ensure_branch "$target_dir" "$REPO_BRANCH"; then exit 1; fi
    warn "reusing existing checkout at $target_dir on '$REPO_BRANCH' — fast-forwarding it"
    if ! git -C "$target_dir" pull --ff-only; then
      warn "could not fast-forward the existing checkout — continuing with its current state"
    fi
  else
    echo "Cloning branch '$REPO_BRANCH' from $repo_url into $target_dir …"
    if ! mkdir -p -- "$(dirname -- "$target_dir")"; then
      bad "cannot create the parent directory of $target_dir"
      exit 1
    fi
    if ! git clone --branch "$REPO_BRANCH" "$repo_url" "$target_dir"; then
      bad "git clone failed for branch '$REPO_BRANCH' — check the branch name and repository access"
      exit 1
    fi
  fi
  if [ ! -f "$target_dir/setup.sh" ] || [ ! -d "$target_dir/vendor/deepseek-harness" ]; then
    bad "$target_dir does not look like a CITIC_AGENT checkout (missing setup.sh or vendor/deepseek-harness)"
    exit 1
  fi
  echo "Continuing with the full setup inside $target_dir …"
  echo
  CITIC_SETUP_SELECTED_BRANCH="$REPO_BRANCH" exec bash "$target_dir/setup.sh" "$@"
fi

REPO_ROOT="$SCRIPT_DIR"

if [ "$BRANCH_SELECTED" -eq 0 ] && [ "${1:-}" = "" ]; then
  current_branch="$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || true)"
  default_branch="${current_branch:-$DEFAULT_REPO_BRANCH}"
  select_branch "$default_branch"
  BRANCH_SELECTED=1
fi

if [ "$BRANCH_SELECTED" -eq 1 ]; then
  current_branch="$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || true)"
  if [ "$current_branch" != "$REPO_BRANCH" ]; then
    ensure_branch "$REPO_ROOT" "$REPO_BRANCH" || exit 1
    CITIC_SETUP_SELECTED_BRANCH="$REPO_BRANCH" exec bash "$REPO_ROOT/setup.sh" "$@"
  fi
fi

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

# Browser-facing SOC artifacts. This is the one authoritative matrix: every
# row supplies the package name used by pnpm/profile wiring, its repository
# directory, and its browser entry artifact. The derived arrays below are
# consumed by fingerprints, builds, registration, and health checks.
SOC_CLIENT_MATRIX=(
  "dsh-soc-agent-client|soc-agent-client|$REPO_ROOT/packages/soc-agent-client/lib/client.js"
  "dsh-soc-agent-sidebar|soc-agent-sidebar|$REPO_ROOT/packages/soc-agent-sidebar/lib/client.js"
  "dsh-soc-agent-workspace|soc-agent-workspace|$REPO_ROOT/packages/soc-agent-workspace/lib/client.js"
  "dsh-soc-agent-brand|soc-agent-brand|$REPO_ROOT/packages/soc-agent-brand/lib/client.js"
  "dsh-soc-agent-admin|soc-agent-admin|$REPO_ROOT/packages/soc-agent-admin/lib/client.js"
  "dsh-soc-agent-action-policy|soc-agent-action-policy|$REPO_ROOT/packages/soc-agent-action-policy/lib/client.js"
  "dsh-soc-agent-attachments|soc-agent-attachments|$REPO_ROOT/packages/soc-agent-attachments/lib/client.js"
  "dsh-soc-agent-email-draft|soc-agent-email-draft|$REPO_ROOT/packages/soc-agent-email-draft/lib/client.js"
)
SOC_CLIENT_PACKAGE_NAMES=()
SOC_CLIENT_PACKAGE_DIRS=()
SOC_CLIENT_LIBS=()
for soc_client_row in "${SOC_CLIENT_MATRIX[@]}"; do
  IFS='|' read -r soc_client_package soc_client_dir soc_client_lib <<< "$soc_client_row"
  SOC_CLIENT_PACKAGE_NAMES+=("$soc_client_package")
  SOC_CLIENT_PACKAGE_DIRS+=("$soc_client_dir")
  SOC_CLIENT_LIBS+=("$soc_client_lib")
done

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

# Direct profile dependencies setup.sh owns besides the external plugins:
# the SOC product bundle and its eight browser packages (wired by
# ensure_soc_bundle).
# Any other direct dependency found in the profile manifest is stale and gets
# pruned (see prune_stale_plugins) — so removing a plugin from
# requirements.txt propagates to every machine on the next setup run.
SOC_MANAGED_DEPS=(
  dsh-soc-agent
  dsh-soc-agent-client
  dsh-soc-agent-sidebar
  dsh-soc-agent-workspace
  dsh-soc-agent-brand
  dsh-soc-agent-admin
  dsh-soc-agent-action-policy
  dsh-soc-agent-attachments
  dsh-soc-agent-email-draft
)

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

is_bool_value() {
  case "${1,,}" in
    1|yes|true|on|0|no|false|off) return 0 ;;
  esac
  REASON="must be true or false"
  return 1
}

is_http_url() {
  if [[ "$1" =~ ^https?://[^[:space:]]+$ ]]; then return 0; fi
  REASON="must be a URL starting with http:// or https:// (no spaces)"
  return 1
}

is_mcp_endpoint() {
  is_http_url "$1" || return 1
  local authority="${1#*://}" port authority_pattern='^([a-zA-Z0-9._-]+|\[[0-9a-fA-F:.]+\])(:([0-9]+))?$'
  authority="${authority%%/*}"
  REASON="must be an HTTP(S) URL without credentials, a query, or a fragment"
  case "$1" in *'?'*|*'#'*|*'\'*) return 1 ;; esac
  [[ "$authority" =~ $authority_pattern ]] || return 1
  port="${BASH_REMATCH[3]-}"
  if [ -n "$port" ]; then
    port="${port#"${port%%[!0]*}"}"
    if [ -z "$port" ] || [ "${#port}" -gt 5 ] || [ "$port" -gt 65535 ]; then return 1; fi
  fi
  # Setup permits skipping unavailable prerequisites. The authority check above
  # still works then; the runtime applies its full URL parser before connecting.
  command -v node >/dev/null 2>&1 || return 0
  if node - "$1" <<'NODE'
try {
  const url = new URL(process.argv[2]);
  if (!url.hostname || url.username || url.password || url.search || url.hash) process.exit(1);
} catch { process.exit(1); }
NODE
  then return 0; fi
  return 1
}

is_pg_uri() {
  if [[ "$1" =~ ^postgres(ql)?://[^[:space:]]+$ ]]; then return 0; fi
  REASON="must look like postgresql://user:password@host:5432/dbname"
  return 1
}

is_true() {
  case "${1,,}" in 1|yes|true|on) return 0 ;; esac
  return 1
}

# Best-effort connectivity probe; skipped when psql is unavailable.
pg_reachable() {
  command -v psql >/dev/null 2>&1 || return 0
  PGCONNECT_TIMEOUT=5 psql "$1" -c 'SELECT 1;' >/dev/null 2>&1 </dev/null
}

# ------------------------------------------------------ prompt helpers ---

declare -A VALUES=()

# name | label | validator | default | secret | enabled-by | HTTP opt-in
# These definitions drive prompting, --check, writing, and the redacted summary.
SETUP_FIELDS=()
declare -A FIELD_LABEL=() FIELD_VALIDATOR=() FIELD_DEFAULT=() FIELD_SECRET=() FIELD_ENABLED=() FIELD_HTTP=()
while IFS='|' read -r key label validator default secret enabled http; do
  SETUP_FIELDS+=("$key")
  FIELD_LABEL[$key]="$label"; FIELD_VALIDATOR[$key]="$validator"
  FIELD_DEFAULT[$key]="$default"; FIELD_SECRET[$key]="$secret"
  FIELD_ENABLED[$key]="$enabled"; FIELD_HTTP[$key]="$http"
done <<'FIELDS'
APP_POSTGRES_URI|PostgreSQL URI|is_pg_uri||secret||
APP_SETTINGS_ENCRYPTION_KEY|Settings encryption key|is_nonempty||secret||
SOC_ADMIN_EMAIL|Admin console email|is_nonempty||||
SOC_ADMIN_PASSWORD|Admin console password|is_nonempty||secret||
SPLUNK_VERIFY_SSL|Verify Splunk TLS certificate|is_bool_value|true|||
SPLUNK_ALLOW_INSECURE_HTTP|Allow Splunk over plain HTTP|is_bool_value|false|||
SPLUNK_MCP_ENDPOINT|Official Splunk MCP endpoint|is_mcp_endpoint||||SPLUNK_ALLOW_INSECURE_HTTP
SPLUNK_TOKEN|Splunk MCP bearer token|is_nonempty||secret||
SPLUNK_SANITIZE_OUTPUT|Sanitize Splunk results|is_bool_value|true|||
ZIMBRA_VERIFY_SSL|Verify Zimbra TLS certificate|is_bool_value|true|||
ZIMBRA_ALLOW_INSECURE_HTTP|Allow Zimbra over plain HTTP|is_bool_value|false|||
ZIMBRA_HOST|Zimbra server URL|is_http_url||||ZIMBRA_ALLOW_INSECURE_HTTP
SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP|Allow subscription server over plain HTTP|is_bool_value|false|||
SUBSCRIPTION_SERVER_URL|Subscription server URL|is_http_url||||SUBSCRIPTION_SERVER_ALLOW_INSECURE_HTTP
SUBSCRIPTION_SERVER_USER|Subscription server username|is_nonempty||||
SUBSCRIPTION_SERVER_PASSWORD|Subscription server password|is_nonempty||secret||
MARKITDOWN_LLM_ENABLED|Enable MarkItDown LLM/OCR conversion|is_bool_value|false|||
MARKITDOWN_LLM_API_KEY|MarkItDown LLM API key|is_nonempty||secret|MARKITDOWN_LLM_ENABLED|
MARKITDOWN_LLM_MODEL|MarkItDown LLM model|is_nonempty|||MARKITDOWN_LLM_ENABLED|
FIELDS
unset key label validator default secret enabled http

parameter_value() {
  local key="$1" value
  if [ -n "${VALUES[$key]+x}" ]; then printf '%s' "${VALUES[$key]}"; return; fi
  value="$(lookup "$key")"
  printf '%s' "${value:-${FIELD_DEFAULT[$key]}}"
}

parameter_enabled() {
  local enabled="${FIELD_ENABLED[$1]}"
  [ -z "$enabled" ] || is_true "$(parameter_value "$enabled")"
}

validate_parameter() {
  local key="$1" value="$2" allow_name="${FIELD_HTTP[$1]}"
  "${FIELD_VALIDATOR[$key]}" "$value" || return 1
  if [ -n "$allow_name" ] && [[ "$value" == http://* ]] && ! is_true "$(parameter_value "$allow_name")"; then
    REASON="uses http:// but $allow_name is not true"
    return 1
  fi
}

ask_parameter() {
  local key="$1" label="${FIELD_LABEL[$1]}" secret="${FIELD_SECRET[$1]}" default input
  default="$(parameter_value "$key")"
  while :; do
    if [ "$key" = APP_SETTINGS_ENCRYPTION_KEY ] && [ -z "$default" ]; then
      printf '%s [press Enter to generate a secure key]: ' "$label" >&2
    elif [ -n "$secret" ] && [ -n "$default" ]; then
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
    input="$(trim "${input%$'\r'}")"
    input="${input:-$default}"
    if [ "$key" = APP_SETTINGS_ENCRYPTION_KEY ] && [ -z "$input" ]; then input="$(generate_key)"; fi
    if validate_parameter "$key" "$input"; then
      if [ "${FIELD_VALIDATOR[$key]}" = is_bool_value ]; then
        if is_true "$input"; then input=true; else input=false; fi
      fi
      VALUES[$key]="$input"
      return 0
    fi
    printf '%s  invalid: %s. Please type it again.%s\n' "$Y" "$REASON" "$N" >&2
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
  echo "${B}Required parameters${N} ${D}(Enter keeps the current value)${N}"
  echo
  local key answer
  for key in "${SETUP_FIELDS[@]}"; do
    parameter_enabled "$key" || continue
    while :; do
      ask_parameter "$key"
      if [ "$key" != APP_POSTGRES_URI ] || pg_reachable "${VALUES[$key]}"; then break; fi
      warn "psql could not connect to that URI within 5s."
      printf 'Type r to re-enter the URI, or k to keep it anyway: ' >&2
      IFS= read -r answer || exit 1
      if [ "${answer%$'\r'}" = k ]; then break; fi
    done
  done
  case "${VALUES[ZIMBRA_HOST]}" in
    *example.com*) warn "ZIMBRA_HOST still looks like a placeholder — set your real Zimbra server before going live." ;;
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
    # Optional settings are only written when collection supplied a value;
    # an existing line remains untouched otherwise.
    if [ -z "${VALUES[$k]+x}" ]; then continue; fi
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

  upsert_env_file "$SERVER_ENV" "${SETUP_FIELDS[@]}"

  if [ ! -f "$HARNESS_ENV" ]; then
    printf '# Loaded by the DeepSeek Harness boot when `pnpm dsh web` runs from\n# vendor/deepseek-harness (cwd .env layer). Managed by setup.sh.\n' > "$HARNESS_ENV"
    info "created $HARNESS_ENV"
  fi
  upsert_env_file "$HARNESS_ENV" \
    APP_POSTGRES_URI APP_SETTINGS_ENCRYPTION_KEY

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
#      a hard prerequisite for healthy SOC browser bundles: the vendored
#      package is inline-only in browser bundles, and a bundle built before
#      its lib/ exists silently emits require("@deepseek-ai/schemastery"),
#      which the browser module table can never answer ("missed the module
#      table" at boot).
#   3. The browser-facing SOC package artifacts are drift-free. Browser
#      packages can be rebuilt during
#      EVERY pnpm install — on a fresh clone that runs before schemastery exists,
#      so the committed healthy artifact gets overwritten with a drifted one.
#      The guard below detects that case (and missing new-package artifacts)
#      and repairs every SOC bundle after the framework build, when inlining
#      succeeds.
#
# The wiring itself (registering the product bundle in the harness `web`
# profile) then follows in ensure_soc_bundle.

# Specifiers a SOC browser bundle may require externally (module-table rows).
# Anything else found as a literal require() in a SOC browser bundle is drift.
client_external_violations() { # $1 = SOC browser bundle path
  local allow='^(react|react/jsx-runtime|react-dom|react-dom/client|@deepseek-ai/cordis|@deepseek-ai/dsh-client-ui-slots|@deepseek-ai/dsh-client-ui-primitives|@deepseek-ai/dsh-client-runtime/client)$'
  grep -o 'require("[^"]*")' "$1" 2>/dev/null \
    | sed -e 's/^require("//' -e 's/")$//' \
    | sort -u \
    | grep -vE "$allow" || true
}

verify_soc_client_artifacts() {
  local all_ok=0 index package lib violations
  for index in "${!SOC_CLIENT_PACKAGE_NAMES[@]}"; do
    package="${SOC_CLIENT_PACKAGE_NAMES[$index]}"
    lib="${SOC_CLIENT_LIBS[$index]}"
    if [ ! -f "$lib" ]; then
      bad "$package bundle artifact missing — run: ./setup.sh --plugins"
      all_ok=1
      continue
    fi
    violations="$(client_external_violations "$lib")"
    if [ -n "$violations" ]; then
      bad "$package bundle artifact drifted — browser-unservable external requires: $violations"
      all_ok=1
    else
      ok "$package bundle artifact healthy"
    fi
  done
  return "$all_ok"
}

ensure_python_server() {
  local markitdown_enabled exported_markitdown
  exported_markitdown="$(env_value MARKITDOWN_LLM_ENABLED)"
  if [ -n "$exported_markitdown" ]; then
    markitdown_enabled="$exported_markitdown"
  elif [ -n "${VALUES[MARKITDOWN_LLM_ENABLED]+x}" ]; then
    markitdown_enabled="${VALUES[MARKITDOWN_LLM_ENABLED]}"
  else
    markitdown_enabled="$(lookup MARKITDOWN_LLM_ENABLED)"
  fi

  local -a sync_args=(sync --python 3.12)
  case "${markitdown_enabled,,}" in
    1|y|yes|true|on) sync_args+=(--extra markitdown-llm) ;;
  esac

  echo "${B}Python MCP server environment${N}"
  echo "Syncing Python dependencies (uv ${sync_args[*]}) — this can take a few minutes…"
  if (cd "$SERVER_DIR" && uv "${sync_args[@]}"); then
    ok "Python environment ready"
  else
    bad "uv sync failed — run: cd apps/soc-agent/server && uv ${sync_args[*]}"
    PREREQ_WARNINGS+=("Python MCP environment")
    return 1
  fi
}

# Incremental build state (Phase 5): content fingerprints of everything the
# harness install and build consume. Markers live under .data/ (gitignored).
BUILD_STATE_DIR="$REPO_ROOT/.data"
HARNESS_INSTALL_MARKER="$BUILD_STATE_DIR/harness-install.sha256"
HARNESS_BUILD_MARKER="$BUILD_STATE_DIR/harness-build.sha256"
FORCE_REBUILD="${FORCE_REBUILD:-0}"

harness_source_fingerprint() {
  # Content hash of every harness build input: framework sources, package
  # manifests, configs, and all SOC browser package sources bound into bundles.
  # Content-based (not mtime) so checkouts and pulls do not force rebuilds.
  (
    cd "$HARNESS_DIR" && find packages apps scripts \
      -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \
      -o -name '*.css' -o -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) \
      -not -path '*/node_modules/*' -not -path '*/lib/*' -not -path '*/dist/*' \
      -print0 2>/dev/null | sort -z | xargs -0 -r sha256sum
    for index in "${!SOC_CLIENT_PACKAGE_NAMES[@]}"; do
      package_dir="${SOC_CLIENT_PACKAGE_DIRS[$index]}"
      cd "$REPO_ROOT/packages/$package_dir" && find src tests \
        -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.json' \) \
        -print0 2>/dev/null | sort -z | xargs -0 -r sha256sum
      for soc_client_metadata in tsdown.config.ts tsconfig.json tsconfig.types.json package.json snapshot-baseline.json; do
        if [ -f "$soc_client_metadata" ]; then sha256sum "$soc_client_metadata"; fi
      done
    done
  ) 2>/dev/null | sha256sum | awk '{print $1}'
}

harness_install_fingerprint() {
  {
    sha256sum "$HARNESS_DIR/pnpm-lock.yaml" 2>/dev/null || true
    sha256sum "$REPO_ROOT/apps/soc-agent/package.json" 2>/dev/null || true
    for package_dir in "${SOC_CLIENT_PACKAGE_DIRS[@]}"; do
      sha256sum "$REPO_ROOT/packages/$package_dir/package.json" 2>/dev/null || true
    done
  } | sha256sum | awk '{print $1}'
}

ensure_harness_ready() {
  echo "${B}Harness build${N}"
  mkdir -p "$BUILD_STATE_DIR"

  local install_fingerprint install_recorded
  install_fingerprint="$(harness_install_fingerprint)"
  install_recorded="$(cat "$HARNESS_INSTALL_MARKER" 2>/dev/null || true)"
  if [ "$FORCE_REBUILD" != "1" ] && [ -n "$install_recorded" ] \
    && [ "$install_recorded" = "$install_fingerprint" ] \
    && [ -d "$HARNESS_DIR/node_modules" ]; then
    info "dependency graph unchanged since the last install — skipping pnpm install"
  else
    echo "Installing/verifying harness dependencies — this can take a few minutes…"
    if (cd "$HARNESS_DIR" && pnpm install --frozen-lockfile); then
      ok "harness dependencies ready"
      printf '%s' "$install_fingerprint" > "$HARNESS_INSTALL_MARKER"
    else
      bad "pnpm install failed — fix the error above and re-run ./setup.sh"
      PREREQ_WARNINGS+=("harness build")
      return 1
    fi
  fi

  local source_fingerprint build_recorded source_changed=1
  source_fingerprint="$(harness_source_fingerprint)"
  build_recorded="$(cat "$HARNESS_BUILD_MARKER" 2>/dev/null || true)"
  if [ "$FORCE_REBUILD" != "1" ] && [ -n "$build_recorded" ] \
    && [ "$build_recorded" = "$source_fingerprint" ] \
    && [ -f "$HARNESS_DIR/apps/web/dist/index.html" ] \
    && [ -f "$HARNESS_DIR/packages/mcp/mcp-client/lib/index.js" ]; then
    source_changed=0
    info "harness sources unchanged since the last build — skipping pnpm run build"
  else
    echo "Building the harness (framework libs, SOC browser bundles, and web dist) — this can take several minutes…"
    if (cd "$HARNESS_DIR" && pnpm run build); then
      ok "framework build complete"
      printf '%s' "$source_fingerprint" > "$HARNESS_BUILD_MARKER"
    else
      bad "pnpm run build failed — fix the error above and re-run ./setup.sh"
      PREREQ_WARNINGS+=("harness build")
      return 1
    fi
  fi

  local need_repair="$source_changed" index package lib violations
  for index in "${!SOC_CLIENT_PACKAGE_NAMES[@]}"; do
    package="${SOC_CLIENT_PACKAGE_NAMES[$index]}"
    lib="${SOC_CLIENT_LIBS[$index]}"
    if [ ! -f "$lib" ]; then
      warn "$package bundle artifact is missing"
      need_repair=1
    else
      violations="$(client_external_violations "$lib")"
      if [ -n "$violations" ]; then
        warn "$package bundle artifact drifted — browser-unservable external requires: $violations"
        need_repair=1
      fi
    fi
  done
  if [ "$need_repair" = 1 ]; then
    echo "Rebuilding the SOC browser bundles against the built framework…"
    for package in "${SOC_CLIENT_PACKAGE_NAMES[@]}"; do
      if (cd "$HARNESS_DIR" && pnpm --filter "$package" run build); then
        ok "$package bundle rebuilt"
      else
        bad "$package bundle rebuild failed"
        PREREQ_WARNINGS+=("$package artifact")
        return 1
      fi
    done
    if verify_soc_client_artifacts; then
      :
    else
      bad "one or more SOC browser bundles are still unhealthy after rebuild"
      PREREQ_WARNINGS+=("SOC browser artifacts")
      return 1
    fi
  fi
  ok "SOC browser bundle artifacts verified"
}

# --- profile wiring ---------------------------------------------------------
#
# The SOC product (login, admin host, MCP bridge, settings UI) only
# exists when `apps/soc-agent/cordis.patch.yml` is part of the boot
# composition. The supported wiring registers the product bundle in the
# harness `web` profile so a plain `pnpm dsh web` boots it:
#
  #   1. `dsh plugin --profile web add` links `apps/soc-agent` and all SOC
  #      browser packages into the profile and appends `dsh-soc-agent` to the bundle
#      layer stack.

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

# Direct dependency names of the profile manifest that are NOT in the managed
# set (external plugins + SOC packages) — printed one per line. In-box bundle
# layers (dsh-base, dsh-web-app) are not dependencies and never appear here.
stale_plugin_names() { # $1 = profile dir
  local -A expected=()
  local name
  for name in "${PLUGIN_NAMES[@]}" "${SOC_MANAGED_DEPS[@]}"; do
    expected["$name"]=1
  done
  node -e '
    const fs = require("fs");
    try {
      const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      console.log(Object.keys(m.dependencies || {}).join("\n"));
    } catch {}
  ' "$1/package.json" | while IFS= read -r name; do
    if [ -z "$name" ]; then continue; fi
    if [ -z "${expected[$name]+x}" ]; then printf '%s\n' "$name"; fi
  done
}

# Remove direct profile dependencies that requirements.txt no longer lists.
# `pnpm dsh plugin remove` clears the dependency and node_modules, but its
# reconciliation has been observed to leave the dsh.profile.bundles layer
# entry behind — the manifest cleanup below guarantees the plugin cannot boot
# again either way.
prune_stale_plugins() { # $1 = profile dir
  local pdir="$1" stale name
  stale="$(stale_plugin_names "$pdir")"
  if [ -z "$stale" ]; then
    ok "no stale external plugins in the profile"
    return 0
  fi
  local -a stale_arr=()
  while IFS= read -r name; do
    [ -n "$name" ] && stale_arr+=("$name")
  done <<< "$stale"
  warn "no longer listed in $PLUGIN_REQUIREMENTS — removing: ${stale_arr[*]}"
  if ! (cd "$HARNESS_DIR" && pnpm dsh plugin --profile "$DSH_PROFILE" remove "${stale_arr[@]}"); then
    bad "failed to remove stale plugins: ${stale_arr[*]}"
    return 1
  fi
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const stale = new Set(process.argv.slice(2));
    const m = JSON.parse(fs.readFileSync(path, "utf8"));
    const bundles = m.dsh && m.dsh.profile && m.dsh.profile.bundles;
    if (Array.isArray(bundles)) {
      const kept = bundles.filter((entry) => !stale.has(entry));
      if (kept.length !== bundles.length) {
        m.dsh.profile.bundles = kept;
        fs.writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
      }
    }
  ' "$pdir/package.json" "${stale_arr[@]}"
  for name in "${stale_arr[@]}"; do
    if profile_has_dependency "$pdir/package.json" "$name" || profile_has_bundle "$pdir/package.json" "$name"; then
      bad "stale plugin still present after removal: $name"
      return 1
    fi
  done
  ok "stale plugins removed: ${stale_arr[*]}"
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
  if ! verify_external_profile "$pdir"; then
    return 1
  fi
  prune_stale_plugins "$pdir"
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
    dsh-soc-agent-client \
    dsh-soc-agent-sidebar \
    dsh-soc-agent-workspace \
    dsh-soc-agent-brand \
    dsh-soc-agent-admin \
    dsh-soc-agent-action-policy \
    dsh-soc-agent-attachments \
    dsh-soc-agent-email-draft \
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
    && profile_lists "$pdir/package.json" "dsh-soc-agent-client" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-sidebar" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-workspace" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-brand" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-admin" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-action-policy" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-attachments" \
    && profile_lists "$pdir/package.json" "dsh-soc-agent-email-draft"; then
    ok "SOC bundle and browser feature packages already registered in the '$DSH_PROFILE' profile"
  else
    echo "Registering the SOC product bundle in the '$DSH_PROFILE' profile…"
    if (cd "$HARNESS_DIR" && pnpm dsh plugin --profile "$DSH_PROFILE" add \
        "$REPO_ROOT/apps/soc-agent" \
        "$REPO_ROOT/packages/soc-agent-client" \
        "$REPO_ROOT/packages/soc-agent-sidebar" \
        "$REPO_ROOT/packages/soc-agent-workspace" \
        "$REPO_ROOT/packages/soc-agent-brand" \
        "$REPO_ROOT/packages/soc-agent-admin" \
        "$REPO_ROOT/packages/soc-agent-action-policy" \
        "$REPO_ROOT/packages/soc-agent-attachments" \
        "$REPO_ROOT/packages/soc-agent-email-draft" 2>&1 | tail -n 3); then
      ok "installed dsh-soc-agent and all browser feature packages"
    else
      bad "could not install the SOC bundle into the harness profile (see output above)"
      PREREQ_WARNINGS+=("harness profile wiring")
      return 1
    fi
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

summary() {
  echo "${B}Setup complete — written values${N}"
  local key value
  for key in "${SETUP_FIELDS[@]}"; do
    [ -n "${VALUES[$key]+x}" ] || continue
    value="${VALUES[$key]}"
    if [ -n "${FIELD_SECRET[$key]}" ]; then value='[set]'; fi
    printf '  %-40s %s\n' "$key" "$value"
  done
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
  echo "${D}--plugins re-runs install/build/repair/wiring without prompts;"
  echo "${D}--rebuild forces a clean install and build, ignoring the fingerprints.${N}"
}

# ------------------------------------------------------------- check mode ---

check_parameters() {
  local key value fails=0
  for key in "${SETUP_FIELDS[@]}"; do
    parameter_enabled "$key" || continue
    value="$(parameter_value "$key")"
    if validate_parameter "$key" "$value"; then
      ok "$key"
      if [ "$key" = APP_POSTGRES_URI ] && ! pg_reachable "$value"; then
        warn "APP_POSTGRES_URI is set but psql cannot connect within 5s"
      fi
    else
      bad "$key: $REASON"
      fails=$((fails+1))
    fi
  done
  return "$fails"
}

run_check_mode() {
  local fails=0

  echo "${B}Prerequisites${N}"
  if check_node; then ok "node ($(node -v 2>/dev/null))"; else bad "node ^22.19.0 or >=24.0.0"; fails=$((fails+1)); fi
  if check_pnpm; then ok "pnpm ($(pnpm -v 2>/dev/null))"; else bad "pnpm is not installed (corepack enable)"; fails=$((fails+1)); fi
  if check_uv; then ok "uv ($(uv --version 2>/dev/null))"; else bad "uv is not installed"; fails=$((fails+1)); fi

  echo
  echo "${B}Parameters${N} ${D}(environment > apps/soc-agent/server/.env > vendor/deepseek-harness/.env > .env.example)${N}"

  if check_parameters; then :; else fails=$((fails+$?)); fi

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
  local stale_list
  stale_list="$(stale_plugin_names "$pdir")"
  if [ -z "$stale_list" ]; then
    ok "no stale external plugins"
  else
    bad "stale external plugins present: $(printf '%s' "$stale_list" | tr '\n' ' ') — run: ./setup.sh --plugins"; fails=$((fails+1))
  fi
  if [ -d "$HARNESS_DIR/node_modules" ]; then
    if [ -f "$HARNESS_DIR/vendor/schemastery/lib/index.cjs" ] && [ -f "$HARNESS_DIR/apps/web/dist/index.html" ]; then
      ok "framework build present"
    else
      bad "framework build incomplete — run: ./setup.sh --plugins"; fails=$((fails+1))
    fi
    if verify_soc_client_artifacts; then
      :
    else
      fails=$((fails+1))
    fi
    if profile_lists "$pdir/package.json" "dsh-soc-agent" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-client" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-sidebar" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-workspace" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-brand" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-admin" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-action-policy" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-attachments" \
      && profile_lists "$pdir/package.json" "dsh-soc-agent-email-draft"; then
      ok "SOC bundle and browser feature packages registered in the '$DSH_PROFILE' profile"
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

for _arg in "$@"; do
  case "$_arg" in
    --rebuild) FORCE_REBUILD=1 ;;
  esac
done

case "${1:-}" in
  --check)
    run_check_mode
    exit 0
    ;;
  --plugins)
    echo "${B}SOC Agent setup doctor — install, build, repair, wire${N}"
    run_prereq_checks
    ensure_python_server
    ensure_harness_ready
    ensure_external_plugins
    ensure_soc_bundle
    exit 0
    ;;
  "")
    echo "${B}SOC Agent setup doctor${N}"
    run_prereq_checks
    collect_parameters
    write_files
    ensure_python_server
    ensure_harness_ready
    ensure_external_plugins
    ensure_soc_bundle
    echo
    summary
    ;;
  *)
    echo "usage: $0 [--check|--plugins] [--rebuild]" >&2
    exit 2
    ;;
esac
