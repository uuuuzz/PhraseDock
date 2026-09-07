[简体中文](README.md) | **English**

# AI Prompt Quick Appender

Quickly append frequently used AI prompts at the current cursor while keeping the input focused. Combine prompts with successive clicks, review the result, then send it yourself.

One repository maintains the macOS and Windows versions. They share the prompt menu, configuration, and interaction logic; native input is handled by Swift on macOS and C# on Windows.

**Project status:** macOS Apple Silicon has been rebuilt, signed, and rechecked for universal target recognition; actual pasting into additional applications still needs per-app acceptance. The Windows x64 adapter is implemented, compiled, tested with synthetic checks, and packaged as a portable application. Real Codex pasting, clipboard restoration, and visual/focus behavior still require manual acceptance. See the [validation record](docs/validation.md) and [Windows usage and acceptance guide](docs/windows.en.md).

This is the English documentation. The application currently uses Chinese menu labels and default prompts; the instructions below include the labels you will see.

## Usage

### Windows

1. Open `dist/0.1.3/PhraseDock-win32-x64/PhraseDock.exe` and keep the entire application directory together. Exit the previous version before opening the new one.
2. Click the Codex input field so that the caret is active.
3. Click the central `+` to expand the prompts, then click a keycap to insert its text. Click `−` to collapse the menu, or drag the outer ring to move it.
4. Right-click the central button or the Windows tray icon to edit or reload prompts, open the input test, hide the app, or quit.

For first use, manually check the local fixture through **Open input test** (`打开输入测试`). The packaged application includes its .NET runtime; end users do not need to install it separately. If you see a permissions warning, check whether the target app is running as administrator. Normal use should run both applications with ordinary user privileges.

### macOS

1. Open the packaged `PhraseDock.app`. Put it in a stable location before granting permission.
2. On first use, right-click the central button and choose **Open Accessibility settings** (`打开辅助功能设置`), then enable **AI Prompt Quick Appender** in System Settings. If it is missing, use `+` to add the `PhraseDock.app` you are actually running.
3. Return to the target application and click a standard text input. Once the caret is visible, expand `+` and click a prompt.
4. The green dot on the central button indicates that the target input is ready. The app inserts text without pressing Enter to submit it.

### Shared controls

- At startup, only the central `+` is visible. Prompts expand around it, and the center becomes `−`. Click it again to collapse the menu.
- The menu stays open after inserting a prompt so you can combine several prompts.
- Drag the outer ring of the central button to move the panel. Its center position is saved automatically.
- The central context menu and the menu-bar/tray icon provide editing, reloading, testing, hiding, and quitting.
- **Open input test** (`打开输入测试`) opens a local text field for insertion, selection replacement, repeated clicks, and multiline checks. Closing it restores the normal configured target restrictions.
- Text is inserted at the caret. Selected text is replaced according to the target application's normal paste behavior.
- Hovering over an input field is insufficient; click it to give it keyboard focus first.
- Unverified paste results or clipboard restoration failures stop the remaining queue. No paste is retried automatically. Up to eight clicks can be queued.
- If a notification needs to appear while the menu is collapsed, the menu expands so the complete message is visible.

## Customize prompts

Choose **Edit prompt configuration** (`编辑提示词配置`), edit the JSON file, save it, and choose **Reload prompts** (`重新加载提示词`). On first launch, the defaults from `config/phrases.json` are copied to:

```text
macOS:   ~/Library/Application Support/PhraseDock/phrases.json
Windows: %APPDATA%\PhraseDock\phrases.json
```

The application reads this user configuration. Later builds do not overwrite it. Git synchronizes the repository defaults, not each computer's personal configuration.

The visible product name is AI Prompt Quick Appender. Executable filenames, configuration directories, application identifiers, and the signing certificate retain the internal project name `PhraseDock` to preserve existing configuration and permission continuity.

Example configuration using English prompts:

```json
{
  "schemaVersion": 1,
  "target": {
    "macMode": "all",
    "macBundleIds": ["com.openai.codex"],
    "windowsExecutables": ["Codex.exe"],
    "windowsPackageFamilyNames": ["OpenAI.Codex_2p2nqsd0c76g0"]
  },
  "phrases": [
    { "id": "analyze", "label": "Analyze first", "text": "Analyze first. Do not change the code yet." },
    { "id": "check", "label": "Check results", "text": "Check the result.\nExplain what has and has not been verified." }
  ]
}
```

Configure 1–12 buttons. Each prompt supports up to 8,000 UTF-16 code units. Text is preserved literally, including newlines and leading/trailing whitespace. IDs must be unique. An invalid edit does not replace the last valid configuration; an invalid startup file produces a notice and temporarily uses the defaults.

New macOS installations default to `macMode: "all"`, which accepts standard Accessibility-recognized text inputs in the current foreground application. Secure fields, disabled controls, the login window, security-agent processes, and the app itself are rejected. Canvas-based, custom, and some rich-text editors may not be recognized. Set `macMode` to `allowlist` to restrict macOS to `macBundleIds`. Older Mac configurations without `macMode` remain allowlisted.

The Windows target policy is unchanged. Older Windows 0.1.0 configurations remain valid, and missing Windows fields receive defaults in memory without rewriting the file. The Store version of Codex may host its window in `ChatGPT.exe`; it is identified by the OS-reported package family `OpenAI.Codex_2p2nqsd0c76g0`. This rule does not admit another package or an unpackaged executable just because it has the same filename. Unpackaged targets use the `windowsExecutables` filename allowlist, which does not accept paths or wildcards.

The foreground window and its focused editable control are also checked. Eligible text inputs anywhere in an allowed app can be targets; this is not limited to the main chat composer.

## Stable local signing and macOS Accessibility permission

Earlier builds used ad-hoc signing. Repackaging changed the designated code requirement, which could leave Accessibility permission associated with an older build. A previous local investigation found `Failed to match existing code requirement` in system logs.

The current build process uses the `PhraseDock Local Code Signing` certificate in the keychain and writes a stable root-app requirement tied to both the bundle ID and certificate fingerprint. The private key stays in the login keychain, and no system trust-root setting is added. On a Mac used for development, run:

```sh
npm run setup:signing
```

This creates a local 3,072-bit RSA code-signing certificate valid for ten years. Temporary private-key and PKCS#12 files are deleted after import. Builds stop if the certificate is missing; they do not fall back to ad-hoc signing.

In **Privacy & Security → Accessibility**, use `+` to select the exact `PhraseDock.app` you run. If the existing entry is stale, remove it and add the current app again. System Settings may request local authentication. Quit and reopen AI Prompt Quick Appender afterward.

If permission remains associated with an old signature, the following system command resets Accessibility permission for this app only:

```sh
tccutil reset Accessibility com.phrasedock.desktop
```

This revokes the app's permission, so grant it again in System Settings. Keep the application identifier in the command to avoid resetting other apps. This procedure resolved the previously recorded local permission issue.

The first build using the stable certificate needs permission to be associated with it once. Subsequent builds can change their cdhash while preserving the same designated requirement. Moving to another Mac, deleting the certificate, or regenerating it requires authorization again. The local certificate is not a Developer ID and does not provide public Gatekeeper distribution or notarization; public Mac releases still need Developer ID signing and notarization.

## Development and packaging

### Windows

Requirements: Node.js 22.12+, PowerShell 7, and the .NET 10 SDK. The current local build was checked on Windows x64.

```powershell
npm ci
npm run build:native
npm run check
npm test
npm run test:windows
npm run package:win
npm run archive:win
```

Run `npm start` to launch the development application manually. Windows uses the existing `.ico` asset and does not run the Mac icon-generation or signing scripts. Electron is downloaded from the official GitHub release and checked against the SHA-256 manifest in the pinned npm package.

`test:windows` runs pure-logic and invalid-request protocol checks. It does not inspect the desktop or access the real clipboard.

Output is placed in `dist/<version>/PhraseDock-win32-x64/`, currently `dist/0.1.3/PhraseDock-win32-x64/`. Keep `PhraseDock.exe` together with the native component and its bundled runtime. Versioned output avoids overwriting a running older build. Both Electron and the native component target the build machine's architecture; Windows ARM64 has not been verified on hardware.

For identification issues, run `npm run diagnose:win` while the intended target has focus. This explicit read-only command reports foreground process/package identity and control capabilities. It does not return input text, selections, or clipboard contents, and does not send keys.

`package:win` verifies packaged source, icon resources, and native self-tests. `archive:win` creates a ZIP containing the application directory and an adjacent `.sha256` file. These artifacts remain under the Git-ignored `dist` directory.

### macOS

Requirements: Node.js 22.12+ and Xcode Command Line Tools, including Swift.

```sh
npm ci
npm run setup:signing
npm run build:icons
npm start
```

Development processes may appear as Electron. For daily use, run the packaged application and grant Accessibility permission to AI Prompt Quick Appender.

```sh
npm run check
npm test
npm run package:mac
```

The Apple Silicon output is `dist/PhraseDock-darwin-arm64/PhraseDock.app`. Building on an Intel Mac produces an x64 version. Historical native verification covers Apple Silicon; Intel/universal builds and the latest Mac changes require their own checks. Mac packaging uses the project's local signing certificate and has no Developer ID notarization.

## Project structure

```text
config/phrases.json             Shared default prompts
src/main.cjs                   Lifecycle, windows, configuration, adapter dispatch
src/preload.cjs                Restricted renderer communication API
src/core/config.cjs            Configuration validation and position recovery
src/core/radial-layout.cjs     Radial layout and center-anchor calculations
src/renderer/                 Shared HTML, CSS, and JavaScript UI
src/platform/macos.cjs         Mac native bridge adapter
src/platform/windows.cjs       Windows native bridge adapter
src/platform/bridge-client.cjs Shared process management and timeout cleanup
native/macos/                  Swift input component
native/windows/                C# input component and pure-logic self-tests
resources/icons/               ICNS, ICO, and platform PNG masters
scripts/                       Build, packaging, and validation commands
test/                          Configuration, layout, lifecycle, and queue tests
docs/architecture.en.md        Platform contracts and extension notes
docs/validation.md             Verification record and remaining limitations
docs/windows.en.md             Windows usage and manual acceptance
```

Both platforms' source, icons, and scripts are versioned together. `node_modules/`, `build/`, `dist/`, and the C# `bin/obj` directories are ignored. User data lives outside the repository. Mac applications must still be built, signed, and checked on a Mac.

## Input behavior and boundaries

- The floating panel is configured not to take keyboard focus. The foreground app and input control are rechecked before pasting.
- On macOS, standard text areas, text fields, and combo boxes in the foreground application are accepted by default. PhraseDock itself, login/security processes, secure inputs, and disabled controls are rejected. Windows continues to use executable and package-family allowlists.
- Missing permission, a disallowed target, a non-editable focus, or held modifier keys prevent the paste.
- Prompt text crosses stdin JSON rather than shell command interpolation. Input values and clipboard contents are not logged. The runtime workflow does not connect to a remote service.
- The clipboard is used temporarily. Readable supported formats are backed up and restored after pasting; a newer user copy is preserved. Unreadable or oversized clipboard data, including backups above 32 MiB, produces a notice.
- On Mac, AX readback verifies the complete expected text where possible. An unverified result is reported for the user to check and is never automatically retried. Even a bounded restoration delay may be insufficient for an exceptionally slow target.
- Windows uses UI Automation to inspect the input and selection, then sends one `Ctrl+V`. Backup/replacement and the restoration sequence check take place under clipboard locks. Unsafe private/OLE formats, palettes, and legacy metafile-picture formats are rejected before modification; see the [Windows guide](docs/windows.en.md).
- A timed-out insert process is retained for cleanup and blocks new inserts until it exits. Application shutdown also waits for it. Process crashes or forced system termination cannot guarantee clipboard restoration.
- Finish any active Chinese IME composition before clicking a prompt. Cross-IME composition behavior needs further real-world testing.

## Radial keycap interface

- Collapsed size: 72×72 px, with a 64 px central control. Expanded transparent bounds are 344×284, 440×340, or 560×420 px, depending on prompt count.
- The default six prompts are arranged clockwise around a single ellipse. Layout checks cover all supported counts from 1 to 12 for overlap and clipping.
- Pressed keycaps move down 2 px and scale to 98%, retaining feedback for at least 72 ms. Expansion takes about 145 ms with 8 ms staggered delays.
- The central clickable diameter is 56 px, surrounded by a 4 px drag ring. Queued clicks run in order without disabling all other buttons.
- Transparent space uses `setIgnoreMouseEvents` to pass mouse input to the application underneath. The central control, drag ring, and keycaps remain interactive.
- The saved position is the panel's center. Expanding near a display edge shifts it inward just enough to fit.

## License

AI Prompt Quick Appender uses the [MIT License](LICENSE).

## Application icons

- `resources/icons/source/PhraseDock-macos.png`: full-bleed graphite master; macOS applies the final rounded mask.
- `resources/icons/source/PhraseDock-windows.png`: master with a real alpha channel.
- `npm run build:icons` creates the Mac `.icns` and a Windows `.ico` containing 16, 24, 32, 48, 64, 128, and 256 px images.
- Each Windows image uses 90% of the transparent canvas, leaving roughly 5% padding per side.
- Mac packaging regenerates the icons and embeds `PhraseDock.icns`. Its menu-bar icon remains a simplified monochrome template.

## References

- [Electron window types and focus](https://www.electronjs.org/docs/latest/api/base-window)
- [Apple nonactivating panels](https://developer.apple.com/documentation/appkit/nswindow/stylemask-swift.struct/nonactivatingpanel)
- [Apple panel keyboard focus](https://developer.apple.com/documentation/appkit/nspanel/becomeskeyonlyifneeded)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
