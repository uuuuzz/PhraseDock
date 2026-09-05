using System.Text.RegularExpressions;

namespace PhraseDock;

internal sealed class BridgeFailure(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

internal sealed class Request
{
    public string Action { get; set; } = "";
    public string[]? Executables { get; set; }
    public string[] PackageFamilyNames { get; set; } = [];
    public string? Text { get; set; }
    public int? ExpectedPid { get; set; }
    public string? ExpectedTarget { get; set; }
    public string? FixtureHwnd { get; set; }
    public int? FixturePid { get; set; }
    public void Validate()
    {
        if (Action is not ("status" or "insert" or "diagnose") || Executables is not { Length: >= 1 and <= 16 } ||
            Executables.Any(name => name is null || !Regex.IsMatch(name, @"\A[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,120}\.exe\z", RegexOptions.IgnoreCase)) ||
            (ExpectedTarget?.Length ?? 0) > 2048)
            throw new BridgeFailure("invalid", "请求无效。");
        if (PackageFamilyNames is null || PackageFamilyNames.Length > 16 ||
            PackageFamilyNames.Any(name => name is null || !Regex.IsMatch(name, @"\A[a-zA-Z0-9][a-zA-Z0-9.-]{2,49}_[a-zA-Z0-9]{13}\z")))
            throw new BridgeFailure("invalid", "程序包身份无效。");
        if (Action == "insert" && (string.IsNullOrWhiteSpace(Text) || Text.Length > 8000 || Text.Contains('\0') || ExpectedPid is not > 0))
            throw new BridgeFailure("invalid", "提示词或输入目标无效。");
        if (FixtureHwnd is not null && (!long.TryParse(FixtureHwnd, out var handle) || handle <= 0 || FixturePid is not > 0))
            throw new BridgeFailure("invalid", "测试窗口无效。");
    }
}

internal static class TargetIdentity
{
    internal const string CodexPackageFamily = "OpenAI.Codex_2p2nqsd0c76g0";
    internal static bool IsAllowed(Request request, string executable, string? packageFamily) =>
        request.Executables!.Contains(executable, StringComparer.OrdinalIgnoreCase) ||
        packageFamily is not null && request.PackageFamilyNames.Contains(packageFamily, StringComparer.OrdinalIgnoreCase);
}

internal sealed record Target(int Pid, nint Hwnd, string Key, string Name, object? Element = null);
internal sealed record Selection(string Before, string Prefix, string Suffix)
{
    internal string Expected(string text) => Normalize(Prefix + text + Suffix);
    internal static string Normalize(string text) => text.Replace("\r\n", "\n").Replace('\r', '\n');
}

internal sealed record BridgeResult
{
    public bool Ok { get; init; }
    public bool Ready { get; init; }
    public bool Trusted { get; init; } = true;
    public string Code { get; init; } = "";
    public string Message { get; init; } = "";
    public int? Pid { get; init; }
    public string? AppName { get; init; }
    public string? TargetKey { get; init; }
    public bool? Verified { get; init; }
    public bool EventsSent { get; init; }
    public bool? ClipboardRestored { get; init; }
    public string? ClipboardStatus { get; init; }
    internal static BridgeResult Failure(string code, string message) => new() { Code = code, Message = message };
}

internal interface IClipboardLease : IDisposable { string Restore(); }
internal interface IPastePort
{
    Target Inspect();
    bool ModifiersHeld();
    bool SameTarget(Target target);
    Selection? ReadSelection(Target target);
    IClipboardLease Publish(string text);
    int SendPaste();
    bool Verify(Target target, Selection? selection, string text);
    void Pause(int milliseconds);
}

internal static class PasteEngine
{
    internal static BridgeResult Execute(Request request, IPastePort port)
    {
        if (request.Action is not ("status" or "insert")) return BridgeResult.Failure("invalid", "此请求不是输入事务。");
        IClipboardLease? clipboard = null;
        var attempted = false;
        var eventsSent = false;
        var verificationCompleted = false;
        var clipboardStatus = "untouched";
        BridgeResult result;
        try {
            var target = port.Inspect();
            if (request.ExpectedPid is { } pid && target.Pid != pid ||
                request.ExpectedTarget is { } key && target.Key != key)
                throw new BridgeFailure("focus-changed", "输入目标已切换，本次没有插入。");
            if (port.ModifiersHeld()) throw new BridgeFailure("modifier-held", "请松开修饰键，再点击提示词。");
            var ready = new BridgeResult { Ok = true, Ready = true, Code = "ready", Message = "光标已就位，点击即可插入。",
                Pid = target.Pid, AppName = target.Name, TargetKey = target.Key };
            if (request.Action == "status") return ready;
            var selection = port.ReadSelection(target);
            if (!port.SameTarget(target)) throw new BridgeFailure("focus-changed", "输入光标已改变，本次没有插入。");
            clipboard = port.Publish(request.Text!);
            if (!port.SameTarget(target)) throw new BridgeFailure("focus-changed", "输入光标已改变，本次没有插入。");
            if (port.ModifiersHeld()) throw new BridgeFailure("modifier-held", "请松开修饰键，再点击提示词。");
            attempted = true;
            var count = port.SendPaste();
            eventsSent = count > 0;
            if (count != 4) {
                result = BridgeResult.Failure(count == 0 ? "input-blocked" : "sent-unverified",
                    count == 0 ? "系统阻止了输入，请检查目标应用是否以管理员身份运行。" : "粘贴事件未完整发送，请检查输入结果，暂不重复点击。")
                    with { EventsSent = eventsSent, Verified = false };
            } else {
                var verified = port.Verify(target, selection, request.Text!);
                verificationCompleted = true;
                result = ready with { Verified = verified, EventsSent = true,
                    Code = verified ? "inserted" : "sent-unverified",
                    Message = verified ? "已插入，继续点击可组合提示词。" : "已发送粘贴，请确认输入框中的结果；后续提示词已停止。" };
            }
        } catch (BridgeFailure error) {
            result = attempted ? BridgeResult.Failure("sent-unverified", "输入结果尚未确认，请检查文字，暂不重复点击。") with { EventsSent = true, Verified = false }
                : BridgeResult.Failure(error.Code, error.Message);
        } catch {
            result = BridgeResult.Failure(attempted ? "sent-unverified" : "unavailable",
                attempted ? "输入结果尚未确认，请检查文字，暂不重复点击。" : "输入检查暂时不可用，请重新点击输入框。")
                with { EventsSent = attempted, Verified = false };
        } finally {
            if (clipboard is not null) {
                // Cleanup is independent of UI Automation acknowledgement/failure.
                if (attempted) port.Pause(verificationCompleted ? 120 : 1320);
                try { clipboardStatus = clipboard.Restore(); }
                catch { clipboardStatus = "failed"; }
                finally { clipboard.Dispose(); }
            }
        }
        if (result.Code == "clipboard-restore-failed") clipboardStatus = "failed";
        result = result with { ClipboardStatus = clipboardStatus, ClipboardRestored = clipboardStatus == "restored" };
        if (clipboardStatus == "failed") result = result with { Ready = false, Code = "clipboard-restore-failed",
            Message = "剪贴板未能完整恢复，请检查剪贴板和输入结果；后续提示词已停止。" };
        return result;
    }
}
