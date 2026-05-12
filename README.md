# Willump

Willump 是一个面向 VS Code 的本地端口管理扩展，主要用于帮助开发者快速排查端口占用、查看本机端口列表，并在需要时终止占用指定端口的进程。

在前端、本地服务、微服务调试或多项目并行开发时，端口冲突是非常常见的问题。Willump 将常用的 `lsof`、`netstat`、`kill`、`taskkill` 等操作封装为 VS Code 命令，让开发者可以直接在编辑器内完成端口诊断和处理，减少在终端与编辑器之间来回切换的成本。

## 项目定位

Willump 当前是一个轻量级 VS Code 工具扩展，聚焦在本地开发环境中的端口占用管理。

它适合以下场景：

- 启动开发服务时发现端口已被占用，需要快速定位占用进程。
- 多个项目同时运行，需要查看当前机器上的端口使用情况。
- 本地服务异常退出后端口仍被占用，需要快速结束相关进程。
- 希望在 VS Code 内完成基础端口排查，而不是手动输入系统命令。

## 已有功能

### 检查指定端口

输入一个或多个端口号，Willump 会检查这些端口当前是否被占用，并通过 VS Code 消息提示展示结果。

示例输入：

```text
3000 5173 8080
```

### 终止占用端口的进程

输入一个或多个端口号后，Willump 会查找占用端口的进程 ID，并尝试终止对应进程。

该能力适合处理本地开发服务残留、端口释放失败等问题。执行前请确认目标端口对应的是可以终止的本地开发进程。

### 查看所有端口占用情况

Willump 可以读取当前系统的端口占用信息，并在 VS Code 输出面板中展示端口、进程等原始诊断数据，方便进一步排查。

### Vue 端口列表视图

项目已经集成 Vue 3 + Vite 开发 Webview 页面，用于以更直观的方式展示端口、PID 和程序名称，并支持搜索、刷新和二次确认后终止占用进程。

### 活动栏入口

Willump 已支持 VS Code 左侧活动栏入口。打开 Activity Bar 中的 `Willump` 图标后，会看到功能入口列表；当前包含“端口占用”，点击后打开端口占用 Webview。后续新增功能时，也可以继续往这个列表中追加入口。

## 命令列表

在 VS Code 命令面板中输入 `Willump` 即可查看可用命令。

| 命令 | 功能 |
| --- | --- |
| `Willump: 检查端口占用情况` | 检查一个或多个指定端口是否被占用 |
| `Willump: 终止占用端口的进程` | 查找并终止占用指定端口的进程 |
| `Willump: 查看所有端口占用情况` | 在输出面板中展示当前系统端口占用信息 |
| `Willump: 查看端口占用` | 打开 Vue Webview 图形化端口占用视图，并可在确认后终止占用进程 |

## 跨平台支持

Willump 会根据运行平台选择不同的系统命令：

| 平台 | 检查/列出端口 | 终止进程 |
| --- | --- | --- |
| macOS / Linux | `lsof` | `kill -9` |
| Windows | `netstat` | `taskkill` |

## 安装与使用

### 从源码运行

```bash
npm install
npm run compile
```

在 VS Code 中打开项目后，按 `F5` 启动扩展开发宿主窗口，然后在新窗口的命令面板中执行 `Willump` 相关命令。

### 打包扩展

```bash
npm run package
```

执行后会生成 `.vsix` 扩展包，可用于本地安装或发布到扩展市场。

## 开发脚本

| 脚本 | 说明 |
| --- | --- |
| `npm run compile` | 编译 TypeScript 源码 |
| `npm run compile:extension` | 仅编译 VS Code 扩展源码 |
| `npm run compile:webview` | 使用 Vite 编译 Vue Webview 页面 |
| `npm run watch` | 监听源码变化并持续编译 |
| `npm run watch:webview` | 监听 Vue Webview 源码并持续构建 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm test` | 编译、检查并运行 VS Code 扩展测试 |
| `npm run package` | 使用 `vsce` 打包扩展 |

## 开发指南

### 环境要求

- Node.js 20.x 或更高版本。
- VS Code 1.100.0 或更高版本。
- npm，用于安装依赖和执行脚本。
- Vue 3 和 Vite，用于开发 Webview 页面。
- macOS / Linux 环境需要可用的 `lsof` 和 `kill` 命令。
- Windows 环境需要可用的 `netstat` 和 `taskkill` 命令。

### 本地开发流程

1. 安装依赖：

```bash
npm install
```

2. 编译源码：

```bash
npm run compile
```

3. 在 VS Code 中启动 Extension Development Host。

4. 在新打开的 VS Code 窗口中打开命令面板，搜索 `Willump`，执行对应命令进行验证。

也可以点击左侧活动栏中的 `Willump` 图标，在功能入口列表中选择“端口占用”。

开发过程中可以使用监听模式自动编译：

```bash
npm run watch
npm run watch:webview
```

### 在 VS Code 中加载开发版插件

开发 VS Code 扩展时，不需要先打包安装 `.vsix`。推荐使用 VS Code 的 Extension Development Host 加载当前工作区中的开发版插件。

1. 用 VS Code 打开项目目录：

```bash
code /Users/pe7er/Developer/github/willump
```

2. 确认已经安装依赖并完成编译：

```bash
npm install
npm run compile
```

3. 打开 VS Code 左侧的“运行和调试”面板。

Mac 快捷键：

```text
Cmd + Shift + D
```

4. 在顶部调试配置中选择 `Run Extension`。

5. 点击绿色三角形播放按钮。

这会打开一个新的 VS Code 窗口，窗口标题通常会显示为 Extension Development Host。这个新窗口加载的就是当前项目中的开发版 Willump 插件。

6. 在 Extension Development Host 窗口中打开命令面板：

```text
Cmd + Shift + P
```

7. 搜索 `Willump`，即可执行插件命令，例如：

```text
Willump: 检查端口占用情况
Willump: 查看端口占用
```

如果键盘有 `F5`，也可以直接按 `F5` 启动调试；Mac 上部分键盘可能需要使用 `fn + F5`。没有 `F5` 时，使用“运行和调试”面板的绿色播放按钮即可。

修改代码后，如果正在运行监听编译：

```bash
npm run watch
npm run watch:webview
```

回到 Extension Development Host 窗口，执行以下命令即可重新加载开发版插件：

```text
Developer: Reload Window
```

### 调试扩展

本项目使用 VS Code 扩展标准调试方式：

- `src/extension.ts` 是扩展激活入口。
- `activate` 方法中注册所有命令。
- 命令由 `package.json` 中的 `contributes.commands` 声明，并在代码中通过 `vscode.commands.registerCommand` 绑定实现。
- 调试时可在 `src/extension.ts` 或 `src/utils/common.port.ts` 中添加断点。
- 修改 TypeScript 后需要重新编译，或保持 `npm run watch` 运行。

### 新增命令流程

新增一个 VS Code 命令通常需要完成以下步骤：

1. 在 `src/constants/port.ts` 中增加命令 ID 常量。
2. 在 `package.json` 的 `contributes.commands` 中声明命令标题。
3. 在 `src/extension.ts` 的 `activate` 方法中注册命令。
4. 将具体业务逻辑放入 `src/utils/` 下的工具模块，避免入口文件过重。
5. 编译并在 Extension Development Host 中验证命令是否可用。

命令 ID 建议保持 `willump.xxx` 的命名方式，命令标题建议保持 `Willump: xxx` 的展示方式，方便用户在命令面板中搜索。

### 端口功能开发约定

端口相关逻辑目前集中在 `src/utils/common.port.ts` 中，后续扩展时建议遵循以下约定：

- 将系统命令选择逻辑按平台隔离，避免在调用层散落平台判断。
- 对系统命令输出做结构化解析，再交给 VS Code 消息、输出面板或 Webview 展示。
- 终止进程前尽量提供进程信息和确认步骤，降低误操作风险。
- 对 Windows、macOS、Linux 分别验证输出格式，避免只适配单一平台。
- 对用户输入的端口号做校验，过滤空值、非数字和非法端口范围。

### Vue Webview 开发

项目已经集成 Vue 3 + Vite 来开发 Webview 页面，避免直接在扩展代码中拼接大量 HTML 字符串。

```text
webview-ui/
  index.html              # Vite Webview 入口 HTML
  src/
    main.ts               # Vue 应用入口
    App.vue               # 端口占用页面组件
    style.css             # Webview 页面样式
    vscode.ts             # VS Code Webview API 类型与封装

dist/webview/             # Vite 构建产物，由 npm run compile:webview 生成
```

开发 Webview 页面时主要修改 `webview-ui/src/` 下的文件。构建后，扩展会从 `dist/webview/assets/index.js` 和 `dist/webview/assets/style.css` 加载 Vue 页面资源。

扩展与 Vue 页面之间通过 VS Code Webview 消息通信：

- 扩展侧在 `src/extension.ts` 中创建 Webview Panel、注入初始端口数据并监听页面消息。
- Vue 页面通过 `acquireVsCodeApi().postMessage()` 请求刷新端口数据。
- 扩展侧收到刷新请求后重新读取端口列表，并把结果发送回 Vue 页面。

当前 Vue 页面已经支持：

- 展示端口、PID、程序名。
- 按端口、PID、程序名搜索。
- 点击刷新按钮重新读取端口占用。
- 在端口列表中点击“终止”，二次确认后终止占用进程。
- 空数据和错误状态展示。

### Webview 开发建议

当前项目已经使用 Vue 维护端口表格页面，后续如果继续完善图形化端口管理界面，建议：

- 将复杂交互优先放在 Vue 组件中维护，扩展侧只保留 VS Code API、系统命令和消息通信逻辑。
- 增加刷新按钮、搜索框、端口筛选和进程终止操作。
- 使用 VS Code Webview 消息通信处理按钮点击，而不是只展示静态表格。
- 保持界面简洁，优先展示端口、PID、程序名、协议和本地地址等关键信息。
- 对空数据、命令失败、权限不足等情况提供明确反馈。

### 测试建议

当前测试文件仍是 VS Code 模板测试，后续建议补充以下测试：

- 命令 ID 是否与 `package.json` 中声明一致。
- 端口输入解析是否支持多个端口、空格和异常输入。
- macOS / Linux 的 `lsof` 输出解析是否正确。
- Windows 的 `netstat` 输出解析是否正确。
- Webview 数据生成在空列表和正常列表下是否符合预期。

涉及真实系统端口和进程终止的能力建议优先抽象命令执行层，再通过 mock 测试解析与分支逻辑，避免测试时误杀本机进程。

### 发布前检查

发布或打包前建议依次执行：

```bash
npm run lint
npm run compile
npm test
npm run package
```

检查内容包括：

- 扩展是否能正常激活。
- 命令面板中是否能搜索到所有 `Willump` 命令。
- 常见端口检查、端口列表、终止进程流程是否可用。
- `.vsix` 文件是否能够本地安装并正常运行。

## 技术结构

```text
src/
  extension.ts              # 扩展入口，注册 VS Code 命令
  constants/
    index.ts                # 常量导出入口
    port.ts                 # 命令 ID 常量
  utils/
    common.port.ts          # 端口检查、进程终止、端口列表与 Webview 内容生成
  test/
    extension.test.ts       # 扩展测试入口
```

核心实现基于 VS Code Extension API、Node.js `child_process` 以及不同操作系统的端口诊断命令。

## 可以增加的功能

以下能力适合作为 Willump 后续迭代方向：

| 方向 | 建议功能 | 价值 |
| --- | --- | --- |
| 图形化管理 | 完善 Webview 端口列表，增加刷新、搜索、排序、筛选 | 降低排查成本，提升可读性 |
| 安全确认 | 终止进程前展示 PID、程序名、端口并要求确认 | 避免误杀系统或重要进程 |
| 进程详情 | 展示进程路径、启动命令、用户、协议、本地地址 | 帮助判断端口来源 |
| 常用端口 | 支持收藏/配置常用端口，如 3000、5173、8080 | 更适合前端和 Node.js 开发场景 |
| 一键释放 | 在端口列表中直接点击释放某个端口 | 简化操作流程 |
| 端口监控 | 监听指定端口状态变化并提醒 | 适合长期运行服务调试 |
| 开发服务集成 | 释放端口后自动重新执行启动命令 | 打通本地开发闭环 |
| 日志记录 | 记录端口检查和进程终止历史 | 便于回溯问题 |
| 国际化 | 支持中文、英文界面切换 | 便于发布到更广泛用户群 |
| 测试增强 | 为端口解析、命令注册、Webview 数据生成补充单元测试 | 提升扩展稳定性 |

## 当前注意事项

- 终止进程属于高风险操作，请确认端口对应的是可关闭的本地开发进程。
- 在 macOS / Linux 上，某些端口或进程可能需要更高权限才能查看或终止。
- Windows、macOS、Linux 的命令输出格式存在差异，后续可以继续增强解析逻辑的健壮性。
- 图形化端口视图已改为 Vue Webview 实现，但仍建议继续完善交互能力和异常处理。

## 适合的用户

- 前端开发者
- Node.js / Web 服务开发者
- 经常运行多个本地开发服务的工程师
- 需要在 VS Code 内快速排查端口冲突的开发者

## 许可证

本项目基于 MIT License 开源，详见 [LICENSE.md](./LICENSE.md)。

## 作者

[@cbtpro](https://github.com/cbtpro)

## 反馈

欢迎通过 [GitHub Issues](https://github.com/cbtpro/vscode-willump/issues) 提交问题、建议或功能需求。
