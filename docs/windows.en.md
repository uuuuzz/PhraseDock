[简体中文](windows.md) | **English**

# Windows usage and acceptance

English product name: **AI Prompt Quick Appender**. Chinese display name: **AI 常用提示词快捷追加器**.

The Windows x64 implementation, compilation, and portable packaging are complete. The initial implementation did not perform real desktop tests. Version 0.1.1 investigated the actual foreground process/package identity after a user report and added read-only control diagnostics. Real pasting and clipboard restoration remain unverified. The recorded investigation did not control the mouse or keyboard, activate or switch the target app, send text, or access the real clipboard.

## Launching and updating

- Exit the older version, then open `dist/0.1.2/PhraseDock-win32-x64/PhraseDock.exe`. Keep the entire directory together. You can create a desktop shortcut to that executable. A single-instance lock means that starting a new copy while the old one is running brings back the old instance.
- Application and window icons use `resources/icons/PhraseDock.ico`. The floating menu shares the Mac HTML/CSS and interaction code. Windows uses the color icon in its tray; the Mac menu bar uses a monochrome template.
- The main window is configured to stay on top without taking focus or occupying a taskbar entry. Drag its central outer ring to move it; transparent space passes mouse input through. System menus and font rendering follow the operating system.
- User prompts are stored in `%APPDATA%\PhraseDock\phrases.json`, with `window.json` alongside it for position. Moving or rebuilding the application does not overwrite these files.
- Version 0.1.2 uses the new Chinese and English display names in titles, the tray, menus, the test page, and executable metadata. Internal executable and configuration paths retain `PhraseDock`, preserving existing presets.
- Missing Windows configuration fields receive in-memory defaults for `Codex.exe` and the Store Codex package. Existing prompts and files are preserved. Use `target.windowsExecutables` for unpackaged targets and `target.windowsPackageFamilyNames` for packaged targets. An explicit empty package-family array disables the default Store package match.
- If the status is not ready, hover over the central button to see why and place focus in an actual text input. The Mac Accessibility settings entry does not appear on Windows.

The current interface uses these Chinese menu labels:

| Action | Menu label |
| --- | --- |
| Edit prompt configuration | 编辑提示词配置 |
| Reload prompts | 重新加载提示词 |
| Open the local input test | 打开输入测试 |
| Show the application | 显示 AI 常用提示词快捷追加器 |
| Hide the application | 隐藏 AI 常用提示词快捷追加器 |
| Quit | 退出 AI 常用提示词快捷追加器 |

## Input and safeguards

1. Check the foreground HWND's owning executable filename or OS-reported package family, process integrity level, and the focused UI Automation control's window ancestry. The Store Codex identity is `OpenAI.Codex_2p2nqsd0c76g0`; on the investigated computer its window is hosted in `ChatGPT.exe`. Matching does not depend on a window title or a versioned installation path.
2. Require an enabled, focused, non-password Edit, Document, or ComboBox control whose ValuePattern or TextPattern reports editability.
3. Check the target before modifying the clipboard, then check the same window and UIA runtime ID again after preparing it. Modifier keys must be released.
4. Send one sequence of Ctrl-down, V-down, V-up, and Ctrl-up. Do not activate a window, move the caret, replace the control's value directly, or press Enter. If the system accepts only part of the sequence, release the keys already pressed without retrying the paste.
5. If UIA exposes complete text and a single selection, calculate the expected result and wait for readback. Otherwise return `sent-unverified` and clear the remaining click queue.
6. Check the clipboard sequence number before restoring it. Preserve any newer user copy. A restoration failure produces a notice and stops the queue.

On Windows, queued prompts bind to the first operation's process, window, and control. Mac retains the Swift bridge's per-operation AX focus checks, while the shared queue also binds to the process. Cross-request control identification is not claimed to be identical across platforms.

## Clipboard scope

The implementation handles copyable HGLOBAL formats, such as text, HTML/RTF, DIB images, file lists, and some registered formats. Bitmaps and enhanced metafiles use their corresponding Windows copy/free APIs. Backup and initial replacement share one clipboard lock. The total backup limit is 32 MiB and the format-count limit is 256.

Unreadable or oversized data, private handles, owner-display formats, palettes, legacy metafile-picture data, and specified OLE object formats are rejected before modification. Implementing these format paths does not establish that every real clipboard object has been tested. Clipboard contention receives a bounded wait; restoration failure remains visible to the user.

A timed-out insert process keeps running to finish cleanup and blocks new pastes. Quitting also waits for it. Read-only status processes may be stopped after timeout. System crashes, forced termination, exceptionally slow targets, and special IME behavior still require real-world validation.

## Manual acceptance checklist — not yet completed

| Scenario | Expected behavior |
| --- | --- |
| Launch, expand, collapse, press feedback | Shared Mac layout and animation; every button is visible |
| Light/dark Windows tray, executable, shortcuts | Correct existing application icon |
| Prompt clicks, central button, ring dragging, context menu | Target input focus is retained; continue after manually dismissing menus as needed |
| Local fixture: insertion in the middle and selection replacement | Exact expected text without automatic submission |
| Real Codex input | Recognize the current version's UIA control and insert into the intended window |
| Chinese, emoji, multiline text, boundary whitespace, queued clicks | Preserve content and order; stop queued work on an unverified result |
| Switching windows or inputs within the same app | Stop the queue instead of pasting into the new control |
| Disallowed apps, read-only/password controls, held modifiers | No clipboard modification or paste events |
| Target running as administrator | Clear permission-mismatch message |
| Empty clipboard, text, images, file lists, custom formats | Restore supported formats completely; reject unsupported ones before modification |
| A newer copy during pasting or clipboard contention | Preserve new data and report failures accurately |
| Invalid configuration or reload while collapsed | Visible notice; preserve the last valid configuration |
| 100%/125%/150% scaling, multiple displays, disconnected display | Visible window, correct dragging/pass-through, recoverable position |
| Hide, tray restore, restart, quit during insertion | Correct state/position; normal shutdown waits for cleanup |
| Virtual desktops, full-screen apps, Chinese IME composition | Record separately; do not assume Mac-equivalent behavior |

## Building

Install Node.js 22.12+, PowerShell 7, and the .NET 10 SDK. Run `npm ci`, then `npm run package:win`. The packaged application includes its .NET runtime, so end users do not need the SDK. After `npm run build:native`, run `npm run test:windows` for pure-logic and protocol checks using fake input/clipboard ports.

This is a local portable build. It has no Windows installer, automatic updater, or Authenticode signature. Binary artifacts remain in local `dist`; they have not been published as a Release.

## Read-only diagnostics

`npm run diagnose:win` sends a separate `diagnose` request to the native component. It reports the foreground HWND, PID, executable filename, package family, and match result. Only an allowed app's focused control is inspected for type, framework, focus, editability, and related capability metadata.

The command does not return control names, input text, selections, or clipboard contents, and never enters the paste transaction. `allowed: false` is expected when a browser, terminal, or other disallowed application is in the foreground.

API references: [Electron windows](https://www.electronjs.org/docs/latest/api/base-window), [UIA text model](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-understandingtheuiautomationtextobjectmodel), [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [clipboard ownership](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata), and [clipboard sequence numbers](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber).

[Back to the English README](../README.en.md)
