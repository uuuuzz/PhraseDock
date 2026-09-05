using System.Text;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PhraseDock;

internal static class Program
{
    internal static readonly JsonSerializerOptions Json = new() {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    [STAThread]
    private static int Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        object result;
        try {
            using var input = Console.OpenStandardInput();
            using var bytes = new MemoryStream();
            var buffer = new byte[4096];
            int length;
            while ((length = input.Read(buffer)) > 0) {
                if (bytes.Length + length > 128 * 1024) throw new BridgeFailure("invalid", "请求过大。");
                bytes.Write(buffer, 0, length);
            }
            var request = JsonSerializer.Deserialize<Request>(bytes.ToArray(), Json)
                ?? throw new BridgeFailure("invalid", "请求无效。");
            // These modes are deliberately pure: no UIA, windows, input or clipboard.
            if (request.Action == "self-test") result = SelfTests.Run();
            else if (request.Action == "capabilities") result = new { ok = true, code = "capabilities",
                message = "Windows 输入组件已加载。", platform = "win32", protocolVersion = 1,
                architecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString() };
            else {
                request.Validate();
                var port = new WindowsPort(request);
                result = request.Action == "diagnose" ? port.Diagnose() : PasteEngine.Execute(request, port);
            }
        } catch (BridgeFailure error) { result = BridgeResult.Failure(error.Code, error.Message); }
        catch { result = BridgeResult.Failure("invalid", "系统组件收到无效请求。"); }
        Console.Write(JsonSerializer.Serialize(result, Json));
        return 0;
    }
}
