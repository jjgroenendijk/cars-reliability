#!/bin/sh
# loc-check.sh: enforce the per-file line-count cap (project rule: hard cap 500
# LOC; split early). Scans tracked source files and fails, listing any file over
# the cap. Invoked identically by the pre-commit hook and the checks.yml CI
# workflow so local and CI never drift.

LIMIT=500

# git ls-files lists only tracked files, so gitignored data/, .venv/, and
# node_modules/ are excluded automatically. Capture offenders in a single
# command substitution (a `while` in a pipeline runs in a subshell, so a status
# variable set inside it would not survive).
offenders=$(git ls-files '*.py' '*.ts' '*.tsx' '*.js' '*.mjs' | while read -r file; do
    [ -f "$file" ] || continue
    lines=$(wc -l < "$file")
    [ "$lines" -gt "$LIMIT" ] && printf '  %s: %s lines\n' "$file" "$lines"
done)

if [ -n "$offenders" ]; then
    echo "LOC: files exceed the ${LIMIT}-line cap:" >&2
    printf '%s\n' "$offenders" >&2
    echo "Split them before continuing (project rule)." >&2
    exit 1
fi
exit 0
