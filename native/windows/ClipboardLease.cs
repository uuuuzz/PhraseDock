using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace PhraseDock;

internal sealed class ClipboardLease : IClipboardLease
{
    private const long MaxBytes = 32 * 1024 * 1024;
    private readonly nint owner;
    private readonly List<SavedFormat> saved = [];
    private uint version;
    private bool restored;
    private ClipboardLease(nint owner) { this.owner = owner; }

    internal static ClipboardLease Publish(string text)
    {
        // A message-only owner is required for EmptyClipboard/SetClipboardData.
        // It is never visible, focused, activated or positioned on the screen.
        var owner = Native.CreateWindowEx(0, "STATIC", "PhraseDock clipboard", 0, 0, 0, 0, 0, new nint(-3), 0, 0, 0);
        if (owner == 0) throw new BridgeFailure("clipboard-unavailable", "无法创建剪贴板事务。");
        var lease = new ClipboardLease(owner);
        try {
            using var textData = SavedFormat.FromBytes(13, Encoding.Unicode.GetBytes(text + '\0'));
            using var access = Open(owner);
            // A pristine clipboard can have sequence zero. Successful opening
            // and format enumeration establish access; the sequence is only a
            // change token for restoring our replacement below.
            // Snapshot and initial replacement share the same Windows clipboard
            // lock, so a new user copy cannot slip between them.
            long total = 0;
            uint format = 0;
            while (true) {
                Marshal.SetLastPInvokeError(0);
                format = Native.EnumClipboardFormats(format);
                if (format == 0) {
                    if (Marshal.GetLastPInvokeError() != 0) throw Unavailable();
                    break;
                }
                if (lease.saved.Count >= 256) throw Unavailable();
                var copy = SavedFormat.Capture(format, ref total);
                lease.saved.Add(copy);
            }
            if (!Native.EmptyClipboard()) throw Unavailable();
            if (!textData.Transfer()) {
                var recovered = lease.WriteSaved();
                throw new BridgeFailure(recovered ? "clipboard-write" : "clipboard-restore-failed",
                    recovered ? "无法写入提示词，原剪贴板已恢复。" : "剪贴板写入和恢复失败，请检查剪贴板。");
            }
            lease.version = Native.GetClipboardSequenceNumber();
            return lease;
        } catch { lease.Dispose(); throw; }
    }

    public string Restore()
    {
        if (restored) return "failed";
        restored = true;
        using var access = Open(owner);
        // Sequence check and restore are inside one lock; never overwrite a newer copy.
        if (Native.GetClipboardSequenceNumber() != version) return "user-changed";
        if (!Native.EmptyClipboard()) return "failed";
        return WriteSaved() ? "restored" : "failed";
    }
    private bool WriteSaved()
    {
        var success = true;
        foreach (var format in saved) if (!format.Transfer()) success = false;
        return success;
    }
    public void Dispose()
    {
        foreach (var item in saved) item.Dispose();
        saved.Clear();
        Native.DestroyWindow(owner);
    }
    private static BridgeFailure Unavailable() => new("clipboard-unavailable", "当前剪贴板无法完整备份，请先复制一小段普通文字后再试。");
    private static void AddSize(long size, ref long total)
    {
        if (size <= 0) throw Unavailable();
        if (size > MaxBytes - total) throw new BridgeFailure("clipboard-large", "剪贴板内容超过 32 MiB，请先复制一小段普通文字后再试。");
        total += size;
    }
    private sealed class Access : IDisposable { public void Dispose() => Native.CloseClipboard(); }
    private static Access Open(nint owner)
    {
        var watch = Stopwatch.StartNew();
        while (!Native.OpenClipboard(owner)) {
            if (watch.ElapsedMilliseconds >= 1500) throw new BridgeFailure("clipboard-busy", "剪贴板正被其他应用使用，请稍候。");
            Thread.Sleep(20);
        }
        return new Access();
    }

    private sealed class SavedFormat(uint format, nint handle, int kind = 0) : IDisposable
    {
        private nint owned = handle;
        internal static SavedFormat Capture(uint format, ref long total)
        {
            // Private/owner-display/palette/metafile-picture formats can contain
            // process-owned pointers. Refuse them before changing any data.
            if (format is 3 or 9 || format is >= 0x80 and < 0xC000) throw Unavailable();
            if (format >= 0xC000) {
                var name = new StringBuilder(256);
                if (Native.GetClipboardFormatName(format, name, name.Capacity) == 0) throw Unavailable();
                if (new[] { "DataObject", "Ole Private Data", "Link Source", "Embedded Object", "Embed Source", "OwnerLink" }
                    .Contains(name.ToString(), StringComparer.OrdinalIgnoreCase)) throw Unavailable();
            }
            var source = Native.GetClipboardData(format);
            if (source == 0) throw Unavailable();
            if (format == 2) {
                if (Native.GetObject(source, Marshal.SizeOf<Native.Bitmap>(), out var bitmap) == 0) throw Unavailable();
                AddSize(Math.Abs((long)bitmap.Height) * Math.Abs((long)bitmap.WidthBytes) * Math.Max(1, (int)bitmap.Planes), ref total);
                var copy = Native.CopyImage(source, 0, 0, 0, 0x2000);
                if (copy == 0) throw Unavailable();
                return new SavedFormat(format, copy, 1);
            }
            if (format == 14) {
                AddSize(Native.GetEnhMetaFileBits(source, 0, 0), ref total);
                var copy = Native.CopyEnhMetaFile(source, null);
                if (copy == 0) throw Unavailable();
                return new SavedFormat(format, copy, 2);
            }
            var length = Native.GlobalSize(source);
            if (length > (nuint)MaxBytes) throw new BridgeFailure("clipboard-large", "剪贴板内容过大。");
            AddSize((long)length, ref total);
            var pointer = Native.GlobalLock(source);
            if (pointer == 0) throw Unavailable();
            var bytes = new byte[(int)length];
            try { Marshal.Copy(pointer, bytes, 0, bytes.Length); }
            finally { Native.GlobalUnlock(source); }
            return FromBytes(format, bytes);
        }
        internal static SavedFormat FromBytes(uint format, byte[] bytes)
        {
            var handle = Native.GlobalAlloc(2, (nuint)bytes.Length);
            if (handle == 0) throw Unavailable();
            var pointer = Native.GlobalLock(handle);
            if (pointer == 0) { Native.GlobalFree(handle); throw Unavailable(); }
            try { Marshal.Copy(bytes, 0, pointer, bytes.Length); }
            finally { Native.GlobalUnlock(handle); }
            return new SavedFormat(format, handle);
        }
        internal bool Transfer()
        {
            if (owned == 0 || Native.SetClipboardData(format, owned) == 0) return false;
            owned = 0; // Ownership has transferred to Windows.
            return true;
        }
        public void Dispose()
        {
            if (owned == 0) return;
            if (kind == 1) Native.DeleteObject(owned);
            else if (kind == 2) Native.DeleteEnhMetaFile(owned);
            else Native.GlobalFree(owned);
            owned = 0;
        }
    }
}
