# PhraseDock

- This is a desktop utility, not a hosted website. UI/config are shared; OS input code belongs in platform adapters.
- macOS has historical MVP validation. The Windows adapter is implemented, but compilation and synthetic tests must not be described as actual target-input or visual verification.
- Preserve keyboard focus. Never activate a target app, guess a screen coordinate, or send Enter to submit user messages.
- Never retry a paste after keyboard events have been emitted. Preserve a newer user clipboard instead of restoring stale data.
- Pass text to native code over stdin JSON; never interpolate text into shell commands, logs, or diagnostics.
- Renderer: sandbox and context isolation on; no Node integration, remote content, broad IPC, or HTML injection from config.
- User configuration lives outside the project. Never overwrite it during rebuilds or assume editing default JSON changes an existing installation.
- Validate native compilation, syntax, and meaningful boundaries. Distinguish synthetic/UI tests, actual target-input tests, and unverified behavior in docs/validation.md.
- Do not commit, push, or publish without explicit user authorization.
