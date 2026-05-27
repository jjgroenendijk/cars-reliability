#!/bin/sh
# charset-check.sh: block emoji/pictographs and ASCII decoration banners in
# tracked text files (project rule: no emojis, no decorative ASCII art).
#
# Allowed: Latin accents (Dutch RDW text) and currency symbols such as the euro
# sign -- only emoji/pictograph Unicode ranges are blocked, never General
# Punctuation or currency. ASCII decoration means a run of four or more
# identical separators (equals, dashes, etc.). Markdown (*.md) files are exempt
# from the decoration check so tables and rule rows stay easy to write; emoji
# are still blocked everywhere, including Markdown.
#
# Invoked identically by the pre-commit hook and the checks.yml CI workflow.
# The emoji check scans every tracked file; the decoration check skips *.md.
# grep -I skips binary files.

status=0

# Emoji / pictograph ranges expressed as hex codepoints, so this script itself
# contains no literal emoji and never flags itself.
EMOJI_RANGE='[\x{1F000}-\x{1FAFF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE00}-\x{FE0F}\x{200D}]'

emoji_hits=$(git ls-files -z | xargs -0 grep -HInP "$EMOJI_RANGE" 2>/dev/null)
if [ -n "$emoji_hits" ]; then
    echo "Charset: emoji or pictograph characters are not allowed:" >&2
    printf '%s\n' "$emoji_hits" | sed 's/^/  /' >&2
    status=1
fi

# Decoration: four or more repeated separators, in every tracked file except
# Markdown (*.md), which is exempt so tables and rule rows are easy to write.
deco_hits=$(git ls-files -z -- ':(exclude)*.md' | xargs -0 grep -HInE '={4,}|-{4,}|\*{4,}|~{4,}|_{4,}' 2>/dev/null)
if [ -n "$deco_hits" ]; then
    echo "Charset: ASCII decoration (4+ repeated separators) is not allowed:" >&2
    printf '%s\n' "$deco_hits" | sed 's/^/  /' >&2
    status=1
fi

exit $status
