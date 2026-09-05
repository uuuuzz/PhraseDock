[简体中文](architecture.md) | **English**

# Platform architecture

Display names: **AI Prompt Quick Appender** / **AI 常用提示词快捷追加器**. `package.json` defines `productName` and `productNameZh`, which are read by the main process and packaging metadata. The renamed application explicitly retains the original `PhraseDock` userData/sessionData location for configuration and single-instance continuity. The repository, native namespaces, and application identifiers retain their internal names.

## Design

Electron owns the shared interface, configuration, menus, and lifecycle. Mac uses a Swift helper for AX and Quartz. Windows uses a C#/.NET 10 helper with a bundled runtime for UI Automation, Win32 input, and clipboard APIs. The project does not modify Codex itself.

The insertion path is:

```text
Renderer → restricted preload IPC → main-process target check
→ platform.insert → native focus recheck → paste
→ result verification → conditional clipboard restoration
```

The renderer sends a prompt ID; the main process gets its text from validated configuration. The renderer uses sandboxing and context isolation, disables Node integration, rejects navigation and new windows, and displays configuration text through `textContent`. No remote resources or automatic updater are used.

The radial menu persists its screen-space center. Before expansion, the main process enlarges the transparent native window around that center; the renderer then animates the keycaps outward. Collapse animates first, then shrinks the window to 72×72 px. Restricted boolean IPC toggles `setIgnoreMouseEvents(..., { forward: true })` so transparent space does not block the application beneath it.

## Platform interface

`src/platform/index.cjs` selects an adapter with these methods:

```js
configure(target)                         // Update allowed target applications
status()                                  // Promise<Status>
insert(text, expectedPid, expectedTarget)  // Promise<Result>; third argument optional
close()                                   // Promise<void>; wait for insert cleanup
```

`Status` reports `ok`, `ready`, `trusted`, `code`, and `message`, with target metadata such as `pid`, `appName`, `bundleId`, `role`, or `targetKey` when available on the platform.

After a paste, `Result` includes `verified` and `clipboardRestored`. `ok: true` indicates that the paste was dispatched; only `verified: true` indicates successful AX/UIA readback. Windows also returns `eventsSent`, `clipboardStatus`, and `targetKey`.

Windows clipboard states are `restored`, `user-changed`, `failed`, and `untouched`. Preserving a newer user copy is not a restoration error.

The renderer queues at most eight operations. It proceeds only after `code: inserted` and `verified: true`; unknown results, failures, and configuration reloads stop remaining work. Windows binds the queue to the first process, HWND, and UIA runtime ID. Mac adds process binding to its existing per-operation AX element checks.

The native protocol is one stdin JSON request and one stdout JSON response. Prompt text is never placed in command-line arguments. Errors do not print input text, selected text, clipboard data, or entire configuration files.

`bridge-client.cjs` handles UTF-8 decoding, response limits, concurrency, and shutdown. An insert timeout returns `pending`, retains the native process, and blocks new inserts until it exits. Only read-only status processes may be killed on timeout. Application shutdown waits for insert cleanup. Unexpected system termination cannot guarantee restoration.

## Windows implementation

1. `schemaVersion: 1` remains compatible. Windows target fields are `windowsExecutables` and `windowsPackageFamilyNames`; missing fields receive in-memory defaults without rewriting user files.
2. `WindowsPort.cs` checks foreground ownership, executable or package identity, integrity level, focused-control ancestry, and editability. The Store Codex rule uses its OS-reported package family rather than broadly allowing its `ChatGPT.exe` host filename. Read-only UIA queries use background MTA workers with bounded waits.
3. `PasteEngine.cs` manages focus/modifier checks, dispatch, acknowledgement, and cleanup in `finally`. `ClipboardLease.cs` holds a lock across backup/replacement and checks the sequence number under the restoration lock. Unsafe formats are rejected before modification.
4. The shared Electron panel uses `focusable: false`, transparency, and mouse pass-through. Windows adds ICO metadata, AppUserModelID, and its tray icon. Actual desktop behavior awaits manual acceptance.
5. The local fixture is allowed only by its exact HWND and owning main-process PID; the entire Electron executable is not added to the allowlist.
6. `package:win` validates the official Electron archive, builds the bundled native runtime, runs pure self-tests, and writes `dist/<version>/`. Mac retains its signing workflow and reads the same package version. See the [Windows guide](windows.en.md).
7. `diagnose:win` is an explicit read-only entry point reporting identity and control-capability metadata. It does not return input content or invoke pasting; the paste engine also rejects diagnostic actions.

Windows implementation, compilation, and synthetic tests are complete; actual input and visual behavior are not yet verified. Linux returns `unsupported` explicitly.

## Future features

Graphical prompt editing, multiple groups, sorting, shortcuts, launch at login, allowlist editing, and cross-device configuration sync. Data remains local until synchronization is deliberately introduced.

[Back to the English README](../README.en.md)
