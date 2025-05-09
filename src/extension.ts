// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
	checkPortUsage,
	killProcessOnPort,
	listAllPorts,
	getWebviewContent,
	getPortListData
} from './utils/common.port';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "willump" is now active!');

	// 新的 checkPort 命令
	const checkPortCommand = vscode.commands.registerCommand('willump.checkPort', async () => {
		const input = await vscode.window.showInputBox({
			prompt: '请输入要检查的端口（用空格分隔），例如：3000 8080',
			placeHolder: '3000 8080'
		});

		if (!input) {
			return;
		}

		const ports = input
			.split(/\s+/)
			.map(p => p.trim())
			.filter(Boolean);

		for (const port of ports) {
			checkPortUsage(port);
		}
	});
	context.subscriptions.push(checkPortCommand);

	context.subscriptions.push(
		vscode.commands.registerCommand('willump.killPort', async () => {
			const input = await vscode.window.showInputBox({
				prompt: '输入要杀掉进程的端口（用空格分隔）',
				placeHolder: '3000 8080'
			});
			if (!input) {
				return;
			}

			const ports = input.split(/\s+/).filter(Boolean);
			for (const port of ports) {
				killProcessOnPort(port);
			}
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('willump.listPorts', async () => {
			listAllPorts();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('willump.viewPorts', async () => {
			const panel = vscode.window.createWebviewPanel('willumpPortsView', '当前端口占用情况', vscode.ViewColumn.One, {
				enableScripts: true
			});

			// 获取端口信息
			const portsInfo = await getPortListData(); // 假设这个方法返回 JSON 数据
			const html = getWebviewContent(portsInfo);
			panel.webview.html = html;
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
