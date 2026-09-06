using System.Runtime.InteropServices;

namespace PhraseDock;

// No native functions are called here. These are transaction-boundary tests,
// not claims about real Windows UIA providers, keyboard input or clipboard data.
internal static class SelfTests
{
    internal static object Run()
    {
        var passed = new List<string>();
        void Test(string name, Action action) { action(); passed.Add(name); }
        void Check(bool condition) { if (!condition) throw new InvalidOperationException("Self-test failed."); }
        Request Request(string text = "中文 😀\n second ") => new() { Action = "insert", Executables = ["Codex.exe"], Text = text, ExpectedPid = 42, ExpectedTarget = "target" };

        Test("native input structure matches ABI", () => Check(Marshal.SizeOf<Native.Input>() == (IntPtr.Size == 8 ? 40 : 28)));
        Test("diagnostic actions cannot fall through to an input transaction", () => {
            var request = Request(); request.Action = "diagnose"; var port = new FakePort();
            Check(PasteEngine.Execute(request, port).Code == "invalid" && port.PublishCalls == 0 && port.SendCalls == 0);
        });
        Test("Store Codex is recognized by package identity despite ChatGPT executable name", () => {
            var request = Request(); request.PackageFamilyNames = [TargetIdentity.CodexPackageFamily.ToLowerInvariant()];
            request.Validate(); Check(TargetIdentity.IsAllowed(request, "ChatGPT.exe", TargetIdentity.CodexPackageFamily));
        });
        Test("shared executable filename does not authorize another package or unpackaged app", () => {
            var request = Request(); request.PackageFamilyNames = [TargetIdentity.CodexPackageFamily];
            Check(!TargetIdentity.IsAllowed(request, "ChatGPT.exe", "OpenAI.ChatGPT_2p2nqsd0c76g0"));
            Check(!TargetIdentity.IsAllowed(request, "ChatGPT.exe", null));
            Check(!TargetIdentity.IsAllowed(request, "ChatGPT.exe", "OpenAI.Codex_abcdefghijklm"));
        });
        Test("unpackaged executable allowlist remains supported", () => {
            Check(TargetIdentity.IsAllowed(Request(), "CODEX.EXE", null));
            Check(!TargetIdentity.IsAllowed(Request(), "unrelated.exe", null));
        });
        Test("package identity rejects paths wildcards and null values", () => {
            foreach (var families in new string[][] { ["OpenAI.Codex_*"], ["C:\\WindowsApps\\OpenAI.Codex"], null! }) {
                var request = Request(); request.PackageFamilyNames = families;
                var rejected = false; try { request.Validate(); } catch (BridgeFailure) { rejected = true; } Check(rejected);
            }
        });
        Test("invalid text and executable rejected before native access", () => {
            foreach (var text in new[] { "", "\0", new string('x', 8001) }) {
                var rejected = false; try { Request(text).Validate(); } catch (BridgeFailure) { rejected = true; } Check(rejected);
            }
            var request = Request(); request.Executables = ["C:\\Codex.exe"];
            var invalid = false; try { request.Validate(); } catch (BridgeFailure) { invalid = true; } Check(invalid);
        });
        Test("verified paste once and original clipboard restored", () => {
            var port = new FakePort(); var result = PasteEngine.Execute(Request(), port);
            Check(result.Ok && result.Verified == true && result.ClipboardRestored == true && port.SendCalls == 1 && port.Lease.Restores == 1 && port.Lease.Disposed);
        });
        Test("status never touches clipboard or input", () => {
            var port = new FakePort(); var request = Request(); request.Action = "status";
            Check(PasteEngine.Execute(request, port).Ready && port.PublishCalls == 0 && port.SendCalls == 0);
        });
        Test("clipboard preparation failure never sends or retries input", () => {
            var port = new FakePort { ThrowOnPublish = true };
            var result = PasteEngine.Execute(Request(), port);
            Check(!result.Ok && result.Code == "clipboard-unavailable" && !result.EventsSent &&
                result.ClipboardStatus == "untouched" && port.PublishCalls == 1 && port.SendCalls == 0 && port.Lease.Restores == 0);
        });
        Test("wrong target and modifier refuse before clipboard", () => {
            foreach (var port in new[] { new FakePort { TargetKey = "changed" }, new FakePort { Modifier = true } }) {
                Check(!PasteEngine.Execute(Request(), port).Ok && port.PublishCalls == 0 && port.SendCalls == 0);
            }
        });
        Test("focus changes after publication restore without input", () => {
            var port = new FakePort { FocusAfterPublish = false }; var result = PasteEngine.Execute(Request(), port);
            Check(result.Code == "focus-changed" && port.SendCalls == 0 && port.Lease.Restores == 1);
        });
        Test("new modifier after publication prevents input", () => {
            var port = new FakePort { ModifierAfterPublish = true }; var result = PasteEngine.Execute(Request(), port);
            Check(result.Code == "modifier-held" && port.SendCalls == 0 && port.Lease.Restores == 1);
        });
        Test("newer clipboard copy is preserved", () => {
            var port = new FakePort(); port.Lease.State = "user-changed";
            var result = PasteEngine.Execute(Request(), port); Check(result.Ok && result.ClipboardRestored == false && result.ClipboardStatus == "user-changed");
        });
        Test("no acknowledgement remains unverified without retry", () => {
            var port = new FakePort { Acknowledged = false }; var result = PasteEngine.Execute(Request(), port);
            Check(result.Ok && result.Verified == false && result.Code == "sent-unverified" && port.SendCalls == 1 && port.Lease.Restores == 1);
        });
        Test("partial input never retries paste", () => {
            foreach (var count in new[] { 0, 1, 2, 3 }) {
                var port = new FakePort { Count = count }; var result = PasteEngine.Execute(Request(), port);
                Check(!result.Ok && result.EventsSent == (count > 0) && port.SendCalls == 1 && port.Lease.Restores == 1);
            }
        });
        Test("readback exception still restores clipboard", () => {
            var port = new FakePort { ThrowOnVerify = true }; var result = PasteEngine.Execute(Request(), port);
            Check(result.Code == "sent-unverified" && port.Lease.Restores == 1 && port.Lease.Disposed);
        });
        Test("restore failure is visible even if paste verified", () => {
            var port = new FakePort(); port.Lease.State = "failed";
            Check(PasteEngine.Execute(Request(), port).Code == "clipboard-restore-failed");
        });
        Test("selection preserves Unicode and normalizes line endings", () => {
            var selection = new Selection("前😀后", "前", "后");
            Check(selection.Expected("中\r\n文 ") == "前中\n文 后");
        });
        return new { ok = true, code = "self-test", message = "纯逻辑自测通过，未操作桌面或剪贴板。", passed = passed.Count, tests = passed };
    }
    private sealed class FakeLease : IClipboardLease
    {
        internal int Restores; internal bool Disposed; internal string State = "restored";
        public string Restore() { Restores++; return State; }
        public void Dispose() { Disposed = true; }
    }
    private sealed class FakePort : IPastePort
    {
        internal string TargetKey = "target";
        internal bool Modifier, ModifierAfterPublish, ThrowOnVerify, ThrowOnPublish;
        internal bool FocusAfterPublish = true, Acknowledged = true;
        internal int PublishCalls, SendCalls, Count = 4;
        internal readonly FakeLease Lease = new();
        public Target Inspect() => new(42, 100, TargetKey, "test");
        public bool ModifiersHeld() => Modifier || PublishCalls > 0 && ModifierAfterPublish;
        public bool SameTarget(Target target) => PublishCalls == 0 || FocusAfterPublish;
        public Selection ReadSelection(Target target) => new("ab", "a", "b");
        public IClipboardLease Publish(string text)
        {
            PublishCalls++;
            if (ThrowOnPublish) throw new BridgeFailure("clipboard-unavailable", "Clipboard preparation failed.");
            return Lease;
        }
        public int SendPaste() { SendCalls++; return Count; }
        public bool Verify(Target target, Selection? selection, string text) { if (ThrowOnVerify) throw new Exception(); return Acknowledged; }
        public void Pause(int milliseconds) { }
    }
}
