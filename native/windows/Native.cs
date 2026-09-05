using System.Runtime.InteropServices;
using System.Text;

namespace PhraseDock;

internal static class Native
{
    [StructLayout(LayoutKind.Sequential)] internal struct KeyboardInput { internal ushort Vk, Scan; internal uint Flags, Time; internal nuint Extra; }
    [StructLayout(LayoutKind.Sequential)] internal struct MouseInput { internal int X, Y; internal uint Data, Flags, Time; internal nuint Extra; }
    [StructLayout(LayoutKind.Explicit)] internal struct InputUnion { [FieldOffset(0)] internal KeyboardInput Keyboard; [FieldOffset(0)] internal MouseInput Mouse; }
    [StructLayout(LayoutKind.Sequential)] internal struct Input { internal uint Type; internal InputUnion Data; }
    [StructLayout(LayoutKind.Sequential)] internal struct Bitmap { internal int Type, Width, Height, WidthBytes; internal ushort Planes, BitsPixel; internal nint Bits; }
    internal static Input Key(ushort key, bool up) => new() { Type = 1, Data = new InputUnion { Keyboard = new KeyboardInput { Vk = key, Flags = up ? 2u : 0u } } };

    [DllImport("user32.dll")] internal static extern nint GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(nint window, out uint pid);
    [DllImport("user32.dll")] internal static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError = true)] internal static extern uint SendInput(uint count, Input[] events, int size);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool OpenClipboard(nint owner);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool CloseClipboard();
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool EmptyClipboard();
    [DllImport("user32.dll")] internal static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll", SetLastError = true)] internal static extern uint EnumClipboardFormats(uint previous);
    [DllImport("user32.dll", SetLastError = true)] internal static extern nint GetClipboardData(uint format);
    [DllImport("user32.dll", SetLastError = true)] internal static extern nint SetClipboardData(uint format, nint memory);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetClipboardFormatName(uint format, StringBuilder name, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] internal static extern nint CreateWindowEx(uint exStyle, string className, string title, uint style, int x, int y, int width, int height, nint parent, nint menu, nint instance, nint parameter);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool DestroyWindow(nint window);
    [DllImport("user32.dll", SetLastError = true)] internal static extern nint CopyImage(nint image, uint type, int cx, int cy, uint flags);
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] internal static extern int GetObject(nint handle, int size, out Bitmap value);
    [DllImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool DeleteObject(nint handle);
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] internal static extern nint CopyEnhMetaFile(nint handle, string? path);
    [DllImport("gdi32.dll")] internal static extern uint GetEnhMetaFileBits(nint handle, uint size, nint data);
    [DllImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool DeleteEnhMetaFile(nint handle);
    [DllImport("kernel32.dll", SetLastError = true)] internal static extern nint GlobalAlloc(uint flags, nuint size);
    [DllImport("kernel32.dll")] internal static extern nint GlobalFree(nint memory);
    [DllImport("kernel32.dll")] internal static extern nuint GlobalSize(nint memory);
    [DllImport("kernel32.dll")] internal static extern nint GlobalLock(nint memory);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool GlobalUnlock(nint memory);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern nint OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryFullProcessImageName(nint process, uint flags, StringBuilder path, ref uint size);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseHandle(nint handle);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)] private static extern int GetPackageFamilyName(nint process, ref uint length, StringBuilder name);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool OpenProcessToken(nint process, uint access, out nint token);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetTokenInformation(nint token, int kind, nint info, uint length, out uint required);
    [DllImport("advapi32.dll")] private static extern nint GetSidSubAuthorityCount(nint sid);
    [DllImport("advapi32.dll")] private static extern nint GetSidSubAuthority(nint sid, uint index);

    internal static string ProcessPath(uint pid)
    {
        var handle = OpenProcess(0x1000, false, pid);
        if (handle == 0) throw new BridgeFailure("permission", "无法检查目标应用的身份或权限。");
        try {
            var buffer = new StringBuilder(32768); uint length = 32768;
            if (!QueryFullProcessImageName(handle, 0, buffer, ref length)) throw new BridgeFailure("permission", "无法确认目标应用。");
            return buffer.ToString();
        } finally { CloseHandle(handle); }
    }
    internal static uint IntegrityLevel(uint pid)
    {
        var process = OpenProcess(0x1000, false, pid);
        nint token = 0, info = 0;
        try {
            if (process == 0 || !OpenProcessToken(process, 8, out token)) throw new BridgeFailure("permission", "无法检查目标应用的权限。");
            GetTokenInformation(token, 25, 0, 0, out var size);
            if (size == 0 || size > 65536) throw new BridgeFailure("permission", "无法检查目标应用的权限。");
            info = Marshal.AllocHGlobal((int)size);
            if (!GetTokenInformation(token, 25, info, size, out _)) throw new BridgeFailure("permission", "无法检查目标应用的权限。");
            var sid = Marshal.ReadIntPtr(info);
            var count = Marshal.ReadByte(GetSidSubAuthorityCount(sid));
            if (count == 0) throw new BridgeFailure("permission", "无法检查目标应用的权限。");
            return (uint)Marshal.ReadInt32(GetSidSubAuthority(sid, (uint)count - 1));
        } finally { if (info != 0) Marshal.FreeHGlobal(info); if (token != 0) CloseHandle(token); if (process != 0) CloseHandle(process); }
    }

    internal static string? PackageFamilyName(uint pid)
    {
        var process = OpenProcess(0x1000, false, pid);
        if (process == 0) throw new BridgeFailure("permission", "无法检查目标应用的身份。");
        try {
            uint length = 256;
            var buffer = new StringBuilder((int)length);
            var result = GetPackageFamilyName(process, ref length, buffer);
            if (result == 15700) return null; // APPMODEL_ERROR_NO_PACKAGE: unpackaged applications.
            if (result == 122 && length is > 0 and <= 4096) {
                buffer = new StringBuilder((int)length);
                result = GetPackageFamilyName(process, ref length, buffer);
            }
            if (result != 0) throw new BridgeFailure("permission", "无法确认目标应用的程序包身份。");
            return buffer.ToString();
        } finally { CloseHandle(process); }
    }
}
