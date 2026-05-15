# Changelog

## [0.0.3] - 2026-05-13

### 新功能

- 新增 Activity Bar 侧边栏入口：通过 `Willump` 图标打开功能列表，统一进入端口占用和开发配置能力。
- 新增 `viewGitConfig` 命令：打开 Git 开发配置 Webview，支持查看和修改当前项目、全局 Git 作者与邮箱。
- 新增 Git 开发配置面板：展示多工作区 Git 概览、当前分支、上游分支、Remote、有效提交身份来源等信息。
- 新增 Git 身份模板和 GitHub noreply 邮箱辅助能力，方便快速切换本地或全局提交身份。
- 新增 Git 策略与环境检测：支持查看和配置 `push.default`、`core.autocrlf`、`core.eol`、`core.ignorecase`、`core.editor`，并展示 Git、SSH Key、Hooks、Git LFS 状态。

### 功能增强

- 端口占用 Webview 新增扫描模式切换，支持查看监听端口和全部连接。
- 端口列表新增连接类型展示、搜索、排序、列显示配置、占用数量和筛选结果统计。
- 终止端口进程流程改为基于 PID 操作，并在 Webview 中提供二次确认和操作结果反馈。
- 增强跨平台端口命令封装，统一 macOS / Linux / Windows 的端口查询、解析和进程终止逻辑。

### 本地化与体验

- 增加扩展端和 Webview 端中英文国际化支持，并将命令标题迁移到 `package.nls`。
- 重构 Webview 为多页面路由结构，端口占用和 Git 开发配置共用同一个 Willump Webview 容器。
- 优化 Webview 主题、布局和交互样式，引入 Arco Design 组件提升表格、弹窗、表单等界面体验。

### 工程化

- 重构端口相关代码结构，拆分命令配置、端口业务逻辑和常量定义。
- 补充端口命令解析相关测试，覆盖不同平台的端口列表和进程信息解析逻辑。

## [0.0.1] - 2025-05-09

🎉 初始发布版本！

### 新功能

- 新增 `checkPort` 命令：输入端口号，检查该端口是否被占用。
- 新增 `killPort` 命令：输入端口号，自动查找并终止占用该端口的进程。
- 新增 `listPorts` 命令：列出当前所有正在被占用的端口及进程信息。
- 插件命名为 **Willump**，灵感来自 LOL 雪人伙伴，象征可靠与力量。

### 元数据

- 添加插件图标支持（`images/icon.png`）。
- 添加作者与仓库信息（GitHub: [cbtpro](https://github.com/cbtpro)）。
