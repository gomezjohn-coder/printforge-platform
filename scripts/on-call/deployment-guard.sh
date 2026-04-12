#!/usr/bin/env bash
# ============================================================================
# PrintForge — Deployment Guard
#
# Blocks production deployments when no SRE is on-call. Checks whether the
# current UTC time falls within an active on-call window for either the
# Melbourne or New York SRE team.
#
# On-call schedule (all times UTC):
#   Melbourne (AEST UTC+10): covers 22:00 - 10:00 UTC (08:00 - 20:00 AEST)
#   New York  (EST  UTC-5):  covers 10:00 - 22:00 UTC (05:00 - 17:00 EST)
#
# This provides 24-hour coverage with overlap during handoff windows.
#
# Usage:
#   bash scripts/on-call/deployment-guard.sh
#   # Exit 0 = deployment allowed
#   # Exit 1 = deployment blocked
#
# Override (for emergencies):
#   DEPLOYMENT_GUARD_OVERRIDE=true bash scripts/on-call/deployment-guard.sh
#
# Integration:
#   Used by `printforge deploy` before production deployments.
#
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# On-call windows in UTC hours (24h format)
# Melbourne covers: 22:00 - 10:00 UTC (wraps midnight)
MELBOURNE_START=22
MELBOURNE_END=10

# New York covers: 10:00 - 22:00 UTC
NEWYORK_START=10
NEWYORK_END=22

# Days of the week where deployment is allowed (1=Mon, 7=Sun)
# Block weekend deployments by default
ALLOWED_DAYS="1 2 3 4 5"

# Deployment freeze windows (ISO date ranges, space-separated)
# Format: "YYYY-MM-DD:YYYY-MM-DD"
FREEZE_WINDOWS="${DEPLOYMENT_FREEZE_WINDOWS:-}"

# Override for emergencies
OVERRIDE="${DEPLOYMENT_GUARD_OVERRIDE:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log_info()  { echo -e "[INFO]  $*" >&2; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*" >&2; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" >&2; }
log_block() { echo -e "${RED}[BLOCKED]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Check override
# ---------------------------------------------------------------------------
if [[ "$OVERRIDE" == "true" ]]; then
  log_warn "DEPLOYMENT_GUARD_OVERRIDE is set. Allowing deployment."
  log_warn "Ensure an SRE is manually monitoring this deployment."
  exit 0
fi

# ---------------------------------------------------------------------------
# Get current UTC time
# ---------------------------------------------------------------------------
CURRENT_HOUR=$(date -u +%H | sed 's/^0//')
CURRENT_DAY=$(date -u +%u)  # 1=Monday, 7=Sunday
CURRENT_DATE=$(date -u +%Y-%m-%d)

log_info "Current UTC time: $(date -u '+%Y-%m-%d %H:%M:%S')"
log_info "Current UTC hour: ${CURRENT_HOUR}, Day: ${CURRENT_DAY}"

# ---------------------------------------------------------------------------
# Check deployment freeze windows
# ---------------------------------------------------------------------------
if [[ -n "$FREEZE_WINDOWS" ]]; then
  for window in $FREEZE_WINDOWS; do
    IFS=':' read -r freeze_start freeze_end <<< "$window"
    if [[ "$CURRENT_DATE" >= "$freeze_start" && "$CURRENT_DATE" <= "$freeze_end" ]]; then
      log_block "Deployment freeze is active: ${freeze_start} to ${freeze_end}"
      log_block "Set DEPLOYMENT_GUARD_OVERRIDE=true to override (emergency only)."
      exit 1
    fi
  done
fi

# ---------------------------------------------------------------------------
# Check day of week
# ---------------------------------------------------------------------------
day_allowed=false
for day in $ALLOWED_DAYS; do
  if [[ "$CURRENT_DAY" == "$day" ]]; then
    day_allowed=true
    break
  fi
done

if [[ "$day_allowed" == "false" ]]; then
  log_block "Weekend deployments are not allowed (day=${CURRENT_DAY})."
  log_block "Set DEPLOYMENT_GUARD_OVERRIDE=true to override (emergency only)."
  exit 1
fi

# ---------------------------------------------------------------------------
# Check on-call coverage
# ---------------------------------------------------------------------------
melbourne_oncall=false
newyork_oncall=false

# Melbourne: wraps midnight (22:00 - 10:00 UTC)
if [[ $MELBOURNE_START -gt $MELBOURNE_END ]]; then
  # Wrapping window
  if [[ $CURRENT_HOUR -ge $MELBOURNE_START || $CURRENT_HOUR -lt $MELBOURNE_END ]]; then
    melbourne_oncall=true
  fi
else
  if [[ $CURRENT_HOUR -ge $MELBOURNE_START && $CURRENT_HOUR -lt $MELBOURNE_END ]]; then
    melbourne_oncall=true
  fi
fi

# New York: standard window (10:00 - 22:00 UTC)
if [[ $NEWYORK_START -gt $NEWYORK_END ]]; then
  if [[ $CURRENT_HOUR -ge $NEWYORK_START || $CURRENT_HOUR -lt $NEWYORK_END ]]; then
    newyork_oncall=true
  fi
else
  if [[ $CURRENT_HOUR -ge $NEWYORK_START && $CURRENT_HOUR -lt $NEWYORK_END ]]; then
    newyork_oncall=true
  fi
fi

# ---------------------------------------------------------------------------
# Decision
# ---------------------------------------------------------------------------
if [[ "$melbourne_oncall" == "true" ]]; then
  log_ok "Melbourne SRE is on-call (UTC ${MELBOURNE_START}:00 - ${MELBOURNE_END}:00). Deployment allowed."
  exit 0
fi

if [[ "$newyork_oncall" == "true" ]]; then
  log_ok "New York SRE is on-call (UTC ${NEWYORK_START}:00 - ${NEWYORK_END}:00). Deployment allowed."
  exit 0
fi

# Neither team is on-call — this should not happen with proper coverage
# but guards against gaps
log_block "No SRE team is currently on-call."
log_block "Melbourne: UTC ${MELBOURNE_START}:00 - ${MELBOURNE_END}:00"
log_block "New York:  UTC ${NEWYORK_START}:00 - ${NEWYORK_END}:00"
log_block "Current:   UTC ${CURRENT_HOUR}:00"
log_block ""
log_block "Set DEPLOYMENT_GUARD_OVERRIDE=true to override (emergency only)."
exit 1
