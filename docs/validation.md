# Validation

## macOS universal input mode — 2026-09-07

- New macOS installations default to `target.macMode: all`. Existing configurations without `macMode` remain explicit Mac allowlists, and Windows executable/package-family targeting is unchanged.
- The Swift bridge allows standard text areas, text fields, and combo boxes in the foreground application while rejecting PhraseDock itself, login/security-agent processes, secure fields, and disabled controls.
- **30 Node tests pass**, including universal Mac defaults, legacy Mac allowlist migration, unchanged Windows targets, bridge timeout/drain behavior, queue target binding, and the existing platform boundaries. JavaScript syntax checks and native Swift compilation pass.
- The Apple Silicon application was rebuilt with the stable local certificate and passes `codesign --verify --deep --strict`. Existing Accessibility authorization remains trusted.
- With universal mode enabled and no ChatGPT/Codex bundle ID in the request allowlist, the packaged helper recognized the foreground `com.openai.codex` `AXTextArea` as ready. The rebuilt GUI opened and loaded the migrated user configuration without a configuration error.
- **Verification limit:** automation could not keep TextEdit as the system foreground application while invoking the packaged helper. Actual paste, selection replacement, and clipboard restoration in TextEdit, Notes, browsers, IDEs, and messaging applications remain manual acceptance items. Custom Canvas and rich-text editors may not expose one of the supported AX roles.

## Windows 0.1.3 — initial empty clipboard correction — 2026-09-06

- The reported `无法读取剪贴板版本。` came from treating `GetClipboardSequenceNumber() == 0` as an unconditional access failure before backup. A read-only probe in a noninteractive window station observed sequence `0`, successful clipboard opening, zero formats, and successful enumeration. The interactive clipboard sequence remained `4` before and after the probe. This verifies a valid empty-state boundary; it does not reconstruct the user's original desktop state.
- Removed the pre-publication zero-sequence rejection. Successful `OpenClipboard` and error-checked format enumeration determine accessibility. Backup/replacement still share one lock; restoration still compares the post-write sequence under its lock and preserves a newer user copy. No input retry or focus behavior changed.
- Added `test/windows-clipboard`, which links the shipping `ClipboardLease.cs` and `PasteEngine.cs` into a separate executable with an in-memory `Native` API shim. All **8 lease regressions pass**: initial empty/zero state, original-text restoration, a newer copy after empty startup, sequence rollover to zero, enumeration failure, unreadable data, clipboard contention, and replacement failure recovery. They also check lock, owner-window, and memory cleanup. Before the fix, the same suite passed 6/8, failing both successful-publication cases that start from empty sequence zero.
- **19 native pure-logic tests pass**, including a new check that clipboard preparation failure emits no input, performs no retry, and reports the clipboard untouched. Capability and invalid-request protocol checks pass. **28 Node tests** and JavaScript syntax checks pass.
- Windows x64 native compilation and portable packaging pass. The packaged shared source/assets match the working tree, and `PhraseBridge.exe`/`PhraseBridge.dll` match the freshly compiled binaries byte-for-byte. The packaged helper passes the same 19 pure-logic tests; executable branding and all seven ICO images pass verification.
- Local executable: `dist/0.1.3/PhraseDock-win32-x64/PhraseDock.exe`. Exit the running 0.1.1 instance before opening it; the single-instance lock otherwise retains the old application. Existing installations were not overwritten. The user's `phrases.json` SHA-256 is unchanged before/after packaging.
- Local archive: `dist/PhraseDock-0.1.3-win32-x64.zip`, with adjacent `.sha256`. SHA-256: `22b20360bdbc35589623798f6152aa31075437144aec4a868add73021815b6cd`. No commit, push, or release publication was performed.
- **Verification limits:** the new lease regressions use a simulated OS API, not the interactive clipboard. The preceding investigation read only actual clipboard metadata and allowed-app control metadata. No user clipboard contents were read or written, no target app was activated, no keyboard/mouse events were sent, and no GUI/screenshot or real Codex paste was tested. Actual empty-clipboard startup, target input, clipboard restoration, and visual acceptance still require the Windows manual checklist. Mac and Windows ARM64 were not rebuilt or tested.

## 0.1.2 — AI Prompt Quick Appender display naming

- Chinese display name: `AI 常用提示词快捷追加器`. English display name: `AI Prompt Quick Appender`.
- Updated the bilingual README, application/window/tray titles, menu and accessibility labels, input-test page, Windows product metadata and Mac bundle display metadata. Prompt-related user messages now use the Chinese term `提示词`.
- Explicitly retain the existing `PhraseDock` userData/sessionData directory before acquiring the single-instance lock; the existing two-platform lifecycle test checks this compatibility boundary. No user configuration file was modified by this release build.
- 28 Node tests, JavaScript syntax checks, Windows native compilation, 18 native pure-logic tests and package verification pass. The actual Windows executable reports the new English ProductName and bilingual FileDescription; packaged HTML titles and package metadata were also read back and checked.
- Windows build: `dist/0.1.2/PhraseDock-win32-x64/PhraseDock.exe`. ZIP: `dist/PhraseDock-0.1.2-win32-x64.zip`. SHA-256: `14c4b24d701635507d88812d3f67345bb0866abaf1a56dd50feb8fee5431ee94`.
- No desktop control, GUI launch, screenshot, input events or clipboard access were performed. Mac native edits are display-message changes only; Mac compilation, signing and visual/runtime checks were not rerun on Windows. This release does not establish additional real target-input verification.

## Windows 0.1.1 — Store Codex identity correction

The user reported `wrong-app` after focusing Codex. A read-only foreground/process query on this computer identified `ChatGPT.exe` with package family `OpenAI.Codex_2p2nqsd0c76g0`. The 0.1.0 executable-only default did not match that desktop host.

- Added exact OS package-family matching alongside the existing executable allowlist. Unpackaged `ChatGPT.exe`, the ChatGPT package, and a different publisher are not admitted by the Codex package rule.
- Old Mac and Windows user configurations receive the missing package-family default in memory. Existing user files are not rewritten.
- 28 Node tests and 18 native pure-logic tests pass. Native publication, JavaScript/PowerShell syntax, package source/icon parity and packaged helper self-tests pass.
- Added an explicit read-only diagnostic request that reports process/package/control capability metadata, never input values, selected text or clipboard data. The paste engine rejects diagnostic actions.
- Produced `dist/0.1.1/PhraseDock-win32-x64/PhraseDock.exe` and `dist/PhraseDock-0.1.1-win32-x64.zip`. Archive SHA-256: `be4866652f4e4002a480699f3cae7906ed484f89a14fb6c9b0479895e023f670`.
- Versioned output leaves the running old installation intact; users must exit the old single instance before launching the new executable.
- Foreground identity was verified on the actual computer. A later bounded readiness probe observed Chrome as foreground and correctly returned `allowed: false`; this is not a successful Codex input test. Actual paste and clipboard restoration remain unverified. No mouse/keyboard control, target activation or clipboard access was performed.

## Windows 0.1.0 implementation — 2026-09-05 (historical)

Environment: Windows x64, PowerShell 7.6.5, Node.js 24.14.0, .NET SDK 10.0.301, Electron 44.1.1. The Windows adapter is implemented and packaged. Actual target-input and visual behavior remain unverified.

### Verified without computer control

- `npm run check`: JavaScript syntax passes.
- `npm test`: 26 Node tests pass. Includes both platform window definitions in an Electron mock, IPC sender rejection, exact fixture authorization, configuration compatibility, queue ordering and cancellation, stale target refusal, process timeout/drain behavior, Unicode transport, and layout boundaries.
- `npm run build:native`: Windows x64 C# component compiles and publishes with its .NET runtime.
- `npm run test:windows`: 13 native pure-logic self-tests pass, plus capability and invalid-request protocol checks. These use fake input/clipboard ports; no UIA tree or real clipboard is accessed.
- `npm run package:win`: produces `dist/PhraseDock-win32-x64/PhraseDock.exe` and bundled resources. The Electron release archive SHA-256 matches `node_modules/electron/checksums.json` from the pinned npm package.
- `npm run verify:win`: packaged shared source/assets match the working tree byte-for-byte; native runtime files are present; executable branding is PhraseDock; all seven embedded icon images exactly match the existing ICO; the packaged helper passes the same pure self-tests.
- Visual evidence is limited to source/layout assertions and binary icon-resource comparison. No screenshot or GUI launch was performed.
- JavaScript and PowerShell scripts pass syntax checks; `git diff --check` passes. Native Mac source and existing icon assets were not modified.
- `npm run archive:win`: generated `dist/PhraseDock-0.1.0-win32-x64.zip` with adjacent `.sha256`. SHA-256: `623a4dad6813d60769867c44084bae96f15a9be5e84190800ddabb259564c9ff`. This is a local artifact, not a published release.

### Not executed

No computer-control tools, app activation, UI clicks, actual keyboard events, UIA desktop queries, clipboard reads/writes or screenshots were used. Neither the packaged application nor the local GUI fixture was launched. Real Codex input, Windows clipboard formats/ownership, focus retention, tray visibility, DPI/multiple displays, virtual desktops, full-screen behavior and IME composition await the [manual checklist](windows.md).

Mac Swift compilation, signing and actual runtime behavior were not rerun on this Windows host. Shared changes have synthetic regression tests only. Windows ARM64 and Intel/universal Mac remain unverified.

## Historical macOS baseline (before Windows implementation)

The following records describe the earlier Apple Silicon build, not fresh verification of this revision.

### Automated checks

- JavaScript syntax checks pass.
- Eight Node tests cover configuration validation, Unicode preservation, radial layouts for 1–12 phrases, display-edge clamping, and migration of saved window positions.
- The Swift macOS bridge compiles successfully.
- The packaged macOS application passes `codesign --verify --deep --strict`.

### macOS runtime checks

- Collapsed mode displays only the central `+` button and keeps hidden phrases inert.
- Expanding and collapsing the radial menu works through real UI clicks.
- Six keycap buttons render without overlap; the central right-click utility menu opens correctly.
- The accessibility bridge recognizes an editable text area, inserts at the current selection, verifies the resulting text, and restores the clipboard in the local input fixture.
- The floating panel does not submit text automatically.

### Signing continuity

Development builds use a dedicated local certificate and a designated requirement bound to both `com.phrasedock.desktop` and that certificate. A modified test build produced a different cdhash while preserving the same designated requirement, passed the earlier requirement check, and retained the existing macOS Accessibility authorization.

The private key remains in the developer's login keychain. No private key, PKCS#12 bundle, certificate export, or environment secret is stored in this repository. This local identity is not a Developer ID and is not suitable for public Gatekeeper distribution or Apple notarization.

## Remaining release validation

- Perform actual Windows input and visual acceptance from `docs/windows.md`; implementation and compilation alone do not establish runtime support.
- Perform actual Mac paste and clipboard-restoration acceptance in representative non-Codex applications.
- Build or test Intel/universal macOS output if it will be advertised.
- Use Developer ID signing and notarization for a public macOS binary.
- Package versioned release assets and publish SHA-256 checksums.

## Application icon assets

- macOS master: 1254×1254 RGB PNG with a full-bleed graphite background.
- Windows master: 1254×1254 RGBA PNG with genuinely transparent corners.
- Generated `.icns` contains the standard 16–1024px macOS iconset variants.
- Generated `.ico` contains seven PNG-compressed, 32-bit entries at 16、24、32、48、64、128、256px.
- The Windows 256px preview retains clean transparent padding and readable central `+` artwork.
