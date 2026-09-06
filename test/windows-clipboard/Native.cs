using System.Runtime.InteropServices;
using System.Text;

namespace PhraseDock;

// Test-only OS shim. Link the real ClipboardLease.cs into this executable;
// never call user32, UI Automation, or the interactive clipboard here.
internal static class Native
{
    private static readonly SortedDictionary<uint, nint> formats = [];
    private static readonly Dictionary<nint, int> allocations = [];
    private static uint sequence;
    internal static bool IsOpen { get; private set; }
    internal static int WindowCount { get; private set; }
    internal static int EmptyCalls { get; private set; }
    internal static bool EnumerationFails, ReadFails, OpenFails;
    internal static int WritesToFail;
    internal static int FormatCount => formats.Count;
    internal static int UnownedAllocationCount => allocations.Keys.Except(formats.Values).Count();
    internal static string? Text => formats.TryGetValue(13, out var handle) ? Marshal.PtrToStringUni(handle) : null;

    internal static void Reset(uint sequence = 0, string? text = null)
    {
        foreach (var handle in allocations.Keys) Marshal.FreeHGlobal(handle);
        allocations.Clear();
        formats.Clear();
        IsOpen = false;
        WindowCount = EmptyCalls = WritesToFail = 0;
        EnumerationFails = ReadFails = OpenFails = false;
        Native.sequence = sequence;
        if (text is not null) SetFixtureText(text);
    }
    private static void SetFixtureText(string text)
    {
        var bytes = Encoding.Unicode.GetBytes(text + '\0');
        var handle = GlobalAlloc(2, (nuint)bytes.Length);
        Marshal.Copy(bytes, 0, handle, bytes.Length);
        formats[13] = handle;
    }
    internal static void UserCopy(string text)
    {
        if (IsOpen) throw new InvalidOperationException("Another copy cannot enter a locked clipboard.");
        foreach (var handle in formats.Values) GlobalFree(handle);
        formats.Clear();
        SetFixtureText(text);
        sequence = unchecked(sequence + 1);
    }
    private static void RequireOpen()
    {
        if (!IsOpen) throw new InvalidOperationException("Clipboard operation requires its lock.");
    }

    internal static nint CreateWindowEx(uint exStyle, string className, string title, uint style,
        int x, int y, int width, int height, nint parent, nint menu, nint instance, nint parameter)
    {
        WindowCount++;
        return 1;
    }
    internal static bool DestroyWindow(nint window) { WindowCount--; return true; }
    internal static bool OpenClipboard(nint owner)
    {
        if (OpenFails || IsOpen) return false;
        IsOpen = true;
        return true;
    }
    internal static bool CloseClipboard() { RequireOpen(); IsOpen = false; return true; }
    internal static uint GetClipboardSequenceNumber() => sequence;
    internal static uint EnumClipboardFormats(uint previous)
    {
        RequireOpen();
        if (EnumerationFails) { Marshal.SetLastPInvokeError(5); return 0; }
        return formats.Keys.FirstOrDefault(format => format > previous);
    }
    internal static bool EmptyClipboard()
    {
        RequireOpen();
        EmptyCalls++;
        foreach (var handle in formats.Values) GlobalFree(handle);
        formats.Clear();
        sequence = unchecked(sequence + 1);
        return true;
    }
    internal static nint GetClipboardData(uint format)
    {
        RequireOpen();
        return ReadFails ? 0 : formats.GetValueOrDefault(format);
    }
    internal static nint SetClipboardData(uint format, nint handle)
    {
        RequireOpen();
        if (WritesToFail > 0) { WritesToFail--; return 0; }
        if (formats.TryGetValue(format, out var previous)) GlobalFree(previous);
        formats[format] = handle;
        sequence = unchecked(sequence + 1);
        return handle;
    }
    internal static nint GlobalAlloc(uint flags, nuint size)
    {
        var handle = Marshal.AllocHGlobal(checked((int)size));
        allocations.Add(handle, (int)size);
        return handle;
    }
    internal static nint GlobalFree(nint handle)
    {
        if (!allocations.Remove(handle)) throw new InvalidOperationException("Free only owned memory once.");
        Marshal.FreeHGlobal(handle);
        return 0;
    }
    internal static nuint GlobalSize(nint handle) => (nuint)allocations[handle];
    internal static nint GlobalLock(nint handle) => allocations.ContainsKey(handle) ? handle : 0;
    internal static bool GlobalUnlock(nint handle) => true;

    // These regressions cover empty/text clips and failure boundaries, not GDI formats.
    [StructLayout(LayoutKind.Sequential)] internal struct Bitmap
    {
        public int Type, Width, Height, WidthBytes;
        public ushort Planes, BitsPixel;
        public nint Bits;
    }
    internal static int GetClipboardFormatName(uint format, StringBuilder name, int count) => throw new NotSupportedException();
    internal static nint CopyImage(nint image, uint type, int cx, int cy, uint flags) => throw new NotSupportedException();
    internal static int GetObject(nint handle, int size, out Bitmap value) => throw new NotSupportedException();
    internal static bool DeleteObject(nint handle) => throw new NotSupportedException();
    internal static nint CopyEnhMetaFile(nint handle, string? path) => throw new NotSupportedException();
    internal static uint GetEnhMetaFileBits(nint handle, uint size, nint data) => throw new NotSupportedException();
    internal static bool DeleteEnhMetaFile(nint handle) => throw new NotSupportedException();
}
