#!/bin/sh
# commit-attribution-check.sh <git-range>: scan every commit message in a git
# range for AI-tool attribution, reusing the shared block-list. Used by the
# checks.yml CI workflow to mirror the local commit-msg / pre-push hooks. The
# PR title and body are scanned separately by the workflow, which pipes them
# into ai_attribution_scan directly.

. "$(dirname -- "$0")/attribution-check.sh"

range="$1"
if [ -z "$range" ]; then
    echo "commit-attribution-check: missing git range argument." >&2
    exit 2
fi

status=0
for sha in $(git rev-list "$range"); do
    if ! git log -1 --format=%B "$sha" | ai_attribution_scan "commit $sha"; then
        status=1
    fi
done
exit $status
