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
#   .env                            Node Harness launch environment (kept outside vendor)
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
# The upstream checkout is immutable. Keep launch-time secrets in the first-
# party repository root so the pristine vendor tree never gains an .env file.
# The app's own server/.env remains the source for Python/SOC settings.
HARNESS_ENV="$REPO_ROOT/.env"
SERVER_ENV="$SERVER_DIR/.env"
SERVER_ENV_EXAMPLE="$SERVER_DIR/.env.example"

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

# One authoritative inventory for installation, building, profile composition,
# resolution checks, and artifact health checks. Fields are:
# package | repository directory | host/dual face | built artifact | config row
# | mandatory/optional | health check. Optional packages are installed even
# when disabled so enabling them remains configuration-only.
SOC_PACKAGE_MATRIX=(
  "dsh-soc-agent-action-policy|soc-agent-action-policy|dual|lib/client.js|dsh-soc-agent-action-policy|optional|browser"
  "dsh-soc-agent-admin|soc-agent-admin|dual|lib/client.js|dsh-soc-agent-admin|optional|browser"
  "dsh-soc-agent-agent-instructions|soc-agent-agent-instructions|host|lib/index.js|dsh-soc-agent-agent-instructions|mandatory|host"
  "dsh-soc-agent-agent-loop|soc-agent-agent-loop|host|lib/index.js|dsh-soc-agent-agent-loop|mandatory|host"
  "dsh-soc-agent-agent|soc-agent-agent|host|lib/index.js|dsh-soc-agent-agent|mandatory|host"
  "dsh-soc-agent-api-gateway|soc-agent-api-gateway|dual|lib/client.js|dsh-soc-agent-api-gateway|mandatory|browser"
  "dsh-soc-agent-api-remotes|soc-agent-api-remotes|dual|lib/client.js|dsh-soc-agent-api-remotes|mandatory|browser"
  "dsh-soc-agent-api-settings-controller|soc-agent-api-settings-controller|host|lib/index.js|dsh-soc-agent-api-settings-controller|mandatory|host"
  "dsh-soc-agent-api-workspace-files|soc-agent-api-workspace-files|dual|lib/client.js|dsh-soc-agent-api-workspace-files|mandatory|browser"
  "dsh-soc-agent-attachments|soc-agent-attachments|dual|lib/client.js|dsh-soc-agent-attachments|optional|browser"
  "dsh-soc-agent-auto-collapse|soc-agent-auto-collapse|dual|lib/client.js|dsh-soc-agent-auto-collapse|optional|browser"
  "dsh-soc-agent-brand|soc-agent-brand|dual|lib/client.js|dsh-soc-agent-brand|optional|browser"
  "dsh-soc-agent-client|soc-agent-client|dual|lib/client.js|dsh-soc-agent-client|mandatory|browser"
  "dsh-soc-agent-connection|soc-agent-connection|dual|lib/client.js|dsh-soc-agent-connection|mandatory|browser"
  "dsh-soc-agent-email-draft|soc-agent-email-draft|dual|lib/client.js|dsh-soc-agent-email-draft|optional|browser"
  "dsh-soc-agent-file-upload|soc-agent-file-upload|dual|lib/client.js|dsh-soc-agent-file-upload|mandatory|browser"
  "dsh-soc-agent-llm-pi-ai|soc-agent-llm-pi-ai|host|lib/index.js|dsh-soc-agent-llm-pi-ai|mandatory|host"
  "dsh-soc-agent-mcp-client|soc-agent-mcp-client|host|lib/index.js|dsh-soc-agent-mcp-client|mandatory|host"
  "dsh-soc-agent-session-controller|soc-agent-session-controller|dual|lib/client.js|dsh-soc-agent-session-controller|mandatory|browser"
  "dsh-soc-agent-session-log-export|soc-agent-session-log-export|dual|lib/client.js|dsh-soc-agent-session-log-export|mandatory|browser"
  "dsh-soc-agent-session-persistence-jsonl|soc-agent-session-persistence-jsonl|host|lib/index.js|dsh-soc-agent-session-persistence-jsonl|mandatory|host"
  "dsh-soc-agent-settings-file|soc-agent-settings-file|host|lib/index.js|dsh-soc-agent-settings-file|mandatory|host"
  "dsh-soc-agent-sidebar|soc-agent-sidebar|dual|lib/client.js|dsh-soc-agent-sidebar|mandatory|browser"
  "dsh-soc-agent-time-context|soc-agent-time-context|host|lib/index.js|dsh-soc-agent-time-context|mandatory|host"
  "dsh-soc-agent-tool-result-pruner|soc-agent-tool-result-pruner|host|lib/index.js|dsh-soc-agent-tool-result-pruner|mandatory|host"
  "dsh-soc-agent-ui-approval|soc-agent-ui-approval|dual|lib/client.js|dsh-soc-agent-ui-approval|mandatory|browser"
  "dsh-soc-agent-ui-chat|soc-agent-ui-chat|dual|lib/client.js|dsh-soc-agent-ui-chat|mandatory|browser"
  "dsh-soc-agent-ui-commands|soc-agent-ui-commands|dual|lib/client.js|dsh-soc-agent-ui-commands|mandatory|browser"
  "dsh-soc-agent-ui-conversation|soc-agent-ui-conversation|dual|lib/client.js|dsh-soc-agent-ui-conversation|mandatory|browser"
  "dsh-soc-agent-ui-input-trigger|soc-agent-ui-input-trigger|dual|lib/client.js|dsh-soc-agent-ui-input-trigger|mandatory|browser"
  "dsh-soc-agent-ui-layout|soc-agent-ui-layout|dual|lib/client.js|dsh-soc-agent-ui-layout|mandatory|browser"
  "dsh-soc-agent-ui-model-selection|soc-agent-ui-model-selection|dual|lib/client.js|dsh-soc-agent-ui-model-selection|mandatory|browser"
  "dsh-soc-agent-ui-renderer|soc-agent-ui-renderer|dual|lib/client.js|dsh-soc-agent-ui-renderer|mandatory|browser"
  "dsh-soc-agent-ui-session|soc-agent-ui-session|dual|lib/client.js|dsh-soc-agent-ui-session|mandatory|browser"
  "dsh-soc-agent-workspace-controller|soc-agent-workspace-controller|dual|lib/client.js|dsh-soc-agent-workspace-controller|mandatory|browser"
  "dsh-soc-agent-workspace|soc-agent-workspace|dual|lib/client.js|dsh-soc-agent-workspace|mandatory|browser"
)
SOC_PACKAGE_NAMES=()
SOC_PACKAGE_DIRS=()
SOC_PACKAGE_ARTIFACTS=()
SOC_PACKAGE_HOST_ARTIFACTS=()
SOC_PACKAGE_FACES=()
SOC_PACKAGE_HEALTH_CHECKS=()
SOC_CLIENT_PACKAGE_NAMES=()
SOC_CLIENT_PACKAGE_DIRS=()
SOC_CLIENT_LIBS=()
for soc_package_row in "${SOC_PACKAGE_MATRIX[@]}"; do
  IFS='|' read -r soc_package soc_package_dir soc_package_face soc_package_artifact _soc_config_row _soc_status soc_package_health <<< "$soc_package_row"
  SOC_PACKAGE_NAMES+=("$soc_package")
  SOC_PACKAGE_DIRS+=("$soc_package_dir")
  SOC_PACKAGE_ARTIFACTS+=("$REPO_ROOT/packages/$soc_package_dir/$soc_package_artifact")
  SOC_PACKAGE_HOST_ARTIFACTS+=("$REPO_ROOT/packages/$soc_package_dir/lib/index.js")
  SOC_PACKAGE_FACES+=("$soc_package_face")
  SOC_PACKAGE_HEALTH_CHECKS+=("$soc_package_health")
  if [ "$soc_package_face" = dual ]; then
    SOC_CLIENT_PACKAGE_NAMES+=("$soc_package")
    SOC_CLIENT_PACKAGE_DIRS+=("$soc_package_dir")
    SOC_CLIENT_LIBS+=("$REPO_ROOT/packages/$soc_package_dir/$soc_package_artifact")
  fi
done

if [ ! -f "$SERVER_ENV_EXAMPLE" ]; then
  echo "error: template '$SERVER_ENV_EXAMPLE' is missing." >&2
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

SOC_MANAGED_DEPS=(
  dsh-soc-agent
  "${SOC_PACKAGE_NAMES[@]}"
)

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
    printf '# Loaded by the DeepSeek Harness boot when `dsh web` runs from the\n# CITIC_AGENT repository root. Managed by setup.sh; never commit this file.\n' > "$HARNESS_ENV"
    info "created $HARNESS_ENV"
  fi
  upsert_env_file "$HARNESS_ENV" \
    APP_POSTGRES_URI APP_SETTINGS_ENCRYPTION_KEY

  ensure_git_ignored "apps/soc-agent/server/.env"
  ensure_git_ignored ".env"

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
  local allow='^(react|react/jsx-runtime|react-dom|react-dom/client|@deepseek-ai/cordis|@deepseek-ai/dsh-client-store|@deepseek-ai/dsh-client-ui-slots|@deepseek-ai/dsh-client-ui-primitives|@deepseek-ai/dsh-client-runtime/client|dsh-soc-agent-api-gateway/client)$'
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

# Incremental state is deliberately split across the immutable Harness,
# independent SOC workspace, and profile composition.
BUILD_STATE_DIR="$REPO_ROOT/.data"
HARNESS_INSTALL_MARKER="$BUILD_STATE_DIR/harness-install.sha256"
HARNESS_BUILD_MARKER="$BUILD_STATE_DIR/harness-build.sha256"
SOC_INSTALL_MARKER="$BUILD_STATE_DIR/soc-install.sha256"
SOC_BUILD_MARKER="$BUILD_STATE_DIR/soc-build.sha256"
PROFILE_COMPOSITION_MARKER="$BUILD_STATE_DIR/profile-composition.sha256"
FORCE_REBUILD="${FORCE_REBUILD:-0}"

harness_source_fingerprint() {
  (
    cd "$HARNESS_DIR" && find packages apps scripts vendor \
      -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \
      -o -name '*.css' -o -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) \
      -not -path '*/node_modules/*' -not -path '*/lib/*' -not -path '*/dist/*' \
      -print0 2>/dev/null | sort -z | xargs -0 -r sha256sum
    sha256sum "$HARNESS_DIR/package.json" "$HARNESS_DIR/pnpm-lock.yaml" 2>/dev/null || true
  ) 2>/dev/null | sha256sum | awk '{print $1}'
}

soc_source_fingerprint() {
  (
    cd "$REPO_ROOT" && find apps/soc-agent packages tooling \
      -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \
      -o -name '*.css' -o -name '*.yml' -o -name '*.yaml' -o -name '*.json' \) \
      -not -path '*/node_modules/*' -not -path '*/lib/*' -not -path '*/dist/*' \
      -print0 2>/dev/null | sort -z | xargs -0 -r sha256sum
    for package_dir in "${SOC_PACKAGE_DIRS[@]}"; do
      cd "$REPO_ROOT/packages/$package_dir" && find src tests \
        -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.json' \) \
        -print0 2>/dev/null | sort -z | xargs -0 -r sha256sum
    done
    sha256sum "$REPO_ROOT/package.json" "$REPO_ROOT/pnpm-lock.yaml" \
      "$REPO_ROOT/pnpm-workspace.yaml" 2>/dev/null || true
  ) 2>/dev/null | sha256sum | awk '{print $1}'
}

harness_install_fingerprint() {
  sha256sum "$HARNESS_DIR/pnpm-lock.yaml" 2>/dev/null | sha256sum | awk '{print $1}'
}

soc_install_fingerprint() {
  sha256sum "$REPO_ROOT/package.json" "$REPO_ROOT/pnpm-lock.yaml" \
    "$REPO_ROOT/pnpm-workspace.yaml" 2>/dev/null | sha256sum | awk '{print $1}'
}

ensure_harness_ready() {
  echo "${B}Harness build${N}"
  mkdir -p "$BUILD_STATE_DIR"

  if node "$REPO_ROOT/tooling/verify-upstream.mjs" --fresh; then
    ok "pristine Harness release verified"
  else
    bad "vendor/deepseek-harness differs from the official rc.2 release"
    return 1
  fi

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

  local source_fingerprint build_recorded
  source_fingerprint="$(harness_source_fingerprint)"
  build_recorded="$(cat "$HARNESS_BUILD_MARKER" 2>/dev/null || true)"
  if [ "$FORCE_REBUILD" != "1" ] && [ -n "$build_recorded" ] \
    && [ "$build_recorded" = "$source_fingerprint" ] \
    && [ -f "$HARNESS_DIR/apps/web/dist/index.html" ] \
    && [ -f "$HARNESS_DIR/packages/mcp/mcp-client/lib/index.js" ]; then
    info "harness sources unchanged since the last build — skipping pnpm run build"
  else
    echo "Building the pristine Harness framework and web app — this can take several minutes…"
    if (cd "$HARNESS_DIR" && pnpm run build); then
      ok "framework build complete"
      printf '%s' "$source_fingerprint" > "$HARNESS_BUILD_MARKER"
    else
      bad "pnpm run build failed — fix the error above and re-run ./setup.sh"
      PREREQ_WARNINGS+=("harness build")
      return 1
    fi
  fi

}

verify_soc_artifacts() {
  local all_ok=0 index package artifact host_artifact face health
  for index in "${!SOC_PACKAGE_NAMES[@]}"; do
    package="${SOC_PACKAGE_NAMES[$index]}"
    artifact="${SOC_PACKAGE_ARTIFACTS[$index]}"
    face="${SOC_PACKAGE_FACES[$index]}"
    health="${SOC_PACKAGE_HEALTH_CHECKS[$index]}"
    if [ -f "$artifact" ]; then
      ok "$package $health artifact present"
    else
      bad "$package artifact missing — run: ./setup.sh --plugins"
      all_ok=1
    fi
    if [ "$face" = dual ]; then
      host_artifact="${SOC_PACKAGE_HOST_ARTIFACTS[$index]}"
      if [ -f "$host_artifact" ]; then
        ok "$package host artifact present"
      else
        bad "$package host artifact missing — run: ./setup.sh --plugins"
        all_ok=1
      fi
    fi
  done
  if [ ! -f "$REPO_ROOT/packages/soc-agent-session-persistence-jsonl/lib/migration.js" ]; then
    bad "dsh-soc-agent-session-persistence-jsonl migration artifact missing — run: ./setup.sh --plugins"
    all_ok=1
  fi
  if ! verify_soc_client_artifacts; then all_ok=1; fi
  return "$all_ok"
}

ensure_soc_workspace_ready() {
  echo "${B}SOC workspace build${N}"
  mkdir -p "$BUILD_STATE_DIR"

  local install_fingerprint install_recorded
  install_fingerprint="$(soc_install_fingerprint)"
  install_recorded="$(cat "$SOC_INSTALL_MARKER" 2>/dev/null || true)"
  if [ "$FORCE_REBUILD" != 1 ] && [ "$install_recorded" = "$install_fingerprint" ] \
    && [ -d "$REPO_ROOT/node_modules" ]; then
    info "SOC dependency graph unchanged — skipping pnpm install"
  else
    echo "Installing the independent SOC workspace…"
    if (cd "$REPO_ROOT" && pnpm install --frozen-lockfile); then
      ok "SOC workspace dependencies ready"
      printf '%s' "$install_fingerprint" > "$SOC_INSTALL_MARKER"
    else
      bad "SOC workspace install failed"
      return 1
    fi
  fi

  local source_fingerprint build_recorded need_repair=0 index package lib violations
  source_fingerprint="$(soc_source_fingerprint)"
  build_recorded="$(cat "$SOC_BUILD_MARKER" 2>/dev/null || true)"
  if [ "$FORCE_REBUILD" != 1 ] && [ "$build_recorded" = "$source_fingerprint" ]; then
    if verify_soc_artifacts >/dev/null 2>&1; then
      info "SOC sources unchanged — skipping bundle build"
    else
      need_repair=1
    fi
  else
    need_repair=1
  fi

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
    echo "Building every SOC host and browser bundle…"
    if (cd "$REPO_ROOT" && pnpm run build); then
      printf '%s' "$source_fingerprint" > "$SOC_BUILD_MARKER"
    else
      bad "SOC workspace build failed"
      return 1
    fi
  fi
  verify_soc_artifacts
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

stale_external_plugin_names() { # $1 = profile dir; migration cleanup only
  local name
  for name in '@linxin666/dsh-client-ui-skin-center' dsh-auto-collapse; do
    if profile_has_dependency "$1/package.json" "$name" || profile_has_bundle "$1/package.json" "$name"; then
      printf '%s\n' "$name"
    fi
  done
}

remove_stale_profile_patches() { # $1 = profile dir; migration cleanup only
  local pdir="$1" workspace="$1/pnpm-workspace.yaml"
  [ -f "$workspace" ] || return 0
  node - "$workspace" "$pdir" <<'NODE'
const fs = require('fs')
const path = require('path')

const workspacePath = process.argv[2]
const profileDir = path.resolve(process.argv[3])
const stalePatchKey = 'dsh-auto-collapse@0.1.4'
const stalePatchBasename = 'dsh-auto-collapse@0.1.4.patch'
const stalePatchPattern = new RegExp(`^\\s*${stalePatchKey.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}:\\s*(\\S+)\\s*$`)
const lines = fs.readFileSync(workspacePath, 'utf8').split(/\r?\n/)
const output = []
const stalePaths = []
let changed = false

for (let index = 0; index < lines.length;) {
  if (lines[index].trim() !== 'patchedDependencies:') {
    output.push(lines[index++])
    continue
  }

  const header = lines[index]
  const block = []
  let cursor = index + 1
  while (cursor < lines.length && (lines[cursor].trim() === '' || /^[ \t]/.test(lines[cursor]))) {
    const match = lines[cursor].match(stalePatchPattern)
    if (match) {
      stalePaths.push(match[1])
      changed = true
    } else {
      block.push(lines[cursor])
    }
    cursor += 1
  }

  const keptEntries = block.filter((line) => line.trim() !== '')
  if (keptEntries.length > 0) {
    output.push(header, ...block)
  }
  index = cursor
}

if (changed) {
  fs.writeFileSync(workspacePath, output.join('\n'))
  for (const patchPath of stalePaths) {
    const resolved = path.resolve(profileDir, patchPath)
    if (path.basename(resolved) !== stalePatchBasename) continue
    if (resolved !== profileDir && resolved.startsWith(profileDir + path.sep) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved)
    }
  }
  process.stdout.write('removed obsolete dsh-auto-collapse pnpm patch\n')
}
NODE
}

prune_legacy_plugins() { # $1 = profile dir
  local pdir="$1" legacy name
  legacy="$(stale_external_plugin_names "$pdir")"
  [ -n "$legacy" ] || { ok "legacy skin and auto-collapse plugins absent"; return 0; }
  local -a legacy_arr=()
  while IFS= read -r name; do [ -n "$name" ] && legacy_arr+=("$name"); done <<< "$legacy"
  echo "Removing replaced third-party plugins: ${legacy_arr[*]}"
  remove_stale_profile_patches "$pdir"
  if ! (cd "$HARNESS_DIR" && pnpm dsh plugin --profile "$DSH_PROFILE" remove "${legacy_arr[@]}"); then
    bad "failed to remove replaced third-party plugins"
    return 1
  fi
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const stale = new Set(process.argv.slice(2));
    const m = JSON.parse(fs.readFileSync(path, "utf8"));
    const bundles = m.dsh?.profile?.bundles;
    if (Array.isArray(bundles)) m.dsh.profile.bundles = bundles.filter((item) => !stale.has(item));
    fs.writeFileSync(path, JSON.stringify(m, null, 2) + "\n");
  ' "$pdir/package.json" "${legacy_arr[@]}"
  ok "replaced third-party plugins removed"
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
  local -a resolution_specs=(dsh-soc-agent/auth-host dsh-soc-agent/host "${SOC_PACKAGE_NAMES[@]}")
  for spec in "${resolution_specs[@]}"; do
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
  local pdir package package_dir all_registered=0
  local -a package_specs=("$REPO_ROOT/apps/soc-agent")
  pdir="$(profile_dir)"
  for package_dir in "${SOC_PACKAGE_DIRS[@]}"; do
    package_specs+=("$REPO_ROOT/packages/$package_dir")
  done

  echo "${B}Harness profile (SOC product bundle)${N}"

  if [ ! -d "$HARNESS_DIR/node_modules" ]; then
    warn "harness dependencies are not installed — run:"
    warn "  cd vendor/deepseek-harness && pnpm install --frozen-lockfile"
    warn "then re-run ./setup.sh to wire the SOC bundle into the profile."
    PREREQ_WARNINGS+=("harness profile wiring")
    return 1
  fi

  if ! prune_legacy_plugins "$pdir"; then return 1; fi

  if profile_lists "$pdir/package.json" dsh-soc-agent; then
    all_registered=1
    for package in "${SOC_PACKAGE_NAMES[@]}"; do
      if ! profile_lists "$pdir/package.json" "$package"; then all_registered=0; break; fi
    done
  fi
  if [ "$all_registered" = 1 ]; then
    ok "SOC bundle and all replacement packages already registered in the '$DSH_PROFILE' profile"
  else
    echo "Registering the SOC product bundle in the '$DSH_PROFILE' profile…"
    if (cd "$HARNESS_DIR" && pnpm dsh plugin --profile "$DSH_PROFILE" add "${package_specs[@]}" 2>&1 | tail -n 8); then
      ok "installed dsh-soc-agent and all SOC replacement packages"
    else
      bad "could not install the SOC bundle into the harness profile (see output above)"
      PREREQ_WARNINGS+=("harness profile wiring")
      return 1
    fi
  fi

  if verify_profile_resolution "$pdir"; then
    ok "every SOC plugin name resolves from the profile"
    {
      sha256sum "$pdir/package.json" "$REPO_ROOT/apps/soc-agent/cordis.patch.yml" 2>/dev/null || true
    } | sha256sum | awk '{print $1}' > "$PROFILE_COMPOSITION_MARKER"
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
  echo "  $HARNESS_ENV  (Node Harness launch environment; chmod 600)"
  if [ "${#PREREQ_WARNINGS[@]}" -gt 0 ]; then
    echo
    warn "skipped prerequisites: ${PREREQ_WARNINGS[*]} — the app will not boot until they are installed."
  fi
  echo
  echo "${B}Next steps${N}"
  echo "  1. Start the web app from the repository root:  vendor/deepseek-harness/node_modules/.bin/dsh web --no-open"
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
  echo "${B}Parameters${N} ${D}(environment > .env > apps/soc-agent/server/.env > .env.example)${N}"

  if check_parameters; then :; else fails=$((fails+$?)); fi

  echo
  echo "${B}Harness build & profile${N}"
  if node "$REPO_ROOT/tooling/verify-upstream.mjs" --fresh; then
    ok "pristine Harness release verified"
  else
    bad "vendor/deepseek-harness differs from the official rc.2 release"; fails=$((fails+1))
  fi
  local pdir
  pdir="$(profile_dir)"
  local legacy_list
  legacy_list="$(stale_external_plugin_names "$pdir")"
  if [ -z "$legacy_list" ]; then
    ok "replaced third-party plugins absent"
  else
    bad "replaced third-party plugins still present: $(printf '%s' "$legacy_list" | tr '\n' ' ') — run: ./setup.sh --plugins"; fails=$((fails+1))
  fi
  if [ -d "$HARNESS_DIR/node_modules" ]; then
    if [ -f "$HARNESS_DIR/vendor/schemastery/lib/index.cjs" ] && [ -f "$HARNESS_DIR/apps/web/dist/index.html" ]; then
      ok "framework build present"
    else
      bad "framework build incomplete — run: ./setup.sh --plugins"; fails=$((fails+1))
    fi
    if verify_soc_artifacts; then
      :
    else
      fails=$((fails+1))
    fi
    local package all_registered=0
    if profile_lists "$pdir/package.json" dsh-soc-agent; then
      all_registered=1
      for package in "${SOC_PACKAGE_NAMES[@]}"; do
        if ! profile_lists "$pdir/package.json" "$package"; then all_registered=0; break; fi
      done
    fi
    if [ "$all_registered" = 1 ]; then
      ok "SOC bundle and all replacement packages registered in the '$DSH_PROFILE' profile"
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
    ensure_soc_workspace_ready
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
    ensure_soc_workspace_ready
    ensure_soc_bundle
    echo
    summary
    ;;
  *)
    echo "usage: $0 [--check|--plugins] [--rebuild]" >&2
    exit 2
    ;;
esac
