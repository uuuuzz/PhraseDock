**简体中文** | [English](architecture.en.md)

# 平台边界

显示名称为「AI 常用提示词快捷追加器 / AI Prompt Quick Appender」。`package.json` 维护 `productName` 与 `productNameZh`；主进程和打包元数据读取同一来源。改名后显式将 `userData` / `sessionData` 指向原 `PhraseDock` 目录，保持既有配置和单实例范围。仓库、原生命名空间与应用标识继续沿用内部名称。

## 本次技术选择

Electron 负责两端共用的界面、配置、菜单与应用生命周期。Mac 通过 Swift 辅助进程访问 AX 与 Quartz；Windows 通过自带运行时的 C#/.NET 10 辅助进程访问 UI Automation、Win32 输入与剪贴板 API。项目不依赖修改 Codex 本体。

Renderer → preload 的有限 IPC → main 查询目标 → platform.insert → 原生组件再次检查焦点 → 粘贴 → 校验 → 有条件恢复剪贴板。

只把提示词 ID 从界面传到主进程；文本从已校验配置取得。Renderer 启用 sandbox、contextIsolation，关闭 Node 集成，拒绝外部导航与新窗口。配置用 textContent 呈现。无自动更新或远程资源。

放射菜单以屏幕坐标中的中心锚点保存位置。收起时窗口为 72×72px；展开前主进程以同一中心扩大透明窗口，Renderer 再让键帽从中心移动到计算位置。收回时先播放 Renderer 动画，再缩小原生窗口。透明空白区域通过受限 IPC 切换 `setIgnoreMouseEvents(..., { forward: true })`，避免展开窗口挡住后面的应用；该 IPC 只接受布尔值。

## 系统适配接口

`src/platform/index.cjs` 选择平台实现。各实现提供：

```js
configure(target)                 // 更新平台目标策略
status()                         // Promise<Status>
insert(text, expectedPid, expectedTarget) // Promise<Result>，第三参数可选
close()                          // Promise<void>，等待插入组件收尾
```

`Status`：`ok`、`ready`、`trusted`、`code`、`message`，就绪时还含 `pid`、`bundleId`、`appName`、`role`。

`Result`：除状态字段外，粘贴后含 `verified` 与 `clipboardRestored`。`ok: true` 表示粘贴事件已发送，只有 `verified: true` 表示通过 AX / UIA 读回验证。Windows 还返回 `eventsSent`、`clipboardStatus` 与 `targetKey`。`clipboardStatus` 区分 `restored`、`user-changed`、`failed`、`untouched`；用户的新复制导致不恢复不是错误。

Renderer 最多排队 8 次，只有 `code: inserted` 且 `verified: true` 才继续；未知结果、失败、配置刷新会停止后续队列。Windows 队列绑定首个目标的进程、HWND 和控件 runtime ID，Mac 队列额外绑定进程，同时保持 Swift 单次事务中的 AX 元素检查。

原生桥使用 stdin/stdout 单请求 JSON，不把提示词作为命令行参数。错误不输出输入框、选区文字、剪贴板或完整配置。共用 `bridge-client.cjs` 负责 UTF-8 解码、响应上限、并发约束与退出。插入超时返回 `pending`，保留原生进程并阻止下一次插入，直到组件退出；只有只读状态进程可以因超时被终止。应用退出等待插入进程收尾。异常系统终止不在恢复保证之内。

## Windows 实现

1. `schemaVersion: 1` 保持兼容。macOS 使用 `target.macMode`（`all` / `allowlist`）和 `target.macBundleIds`；Windows 使用 `target.windowsExecutables` 和 `target.windowsPackageFamilyNames`。旧文件在内存补默认策略，不写回用户配置。
2. `WindowsPort.cs` 检查前台窗口归属、允许的 exe 文件名或程序包系列名称、权限等级、聚焦 UIA 控件祖先和可编辑状态。Windows 商店版 Codex 使用系统查询所得的包身份匹配，避免将其实际宿主 `ChatGPT.exe` 误判或泛化放行其他同名应用。UIA 只读调用在后台 MTA 工作线程中执行，使用有界等待。
3. `PasteEngine.cs` 管理焦点/修饰键检查、发送、确认和 finally 清理。`ClipboardLease.cs` 在同一个剪贴板锁内备份与替换，在恢复锁内检查序列号。无法可靠复制的格式提前拒绝。
4. 共用 Electron 浮窗使用 `focusable: false`、透明背景、鼠标穿透；Windows 添加 ICO、AppUserModelID 和托盘图标。实际效果待本机手动验收。
5. Windows 本地输入测试窗口只通过精确 HWND 和所属主进程 PID 授权，不把全部 Electron 窗口列入白名单。
6. `package:win` 校验官方 Electron 归档、构建自带运行时的原生组件、执行无桌面操作的自测并打包到 `dist/<版本>/`。`package:mac` 保留原 Mac 签名流程，读取同一 package.json 版本。详细验收表见 `docs/windows.md`。
7. `diagnose:win` 是显式只读入口，报告身份和控件能力元数据，不报告输入内容、不调用粘贴引擎。输入引擎自身也拒绝诊断动作。

Windows 已完成实现、编译和纯逻辑测试，真实输入及视觉仍未验证。Linux 明确返回 `unsupported`。

## 后续功能

提示词图形编辑、多分组、排序、快捷键、开机启动、应用白名单编辑、跨设备配置同步。同步功能引入前维持纯本地数据路径。
