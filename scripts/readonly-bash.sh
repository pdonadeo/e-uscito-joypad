#!/bin/bash
# PreToolUse backstop for read-only agents.
#
# The `tools:` frontmatter can withhold Edit and Write, but an agent with Bash
# can still mutate the repo via redirects, sed -i, or git. This blocks the
# obvious routes. It is a guardrail against accident, NOT a sandbox: a
# determined command can still get through. Treat it as such.
#
# Exit 2 blocks the command and returns the message on stderr to the agent.

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

[ -z "$COMMAND" ] && exit 0

deny() {
  echo "Blocked: this agent is read-only. $1" >&2
  echo "Report the finding instead of changing the file." >&2
  exit 2
}

# Mutating commands.
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|(]|[[:space:]])(rm|rmdir|mv|cp|install|truncate|dd|chmod|chown|ln)([[:space:]]|$)'; then
  deny "Filesystem-mutating command detected."
fi

# In-place editors.
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|(]|[[:space:]])(sed[[:space:]]+(-[a-zA-Z]*i|--in-place)|perl[[:space:]]+(-[a-zA-Z]*i)|patch|ed)([[:space:]]|$)'; then
  deny "In-place editing command detected."
fi

# tee without /dev/null.
if printf '%s' "$COMMAND" | grep -qE '(^|\|)[[:space:]]*tee([[:space:]]|$)' \
   && ! printf '%s' "$COMMAND" | grep -qE 'tee[[:space:]]+(-a[[:space:]]+)?/dev/null'; then
  deny "Output redirection via tee detected."
fi

# Redirects to a real path. /dev/null and fd duplication (2>&1) are fine.
REDIRECTS=$(printf '%s' "$COMMAND" | grep -oE '[0-9]?>>?[[:space:]]*[^[:space:];&|]+' || true)
if [ -n "$REDIRECTS" ]; then
  while IFS= read -r r; do
    [ -z "$r" ] && continue
    target=$(printf '%s' "$r" | sed -E 's/^[0-9]?>>?[[:space:]]*//')
    case "$target" in
      /dev/null|/dev/stderr|/dev/stdout|\&1|\&2) ;;
      *) deny "Redirect to '$target' detected." ;;
    esac
  done <<< "$REDIRECTS"
fi

# Git commands that change the repo or history.
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|(]|[[:space:]])git[[:space:]]+(add|commit|checkout|switch|restore|reset|revert|merge|rebase|cherry-pick|clean|apply|am|stash|push|mv|rm|tag|branch[[:space:]]+-[dDmM])'; then
  deny "Repository-mutating git command detected."
fi

# Package managers that write lockfiles or node_modules.
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|(]|[[:space:]])(npm|pnpm|yarn|pip|pip3|opam|go)[[:space:]]+(install|add|i|get|remove|uninstall|update|upgrade)'; then
  deny "Dependency-mutating command detected."
fi

exit 0
