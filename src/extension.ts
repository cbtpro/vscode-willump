// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { checkPortUsage, killProcessOnPort, listAllPorts } from './utils/common.port';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "willump" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('willump.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello VS Code!');
	});
	context.subscriptions.push(disposable);

	// 新的 checkPort 命令
	const checkPortCommand = vscode.commands.registerCommand('willump.checkPort', async () => {
		const input = await vscode.window.showInputBox({
			prompt: '请输入要检查的端口（用空格分隔），例如：3000 8080',
			placeHolder: '3000 8080'
		});

		if (!input) return;

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
			if (!input) return;

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
}

// This method is called when your extension is deactivated
export function deactivate() {}
