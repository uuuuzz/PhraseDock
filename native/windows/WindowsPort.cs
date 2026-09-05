using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Automation;
using System.Windows.Automation.Text;

namespace PhraseDock;

internal sealed class WindowsPort(Request request) : IPastePort
{
    private const int MaxEditorLength = 128 * 1024;
    // Explicit read-only support command. Never return names/values/selection
    // contents from UIA, and never touch the clipboard or send input here.
    internal object Diagnose() => Query<object>(() => {
        var window = Native.GetForegroundWindow();
        Native.GetWindowThreadProcessId(window, out var pid);
        if (window == 0 || pid == 0) return new { ok = false, code = "no-foreground", message = "没有前台窗口。", hwnd = window.ToInt64(), pid };
        var executable = Path.GetFileName(Native.ProcessPath(pid));
        var packageFamily = Native.PackageFamilyName(pid);
        var allowed = TargetIdentity.IsAllowed(request, executable, packageFamily);
        var data = new Dictionary<string, object?> { ["ok"] = true, ["code"] = "diagnostics", ["message"] = "只读窗口身份诊断。",
            ["hwnd"] = window.ToInt64(), ["pid"] = pid, ["executable"] = executable, ["packageFamilyName"] = packageFamily, ["allowed"] = allowed };
        if (allowed) {
            var focused = AutomationElement.FocusedElement;
            if (focused is not null) {
                data["controlType"] = focused.Current.ControlType.ProgrammaticName;
                data["frameworkId"] = focused.Current.FrameworkId;
                data["hasKeyboardFocus"] = focused.Current.HasKeyboardFocus;
                data["isEnabled"] = focused.Current.IsEnabled;
                data["isPassword"] = focused.Current.IsPassword;
                data["belongsToForeground"] = BelongsToWindow(focused, window);
                if (!focused.Current.IsPassword) {
                    if (focused.TryGetCurrentPattern(ValuePattern.Pattern, out var value)) data["valueReadOnly"] = ((ValuePattern)value).Current.IsReadOnly;
                    if (focused.TryGetCurrentPattern(TextPattern.Pattern, out var text)) {
                        var attribute = ((TextPattern)text).DocumentRange.GetAttributeValue(TextPattern.IsReadOnlyAttribute);
                        data["textReadOnly"] = attribute is bool boolean ? boolean : "unsupported";
                    }
                }
            }
        }
        return data;
    });
    // UIA providers are external processes and may hang. Only these read-only
    // queries run on disposable background MTA workers; clipboard cleanup does not.
    private static T Query<T>(Func<T> read, int timeout = 1200)
    {
        var task = Task.Run(read);
        try { if (!task.Wait(timeout)) throw new BridgeFailure("timeout", "输入框响应超时，请稍候。"); }
        catch (AggregateException) { return task.GetAwaiter().GetResult(); }
        return task.GetAwaiter().GetResult();
    }

    public Target Inspect() => Query(() => {
        var window = Native.GetForegroundWindow();
        if (window == 0) throw new BridgeFailure("wrong-app", "先点击 Codex 的输入框，再点短语。");
        Native.GetWindowThreadProcessId(window, out var pid);
        if (pid == 0) throw new BridgeFailure("wrong-app", "没有找到目标应用。");
        var isFixture = request.FixturePid == pid && request.FixtureHwnd == window.ToInt64().ToString();
        var executable = Path.GetFileName(Native.ProcessPath(pid));
        var packageFamily = isFixture ? null : Native.PackageFamilyName(pid);
        if (!isFixture && !TargetIdentity.IsAllowed(request, executable, packageFamily))
            throw new BridgeFailure("wrong-app", "先点击 Codex 的输入框，再点短语。");
        if (Native.IntegrityLevel(pid) > Native.IntegrityLevel((uint)Environment.ProcessId))
            throw new BridgeFailure("permission", "目标应用的权限更高，请以普通权限运行目标应用后再试。");
        var focused = AutomationElement.FocusedElement;
        if (focused is null || !BelongsToWindow(focused, window))
            throw new BridgeFailure("no-editor", "没有找到输入光标，请先点击输入框。");
        var current = focused.Current;
        if (!current.IsEnabled || current.IsPassword || !current.HasKeyboardFocus ||
            current.ControlType != ControlType.Edit && current.ControlType != ControlType.Document && current.ControlType != ControlType.ComboBox)
            throw new BridgeFailure("no-editor", "光标不在可输入的文本框里。");
        var editable = false;
        if (focused.TryGetCurrentPattern(ValuePattern.Pattern, out var value)) editable = !((ValuePattern)value).Current.IsReadOnly;
        if (!editable && focused.TryGetCurrentPattern(TextPattern.Pattern, out var text))
            editable = ((TextPattern)text).DocumentRange.GetAttributeValue(TextPattern.IsReadOnlyAttribute) is false;
        if (!editable) throw new BridgeFailure("no-editor", "当前控件没有提供可编辑文本接口。");
        if (Native.GetForegroundWindow() != window) throw new BridgeFailure("focus-changed", "目标窗口已切换。");
        var name = isFixture ? "输入测试" : string.Equals(packageFamily, TargetIdentity.CodexPackageFamily, StringComparison.OrdinalIgnoreCase)
            ? "Codex" : Path.GetFileNameWithoutExtension(executable);
        return new Target((int)pid, window, Key(pid, window, focused), name, focused);
    });

    private static bool BelongsToWindow(AutomationElement element, nint window)
    {
        // Chromium may expose the focused element from a renderer process.
        // Verify ancestry to the actual foreground HWND, not just its PID.
        for (var depth = 0; depth < 64 && element is not null; depth++) {
            if (new nint(element.Current.NativeWindowHandle) == window) return true;
            element = TreeWalker.RawViewWalker.GetParent(element);
        }
        return false;
    }
    private static string Key(uint pid, nint hwnd, AutomationElement element) =>
        $"{pid}:{hwnd:X}:{string.Join('.', element.GetRuntimeId())}";

    public bool ModifiersHeld() => new[] { 0x10, 0x11, 0x12, 0x5B, 0x5C }
        .Any(key => (Native.GetAsyncKeyState(key) & 0x8000) != 0);

    public bool SameTarget(Target target) => Query(() => {
        if (Native.GetForegroundWindow() != target.Hwnd) return false;
        Native.GetWindowThreadProcessId(target.Hwnd, out var pid);
        var focused = AutomationElement.FocusedElement;
        return pid == target.Pid && focused is not null && Key(pid, target.Hwnd, focused) == target.Key;
    }, 650);

    public Selection? ReadSelection(Target target)
    {
        try { return Query(() => {
            var element = (AutomationElement)target.Element!;
            if (!element.TryGetCurrentPattern(TextPattern.Pattern, out var pattern)) return null;
            var text = (TextPattern)pattern;
            var selected = text.GetSelection();
            if (selected.Length != 1) return null;
            var before = text.DocumentRange.GetText(MaxEditorLength + 1);
            if (before.Length > MaxEditorLength) return null;
            var prefix = text.DocumentRange.Clone();
            prefix.MoveEndpointByRange(TextPatternRangeEndpoint.End, selected[0], TextPatternRangeEndpoint.Start);
            var suffix = text.DocumentRange.Clone();
            suffix.MoveEndpointByRange(TextPatternRangeEndpoint.Start, selected[0], TextPatternRangeEndpoint.End);
            return new Selection(before, prefix.GetText(MaxEditorLength + 1), suffix.GetText(MaxEditorLength + 1));
        }); } catch { return null; }
    }

    public IClipboardLease Publish(string text) => ClipboardLease.Publish(text);

    public int SendPaste()
    {
        var events = new[] { Native.Key(0x11, false), Native.Key(0x56, false), Native.Key(0x56, true), Native.Key(0x11, true) };
        var sent = Native.SendInput((uint)events.Length, events, System.Runtime.InteropServices.Marshal.SizeOf<Native.Input>());
        // Only release keys whose down events were emitted; never retry Ctrl+V.
        if (sent is > 0 and < 4) {
            var release = sent == 2 ? new[] { Native.Key(0x56, true), Native.Key(0x11, true) } : new[] { Native.Key(0x11, true) };
            Native.SendInput((uint)release.Length, release, System.Runtime.InteropServices.Marshal.SizeOf<Native.Input>());
        }
        return (int)sent;
    }

    public bool Verify(Target target, Selection? selection, string text)
    {
        var expected = selection?.Expected(text);
        // An unchanged value cannot acknowledge consumption of a paste event.
        if (selection is null || expected == Selection.Normalize(selection.Before)) { Pause(1320); return false; }
        var timer = Stopwatch.StartNew();
        while (timer.ElapsedMilliseconds < 1320) {
            Pause(40);
            try {
                var verified = Query(() => {
                    if (Native.GetForegroundWindow() != target.Hwnd) return false;
                    var element = (AutomationElement)target.Element!;
                    if (!element.TryGetCurrentPattern(TextPattern.Pattern, out var pattern)) return false;
                    return Selection.Normalize(((TextPattern)pattern).DocumentRange.GetText(MaxEditorLength + 8001)) == expected;
                }, 350);
                if (verified) return true;
            } catch { /* Still allow the target its bounded paste-consumption time. */ }
        }
        return false;
    }
    public void Pause(int milliseconds) => Thread.Sleep(milliseconds);
}
