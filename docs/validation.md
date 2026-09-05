# Validation

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
- Recheck the Mac application after the shared lifecycle/queue changes.
- Build or test Intel/universal macOS output if it will be advertised.
- Use Developer ID signing and notarization for a public macOS binary.
- Package versioned release assets and publish SHA-256 checksums.

## Application icon assets

- macOS master: 1254×1254 RGB PNG with a full-bleed graphite background.
- Windows master: 1254×1254 RGBA PNG with genuinely transparent corners.
- Generated `.icns` contains the standard 16–1024px macOS iconset variants.
- Generated `.ico` contains seven PNG-compressed, 32-bit entries at 16、24、32、48、64、128、256px.
- The Windows 256px preview retains clean transparent padding and readable central `+` artwork.
