# Buffy memory shell hook — source from ~/.bashrc:
#   [ -f ~/.buffy/memory/shell-hook.sh ] && source ~/.buffy/memory/shell-hook.sh
#
# Behavior:
#   - On the first interactive shell of the day: boots the memory session
#     (identity + short-term + last recap) quietly, and registers an EXIT
#     trap so THAT shell closes the session (RECAP + decay + short-term
#     refresh) when it exits.
#   - Other shells opened later in the day do nothing (no duplicate RECAPs).
#   - Idempotent: safe to source multiple times; no-ops when not interactive
#     or when the memory CLI is missing.
#   - Disable with: export BUFFY_MEMORY_OFF=1

if [[ $- == *i* ]] && [[ -z "$BUFFY_MEMORY_OFF" ]]; then
  _BUFFY_MEM_CLI="$HOME/.buffy/memory/memory.mjs"

  if [[ -x "$(command -v node)" ]] && [[ -f "$_BUFFY_MEM_CLI" ]]; then
    # Session start: only announce the first interactive shell of the day.
    _BUFFY_MEM_TODAY="$(date +%F)"
    if [[ "$_BUFFY_MEM_STARTED_DAY" != "$_BUFFY_MEM_TODAY" ]]; then
      node "$_BUFFY_MEM_CLI" start >/dev/null 2>&1
      _BUFFY_MEM_STARTED_DAY="$_BUFFY_MEM_TODAY"

      # This shell opened the session, so it also closes it on exit.
      _buffy_mem_end() {
        local rc=$?
        node "$_BUFFY_MEM_CLI" end "shell session closed" >/dev/null 2>&1
        exit $rc
      }
      trap _buffy_mem_end EXIT
    fi
    unset _BUFFY_MEM_TODAY
  fi
fi