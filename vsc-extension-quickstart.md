# Welcome to your VS Code Extension

# 欢迎使用你的 VS Code 扩展

This document is the default quickstart guide generated for a VS Code extension project. The Chinese translation below keeps the original meaning and adds practical notes for developers who are new to VS Code extension development.

本文档是 VS Code 扩展项目默认生成的快速入门指南。下面的中文翻译保留了原文含义，并补充了一些适合初次开发 VS Code 扩展的说明。

## What's in the folder

## 目录里有什么

* This folder contains all of the files necessary for your extension.

* 当前目录包含开发这个 VS Code 扩展所需的所有文件。

* `package.json` - this is the manifest file in which you declare your extension and command.

* `package.json` 是扩展的清单文件，用于声明扩展的基本信息、命令、入口文件、贡献点等内容。

  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.

  * 示例扩展会注册一个命令，并定义命令标题和命令 ID。VS Code 可以根据这些信息在命令面板中展示该命令。此时 VS Code 还不需要真正加载扩展代码。

* `src/extension.ts` - this is the main file where you will provide the implementation of your command.

* `src/extension.ts` 是扩展的主要入口文件，你会在这里实现命令对应的功能逻辑。

  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.

  * 这个文件会导出一个 `activate` 函数。扩展第一次被激活时，VS Code 会调用该函数。在当前示例中，执行命令会触发扩展激活。通常会在 `activate` 函数中调用 `registerCommand` 注册命令处理函数。

  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

  * `registerCommand` 的第二个参数就是命令的具体实现函数。当用户执行该命令时，VS Code 会调用这个函数。

## Get up and running straight away

## 快速运行扩展

* Press `F5` to open a new window with your extension loaded.

* 按 `F5` 可以打开一个新的 VS Code 窗口，并在该窗口中加载当前开发中的扩展。

  * On Mac keyboards without a visible `F5` key, open the Run and Debug view with `Cmd+Shift+D`, choose `Run Extension`, then click the green play button.

  * 如果你的 Mac 键盘没有明显的 `F5` 键，可以按 `Cmd+Shift+D` 打开“运行和调试”面板，选择 `Run Extension`，然后点击绿色播放按钮。

* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.

* 按 `Ctrl+Shift+P`，Mac 上按 `Cmd+Shift+P`，打开命令面板，然后输入 `Hello World`，即可运行示例命令。

  * For this project, search for `Willump` in the command palette to run the extension commands.

  * 对于当前项目，可以在命令面板中搜索 `Willump` 来运行扩展命令。

* Set breakpoints in your code inside `src/extension.ts` to debug your extension.

* 可以在 `src/extension.ts` 中设置断点，用于调试扩展逻辑。

* Find output from your extension in the debug console.

* 扩展运行时输出的日志可以在调试控制台中查看。

## Make changes

## 修改代码

* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.

* 修改 `src/extension.ts` 之后，可以通过调试工具栏重新启动扩展。

* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

* 也可以在加载扩展的 VS Code 窗口中按 `Ctrl+R`，Mac 上按 `Cmd+R`，重新加载窗口，让修改后的代码生效。

  * You can also run `Developer: Reload Window` from the command palette.

  * 也可以在命令面板中执行 `Developer: Reload Window` 来重新加载窗口。

## Explore the API

## 探索 VS Code API

* You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

* 打开 `node_modules/@types/vscode/index.d.ts` 可以查看完整的 VS Code API 类型定义。

  * These type definitions are useful when you want to learn available APIs, command registration, webview APIs, workspace APIs, window APIs, and more.

  * 这些类型定义可以帮助你了解可用的 VS Code API，例如命令注册、Webview、工作区、窗口、消息提示等能力。

## Run tests

## 运行测试

* Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) 扩展。

* Run the "watch" task via the **Tasks: Run Task** command. Make sure this is running, or tests might not be discovered.

* 通过 **Tasks: Run Task** 命令运行 `watch` 任务。请确保该任务正在运行，否则测试可能无法被发现。

* Open the Testing view from the activity bar and click the Run Test" button, or use the hotkey `Ctrl/Cmd + ; A`

* 从活动栏打开 Testing 测试视图，点击运行测试按钮；也可以使用快捷键 `Ctrl/Cmd + ; A`。

* See the output of the test result in the Test Results view.

* 可以在 Test Results 测试结果视图中查看测试输出。

* Make changes to `src/test/extension.test.ts` or create new test files inside the `test` folder.

* 可以修改 `src/test/extension.test.ts`，也可以在 `test` 目录中创建新的测试文件。

  * The provided test runner will only consider files matching the name pattern `**.test.ts`.

  * 默认测试运行器只会识别符合 `**.test.ts` 命名规则的测试文件。

  * You can create folders inside the `test` folder to structure your tests any way you want.

  * 你可以在 `test` 目录中创建子目录，用自己喜欢的方式组织测试文件。

## Go further

## 继续深入

* [Follow UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) to create extensions that seamlessly integrate with VS Code's native interface and patterns.

* 阅读 [VS Code UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)，可以帮助你创建更符合 VS Code 原生交互和界面风格的扩展。

* Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).

* 通过 [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) 打包扩展代码，可以减小扩展体积并提升启动速度。

* [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.

* 参考 [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)，可以将扩展发布到 VS Code 扩展市场。

* Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).

* 通过配置 [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)，可以自动化构建、测试和发布流程。

* Integrate to the [report issue](https://code.visualstudio.com/api/get-started/wrapping-up#issue-reporting) flow to get issue and feature requests reported by users.

* 集成 [report issue](https://code.visualstudio.com/api/get-started/wrapping-up#issue-reporting) 流程后，用户可以更方便地反馈问题和功能需求。
