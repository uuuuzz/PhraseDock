import AppKit
import ApplicationServices
import Foundation

// One request on stdin, one JSON response on stdout. Never output editor/clipboard text.
struct Request: Decodable {
    let action: String
    let mode: String?
    let bundleIds: [String]
    let text: String?
    let expectedPid: Int32?
}

struct BridgeFailure: Error {
    let code: String
    let message: String
}

func reply(_ value: [String: Any]) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])) ?? Data("{}".utf8)
    FileHandle.standardOutput.write(data)
    exit(0)
}

func attribute(_ element: AXUIElement, _ key: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, key as CFString, &value) == .success else { return nil }
    return value
}

func focusedElement(_ application: AXUIElement) -> AXUIElement? {
    guard let value = attribute(application, kAXFocusedUIElementAttribute),
          CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return unsafeBitCast(value, to: AXUIElement.self)
}

struct Target {
    let pid: pid_t
    let bundleId: String
    let name: String
    let app: AXUIElement
    let element: AXUIElement
    let role: String
}

func checkTarget(_ request: Request) throws -> Target {
    guard AXIsProcessTrusted() else {
        throw BridgeFailure(code: "permission", message: "首次使用，请允许 AI Prompt Quick Appender 的辅助功能权限。")
    }
    guard let front = NSWorkspace.shared.frontmostApplication,
          let bundleId = front.bundleIdentifier else {
        throw BridgeFailure(code: "wrong-app", message: "没有找到当前应用，请重新点击输入框。")
    }
    let explicitlyAllowed = request.bundleIds.contains(bundleId)
    let blockedInUniversalMode: Set<String> = [
        "com.phrasedock.desktop", "com.github.Electron",
        "com.apple.SecurityAgent", "com.apple.loginwindow"
    ]
    let universallyAllowed = request.mode == "all" && !blockedInUniversalMode.contains(bundleId)
    guard explicitlyAllowed || universallyAllowed else {
        throw BridgeFailure(code: "wrong-app", message: request.mode == "all"
                            ? "请先点击其他应用中的输入框。"
                            : "当前应用不在允许列表中。")
    }
    if let expectedPid = request.expectedPid, expectedPid != front.processIdentifier {
        throw BridgeFailure(code: "focus-changed", message: "目标窗口已切换，请重新点击输入框。")
    }
    let app = AXUIElementCreateApplication(front.processIdentifier)
    AXUIElementSetMessagingTimeout(app, 0.6)
    guard let element = focusedElement(app) else {
        throw BridgeFailure(code: "no-editor", message: "没有找到输入光标，请先点击输入框。")
    }
    AXUIElementSetMessagingTimeout(element, 0.3)
    let role = attribute(element, kAXRoleAttribute) as? String ?? ""
    let subrole = attribute(element, kAXSubroleAttribute) as? String ?? ""
    guard [kAXTextAreaRole, kAXTextFieldRole, kAXComboBoxRole].contains(role),
          subrole != kAXSecureTextFieldSubrole,
          (attribute(element, kAXEnabledAttribute) as? Bool) != false else {
        throw BridgeFailure(code: "no-editor", message: "光标不在可输入的文本框里。")
    }
    return Target(pid: front.processIdentifier, bundleId: bundleId,
                  name: front.localizedName ?? "当前应用",
                  app: app, element: element, role: role)
}

func sameTarget(_ target: Target) -> Bool {
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == target.pid,
          let current = focusedElement(target.app) else { return false }
    return CFEqual(current, target.element)
}

func selectedRange(_ element: AXUIElement) -> CFRange? {
    guard let value = attribute(element, kAXSelectedTextRangeAttribute),
          CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
    let ax = unsafeBitCast(value, to: AXValue.self)
    guard AXValueGetType(ax) == .cfRange else { return nil }
    var range = CFRange()
    guard AXValueGetValue(ax, .cfRange, &range) else { return nil }
    return range
}

struct ClipboardSnapshot {
    let items: [[NSPasteboard.PasteboardType: Data]]
    init(_ pasteboard: NSPasteboard) throws {
        let version = pasteboard.changeCount
        var bytes = 0
        var saved: [[NSPasteboard.PasteboardType: Data]] = []
        for item in pasteboard.pasteboardItems ?? [] {
            var copy: [NSPasteboard.PasteboardType: Data] = [:]
            for type in item.types {
                guard let data = item.data(forType: type) else {
                    throw BridgeFailure(code: "clipboard-unavailable", message: "当前剪贴板无法完整备份，请先复制一小段普通文字后再试。")
                }
                bytes += data.count
                guard bytes <= 32 * 1024 * 1024 else {
                    throw BridgeFailure(code: "clipboard-large", message: "剪贴板内容过大，请先复制一小段普通文字后再试。")
                }
                copy[type] = data
            }
            saved.append(copy)
        }
        guard pasteboard.changeCount == version else {
            throw BridgeFailure(code: "clipboard-changed", message: "剪贴板正在变化，请稍后再试。")
        }
        items = saved
    }

    func restore(_ pasteboard: NSPasteboard, ifUnchanged version: Int) -> Bool {
        // Never overwrite a user's newer copy operation, even if its text happens to match.
        guard pasteboard.changeCount == version else { return false }
        pasteboard.clearContents()
        if !items.isEmpty {
            let objects = items.map { saved -> NSPasteboardItem in
                let item = NSPasteboardItem()
                for (type, data) in saved { item.setData(data, forType: type) }
                return item
            }
            return pasteboard.writeObjects(objects)
        }
        return true
    }
}

do {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard input.count <= 128 * 1024 else { throw BridgeFailure(code: "invalid", message: "请求过大。") }
    let request = try JSONDecoder().decode(Request.self, from: input)
    let target = try checkTarget(request)
    let base: [String: Any] = ["trusted": true, "pid": target.pid, "bundleId": target.bundleId,
                               "appName": target.name, "role": target.role]
    if request.action == "status" {
        reply(base.merging(["ok": true, "ready": true, "code": "ready", "message": "光标已就位，点击即可插入。"], uniquingKeysWith: { _, new in new }))
    }
    guard request.action == "insert", let text = request.text,
          !text.isEmpty, text.utf16.count <= 8000, !text.contains("\0") else {
        throw BridgeFailure(code: "invalid", message: "提示词内容无效。")
    }
    let flags = CGEventSource.flagsState(.combinedSessionState)
    guard flags.intersection([.maskCommand, .maskControl, .maskAlternate, .maskShift]).isEmpty else {
        throw BridgeFailure(code: "modifier-held", message: "请松开修饰键，再点击提示词。")
    }
    let before = attribute(target.element, kAXValueAttribute) as? String
    let range = selectedRange(target.element)
    var expected: String?
    if let before, let range, range.location >= 0, range.length >= 0,
       range.location <= (before as NSString).length,
       range.length <= (before as NSString).length - range.location {
        expected = (before as NSString).replacingCharacters(in: NSRange(location: range.location, length: range.length), with: text)
    }

    let pasteboard = NSPasteboard.general
    let snapshot = try ClipboardSnapshot(pasteboard)
    guard sameTarget(target) else { throw BridgeFailure(code: "focus-changed", message: "输入光标已改变，本次没有插入。") }
    let source = CGEventSource(stateID: .combinedSessionState)
    guard let down = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: true),
          let up = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: false) else {
        throw BridgeFailure(code: "event-failed", message: "无法创建粘贴操作。")
    }
    pasteboard.clearContents()
    guard pasteboard.setString(text, forType: .string) else {
        _ = snapshot.restore(pasteboard, ifUnchanged: pasteboard.changeCount)
        throw BridgeFailure(code: "clipboard-write", message: "暂时无法写入剪贴板。")
    }
    let pasteVersion = pasteboard.changeCount
    guard sameTarget(target) else {
        _ = snapshot.restore(pasteboard, ifUnchanged: pasteVersion)
        throw BridgeFailure(code: "focus-changed", message: "输入光标已改变，本次没有插入。")
    }
    // Exactly Command+V. Never send Return, auto-focus an app, or retry a paste.
    down.flags = .maskCommand
    up.flags = .maskCommand
    down.post(tap: .cghidEventTap)
    up.post(tap: .cghidEventTap)

    var verified = false
    let deadline = Date().addingTimeInterval(1.2)
    repeat {
        Thread.sleep(forTimeInterval: 0.04)
        if let expected, let actual = attribute(target.element, kAXValueAttribute) as? String, actual == expected {
            verified = true
            break
        }
    } while Date() < deadline
    // Delay restoration slightly after acknowledgement; without AX acknowledgement
    // the bounded wait above gives the target time to consume its paste event.
    Thread.sleep(forTimeInterval: 0.12)
    let restored = snapshot.restore(pasteboard, ifUnchanged: pasteVersion)
    reply(base.merging([
        "ok": true, "ready": true, "verified": verified, "clipboardRestored": restored,
        "code": verified ? "inserted" : "sent-unverified",
        "message": verified ? "已插入，继续点击可组合提示词。" : "已发送粘贴，请确认输入框中的结果。"
    ], uniquingKeysWith: { _, new in new }))
} catch let failure as BridgeFailure {
    reply(["ok": false, "ready": false, "trusted": AXIsProcessTrusted(), "code": failure.code, "message": failure.message])
} catch is DecodingError {
    reply(["ok": false, "ready": false, "trusted": AXIsProcessTrusted(), "code": "invalid", "message": "系统组件收到无效请求。"])
} catch {
    reply(["ok": false, "ready": false, "trusted": AXIsProcessTrusted(), "code": "system-error",
           "message": "系统组件暂时不可用，请重新点击输入框后再试。"])
}
