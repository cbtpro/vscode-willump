import * as vscode from 'vscode';
import * as childProcess from 'child_process';

/**
 * 检查指定端口的使用情况。
 * 根据不同的操作系统执行相应的命令，判断端口是否被占用，并显示相应的提示信息。
 * @param port - 要检查使用情况的端口号
 */
export function checkPortUsage(port: string) {
	// 获取当前操作系统平台
	const platform = process.platform;

	// 用于存储要执行的命令
	let cmd = '';
	// 根据不同的操作系统设置不同的命令
	if (platform === 'win32') {
		// Windows 系统使用 netstat 命令结合 findstr 查找指定端口的信息
		cmd = `netstat -ano | findstr :${port}`;
	} else {
		// macOS 或 Linux 系统使用 lsof 命令查找指定端口的信息
		cmd = `lsof -i :${port}`;
	}

	// 执行命令检查端口使用情况
	childProcess.exec(cmd, (err, stdout, stderr) => {
		// 如果执行命令过程中出现错误、有标准错误输出或者没有输出结果
		if (err || stderr || !stdout.trim()) {
			// 显示端口未被占用的信息
			vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
		} else {
			// 显示端口已被占用的信息，并附上命令输出结果
			vscode.window.showWarningMessage(`❌ 端口 ${port} 已被占用：\n${stdout}`);
		}
	});
}

/**
 * 终止指定端口上正在运行的进程。
 * 根据不同的操作系统执行相应的命令来查找并终止进程。
 * @param port - 要终止进程的端口号
 */
export function killProcessOnPort(port: string) {
	// 获取当前操作系统平台
	const platform = process.platform;

	// 判断当前操作系统是否为 Windows
	if (platform === 'win32') {
		// Windows 系统使用 netstat 命令查找指定端口对应的进程信息
		const findCmd = `netstat -ano | findstr :${port}`;
		// 执行查找进程信息的命令
		childProcess.exec(findCmd, (err, stdout) => {
			// 使用正则表达式匹配进程 ID（PID）
			const match = stdout.match(/(\d+)\s*$/m);
			if (match) {
				// 从匹配结果中提取 PID
				const pid = match[1];
				// 使用 taskkill 命令强制终止指定 PID 的进程
				childProcess.exec(`taskkill /PID ${pid} /F`, killErr => {
					if (killErr) {
						// 若终止进程失败，显示错误信息
						vscode.window.showErrorMessage(`❌ 无法终止端口 ${port} 的进程 ${pid}`);
					} else {
						// 若终止进程成功，显示成功信息
						vscode.window.showInformationMessage(`✅ 已终止端口 ${port} 的进程 ${pid}`);
					}
				});
			} else {
				// 若未找到匹配的进程，显示端口未被占用的信息
				vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
			}
		});
	} else {
		// macOS 或 Linux 系统使用 lsof 命令查找指定端口对应的进程 ID
		const findCmd = `lsof -ti :${port}`;
		// 执行查找进程 ID 的命令
		childProcess.exec(findCmd, (err, stdout) => {
			// 去除输出结果的首尾空格，获取 PID
			const pid = stdout.trim();
			if (pid) {
				// 使用 kill -9 命令强制终止指定 PID 的进程
				childProcess.exec(`kill -9 ${pid}`, killErr => {
					if (killErr) {
						// 若终止进程失败，显示错误信息
						vscode.window.showErrorMessage(`❌ 无法终止端口 ${port} 的进程 ${pid}`);
					} else {
						// 若终止进程成功，显示成功信息
						vscode.window.showInformationMessage(`✅ 已终止端口 ${port} 的进程 ${pid}`);
					}
				});
			} else {
				// 若未找到匹配的进程，显示端口未被占用的信息
				vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
			}
		});
	}
}

/**
 * 列出所有被占用的端口信息。
 * 根据不同的操作系统执行相应的命令，将结果显示在 VS Code 的输出面板中。
 */
export function listAllPorts() {
	// 获取当前操作系统平台
	const platform = process.platform;
	// 用于存储要执行的命令
	let cmd = '';

	// 根据不同的操作系统设置不同的命令
	if (platform === 'win32') {
		// Windows 系统使用 netstat -ano 命令获取端口信息
		cmd = 'netstat -ano';
	} else {
		// macOS 或 Linux 系统使用 lsof -i -P -n 命令获取端口信息
		cmd = 'lsof -i -P -n';
	}

	// 执行命令，设置最大缓冲区为 1MB
	childProcess.exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
		// 如果执行命令过程中出现错误或有标准错误输出
		if (err || stderr) {
			// 显示错误信息给用户
			vscode.window.showErrorMessage('❌ 获取端口信息失败');
			return;
		}

		// 创建一个名为 'Willump Ports' 的输出通道
		const outputChannel = vscode.window.createOutputChannel('Willump Ports');
		// 清空输出通道中的原有内容
		outputChannel.clear();
		// 向输出通道添加标题行
		outputChannel.appendLine('📡 当前占用端口：');
		// 向输出通道添加命令执行结果
		outputChannel.appendLine(stdout);
		// 显示输出通道
		outputChannel.show();
	});
}
