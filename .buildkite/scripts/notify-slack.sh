#!/bin/bash
set -euo pipefail

while [[ $# -gt 0 ]]; do
  case $1 in
    --event) EVENT="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --initiated-by) INITIATED_BY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
[ -z "$SLACK_WEBHOOK_URL" ] && { echo "SLACK_WEBHOOK_URL not set"; exit 0; }

case $EVENT in
  success)
    EMOJI=":white_check_mark:"
    COLOR="good"
    TEXT="${EMOJI} *${SERVICE}* deployed successfully to production\nVersion: \`${VERSION:-unknown}\`\nPipeline: <${BUILDKITE_BUILD_URL}|#${BUILDKITE_BUILD_NUMBER}>"
    ;;
  rollback)
    EMOJI=":rotating_light:"
    COLOR="danger"
    TEXT="${EMOJI} *${SERVICE}* canary ROLLED BACK — metrics threshold breached\nPipeline: <${BUILDKITE_BUILD_URL}|#${BUILDKITE_BUILD_NUMBER}>\nCheck Datadog dashboard for details."
    ;;
  emergency-rollback)
    EMOJI=":fire:"
    COLOR="danger"
    TEXT="${EMOJI} *EMERGENCY ROLLBACK* for *${SERVICE}*\nInitiated by: ${INITIATED_BY:-unknown}\nPipeline: <${BUILDKITE_BUILD_URL}|#${BUILDKITE_BUILD_NUMBER}>"
    ;;
  smoke-failure)
    EMOJI=":warning:"
    COLOR="warning"
    TEXT="${EMOJI} *${SERVICE}* smoke tests FAILED post-deployment\nPipeline: <${BUILDKITE_BUILD_URL}|#${BUILDKITE_BUILD_NUMBER}>"
    ;;
esac

curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d "{
    \"channel\": \"#deployments\",
    \"attachments\": [{
      \"color\": \"${COLOR}\",
      \"text\": \"${TEXT}\",
      \"footer\": \"PrintForge DevOps | ${BUILDKITE_PIPELINE_SLUG}\",
      \"ts\": $(date +%s)
    }]
  }"
