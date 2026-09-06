namespace PhraseDock;

internal static class Program
{
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    private static void Reject(string code)
    {
        try { using var lease = ClipboardLease.Publish("replacement"); }
        catch (BridgeFailure failure) when (failure.Code == code) { return; }
        throw new InvalidOperationException($"Expected {code} before publication completed.");
    }

    private static int Main()
    {
        var tests = new (string Name, Action Run)[] {
            ("initial empty sequence zero publishes and restores empty", () => {
                Native.Reset(sequence: 0);
                using var lease = ClipboardLease.Publish("中文 😀\nsecond line");
                Check(Native.Text == "中文 😀\nsecond line", "Replacement text must be intact.");
                Check(lease.Restore() == "restored" && Native.FormatCount == 0, "Restore the original empty clipboard.");
            }),
            ("text clipboard is backed up and restored", () => {
                Native.Reset(sequence: 9, text: "original");
                using var lease = ClipboardLease.Publish("replacement");
                Check(Native.Text == "replacement", "Publish must replace the text.");
                Check(lease.Restore() == "restored" && Native.Text == "original", "Restore the original text.");
            }),
            ("newer user copy is preserved after an initially empty clipboard", () => {
                Native.Reset(sequence: 0);
                using var lease = ClipboardLease.Publish("replacement");
                Native.UserCopy("newer copy");
                var writes = Native.EmptyCalls;
                Check(lease.Restore() == "user-changed" && Native.Text == "newer copy", "Preserve the newer copy.");
                Check(Native.EmptyCalls == writes, "Do not clear a newer clipboard.");
            }),
            ("sequence rollover to zero remains a valid restore token", () => {
                Native.Reset(sequence: uint.MaxValue - 1, text: "original");
                using var lease = ClipboardLease.Publish("replacement");
                Check(Native.GetClipboardSequenceNumber() == 0, "Exercise DWORD rollover after publication.");
                Check(lease.Restore() == "restored" && Native.Text == "original", "Restore using the zero token.");
            }),
            ("enumeration failure refuses before clipboard modification", () => {
                Native.Reset(sequence: 0, text: "original");
                Native.EnumerationFails = true;
                Reject("clipboard-unavailable");
                Check(Native.EmptyCalls == 0 && Native.Text == "original", "Enumeration errors must preserve the original.");
            }),
            ("unreadable data refuses before clipboard modification", () => {
                Native.Reset(sequence: 12, text: "original");
                Native.ReadFails = true;
                Reject("clipboard-unavailable");
                Check(Native.EmptyCalls == 0 && Native.Text == "original", "Read errors must preserve the original.");
            }),
            ("clipboard open failure refuses before modification", () => {
                Native.Reset(sequence: 0, text: "original");
                Native.OpenFails = true;
                Reject("clipboard-busy");
                Check(Native.EmptyCalls == 0 && Native.Text == "original", "An inaccessible clipboard must remain untouched.");
            }),
            ("failed replacement restores the backed-up text", () => {
                Native.Reset(sequence: 12, text: "original");
                Native.WritesToFail = 1;
                Reject("clipboard-write");
                Check(Native.Text == "original", "Recover the original after a failed replacement.");
            })
        };

        var failed = 0;
        foreach (var test in tests) {
            try {
                test.Run();
                Check(!Native.IsOpen && Native.WindowCount == 0 && Native.UnownedAllocationCount == 0,
                    "Release the clipboard lock, hidden owner and untransferred memory.");
                Console.WriteLine($"PASS {test.Name}");
            } catch (Exception error) {
                failed++;
                // Test data is fixed; never print clipboard text or request payloads.
                Console.Error.WriteLine($"FAIL {test.Name}: {error.GetType().Name}");
            } finally { Native.Reset(); }
        }
        Console.WriteLine($"Clipboard lease regression tests: {tests.Length - failed}/{tests.Length} passed. In-memory OS shim; no desktop clipboard or keyboard access.");
        return failed == 0 ? 0 : 1;
    }
}
