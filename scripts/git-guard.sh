#!/usr/bin/env bash
# git-guard.sh — PreToolUse hook for Bash. Blocks destructive git commands
# that could rewrite or destroy GitHub history.
#
# Reads the Claude Code hook payload on stdin, extracts .tool_input.command,
# matches against a deny list. Exit 2 with stderr message → block. Exit 0 → allow.
#
# Escape hatch for the user: prefix the prompt with `! <cmd>` (input-box bang)
# so the command runs in their shell instead of through Claude's Bash tool —
# this hook only sees Bash tool calls, not input-box ! commands.
#
# To test:
#   echo '{"tool_input":{"command":"git reset --hard HEAD~1"}}' | scripts/git-guard.sh; echo "exit=$?"

set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  # Fail open if jq is missing (don't block legitimate commands).
  exit 0
fi

CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[[ -z "$CMD" ]] && exit 0

# Deny patterns. Each is an ERE. A match → block.
# Word boundaries (\b) keep `git reset --hardfoo` from matching --hard.
PATTERNS=(
  # git reset with destructive modes
  '(^|[^[:alnum:]_-])git[[:space:]]+reset[[:space:]]+(--hard|--merge|--keep)([[:space:]]|$)'

  # git push --force / -f / --force-with-lease (any order, any extra args)
  '(^|[^[:alnum:]_-])git[[:space:]]+push[[:space:]].*(--force(-with-lease)?|-f-with-lease|-f)([[:space:]]|$)'

  # git push refspec force (+refs/...)
  '(^|[^[:alnum:]_-])git[[:space:]]+push[[:space:]].*[[:space:]]\+refs/'

  # git branch -D / --delete --force
  '(^|[^[:alnum:]_-])git[[:space:]]+branch[[:space:]]+(-D|--delete[[:space:]]+--force)([[:space:]]|$)'

  # git clean with both -f and -d (any flag bundle: -fd, -fdx, -ffd, -dfx, etc.)
  '(^|[^[:alnum:]_-])git[[:space:]]+clean[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*d[a-zA-Z]*|-[a-zA-Z]*d[a-zA-Z]*f[a-zA-Z]*)([[:space:]]|$)'

  # git update-ref -d (delete a ref directly)
  '(^|[^[:alnum:]_-])git[[:space:]]+update-ref[[:space:]]+-d([[:space:]]|$)'

  # git checkout . / git checkout -- . (wipes working-tree changes)
  '(^|[^[:alnum:]_-])git[[:space:]]+checkout[[:space:]]+(--[[:space:]]+)?\.([[:space:]]|$)'

  # git restore --staged --worktree --source (rewrites tree from arbitrary commit)
  '(^|[^[:alnum:]_-])git[[:space:]]+restore[[:space:]].*--staged.*--worktree.*--source'

  # rm -rf .git or rm -fr .git (destroy local repo metadata) — match .git
  # whether preceded by whitespace (rm -rf .git) or by a path slash (rm -rf path/.git)
  '(^|[^[:alnum:]_-])rm[[:space:]]+(-rf|-fr|-[rR][fF]|-[fF][rR])([[:space:]]+[^[:space:]]+)*([[:space:]]+|/)\.git([[:space:]]|/|$)'
)

for pat in "${PATTERNS[@]}"; do
  if echo "$CMD" | grep -Eq "$pat"; then
    cat >&2 <<EOF
[git-guard] BLOCKED — destructive git operation detected:
  $CMD

This command can rewrite or destroy GitHub history and is blocked by
.claude/settings.local.json hook (scripts/git-guard.sh).

Matched pattern: $pat

If you genuinely need to run this:
  - Run it yourself in the input box prefixed with '! ' (bypasses Claude),
    e.g.  ! git reset --hard HEAD~1
  - Or temporarily edit scripts/git-guard.sh to remove the rule.

The orchestrator should never need these commands. Investigate why it tried
before unblocking.
EOF
    exit 2
  fi
done

exit 0
