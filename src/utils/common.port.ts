import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { localize } from '../i18n';
import { CommandSpec, getPortCommandProfile, PortInfo, PortScanMode, describePort, ProcessDetails } from './port.commands';

/**
 * 检查指定端口的使用情况。
 * 根据不同的操作系统执行相应的命令，判断端口是否被占用，并显示相应的提示信息。
 * @param port - 要检查使用情况的端口号
 */
export function checkPortUsage(port: string) {
	const profile = getPortCommandProfile();

	// 执行命令检查端口使用情况
	executeCommand(profile.checkPortUsage(port), { maxBuffer: 1024 * 1024 })
		.then(({ stdout }) => {
			if (!stdout.trim()) {
				vscode.window.showInformationMessage(localize('port.check.available', { port }));
				return;
			}

			vscode.window.showWarningMessage(localize('port.check.occupied', { port, output: stdout }));
		})
		// 如果执行命令过程中出现错误、有标准错误输出或者没有输出结果
		.catch(() => {
			vscode.window.showInformationMessage(localize('port.check.available', { port }));
		});
}

/**
 * 列出所有被占用的端口信息。
 * 根据不同的操作系统执行相应的命令，将结果显示在 VS Code 的输出面板中。
 */
export function listAllPorts() {
	const profile = getPortCommandProfile();

	// 执行命令，设置最大缓冲区为 1MB
	executeCommand(profile.listAllPorts(), { maxBuffer: 1024 * 1024 })
		.then(({ stdout }) => {
			// 创建一个名为 'Willump Ports' 的输出通道
			const outputChannel = vscode.window.createOutputChannel('Willump Ports');
			// 清空输出通道中的原有内容
			outputChannel.clear();
			// 向输出通道添加标题行
			outputChannel.appendLine(localize('port.output.title'));
			// 向输出通道添加命令执行结果
			outputChannel.appendLine(stdout);
			// 显示输出通道
			outputChannel.show();
		})
		.catch(() => {
			vscode.window.showErrorMessage(localize('port.list.failed'));
		});
}

const execAsync = promisify(childProcess.exec);
const execFileAsync = promisify(childProcess.execFile);

async function executeCommand(command: CommandSpec, options: childProcess.ExecOptions = {}): Promise<{ stdout: string; stderr: string }> {
	const execOptions = {
		encoding: 'utf8' as BufferEncoding,
		...options
	};

	if (command.type === 'shell') {
		const result = await execAsync(command.command, execOptions);

		return {
			stdout: String(result.stdout),
			stderr: String(result.stderr)
		};
	}

	const result = await execFileAsync(command.file, command.args, execOptions);

	return {
		stdout: String(result.stdout),
		stderr: String(result.stderr)
	};
}

export async function killProcessByPid(port: string, pid: string): Promise<void> {
	if (!/^\d+$/.test(pid)) {
		throw new Error(localize('port.invalidPid', { pid }));
	}

	const profile = getPortCommandProfile();

	try {
		await executeCommand(profile.killPid(pid), { timeout: 5000 });
		vscode.window.showInformationMessage(localize('port.kill.success', { port, pid }));
	} catch (err) {
		throw new Error(localize('port.kill.failed', { port, pid }));
	}
}

export async function killProcessOnPort(port: string): Promise<void> {
	if (!/^\d+$/.test(port)) {
		vscode.window.showErrorMessage(localize('port.invalid', { port }));
		return;
	}

	const pids = await getListeningPidsByPort(port);

	if (!pids.length) {
		vscode.window.showInformationMessage(localize('port.check.available', { port }));
		return;
	}

	const failedPids: string[] = [];

	for (const pid of pids) {
		try {
			await killProcessByPid(port, pid);
		} catch (err) {
			failedPids.push(pid);
		}
	}

	if (failedPids.length) {
		vscode.window.showErrorMessage(localize('port.kill.failedMany', { port, pids: failedPids.join(', ') }));
		return;
	}

	vscode.window.showInformationMessage(localize('port.kill.success', { port, pid: pids.join(', ') }));
}

export async function getPortListData(mode: PortScanMode = 'listening'): Promise<PortInfo[]> {
	const profile = getPortCommandProfile();

	try {
		const command = mode === 'all' ? profile.listAllPorts() : profile.listListeningPorts();
		const { stdout } = await executeCommand(command, { maxBuffer: 1024 * 1024, timeout: 5000 });

		const ports = mode === 'all' ? profile.parseAllPorts(stdout) : profile.parseListeningPorts(stdout);
		return enrichProcessNames(ports, profile);
	} catch (err) {
		const execError = err as childProcess.ExecException & { stdout?: string };

		if (profile.isEmptyListeningResult(execError)) {
			return [];
		}

		vscode.window.showErrorMessage(localize('port.list.failed'));
		return [];
	}
}

async function enrichProcessNames(ports: PortInfo[], profile = getPortCommandProfile()): Promise<PortInfo[]> {
	const namesByPid = new Map<string, string>();
	const detailsByPid = new Map<string, ProcessDetails>();
	const pids = Array.from(new Set(ports.map(item => item.pid).filter(pid => /^\d+$/.test(pid))));

	if (profile.listProcessDetails && profile.parseProcessDetailsList && pids.length) {
		try {
			const { stdout } = await executeCommand(profile.listProcessDetails(pids), { maxBuffer: 1024 * 1024 * 4, timeout: 5000 });
			const processDetails = profile.parseProcessDetailsList(stdout);

			for (const pid of pids) {
				const details = processDetails.get(pid);

				if (details) {
					detailsByPid.set(pid, details);
				}
			}
		} catch (err) {
			// Fall back to lightweight process-name lookup and per-process details below.
		}
	}

	if (profile.listProcessNames && profile.parseProcessNameList && pids.length) {
		try {
			const { stdout } = await executeCommand(profile.listProcessNames(), { maxBuffer: 1024 * 1024 * 4, timeout: 5000 });
			const processNames = profile.parseProcessNameList(stdout);

			for (const pid of pids) {
				const name = processNames.get(pid);

				if (name) {
					namesByPid.set(pid, name);
				}
			}
		} catch (err) {
			// Fall back to per-process lookup below when bulk process listing is unavailable.
		}
	}

	const missingPids = pids.filter(pid => !namesByPid.has(pid));
	const missingDetailPids = pids.filter(pid => !detailsByPid.has(pid));

	await Promise.all(
		missingDetailPids.map(async pid => {
			if (!profile.getProcessDetails || !profile.parseProcessDetails) {
				return;
			}

			try {
				const { stdout } = await executeCommand(profile.getProcessDetails(pid), { maxBuffer: 1024 * 1024, timeout: 3000 });
				const details = profile.parseProcessDetails(stdout, pid);

				if (details) {
					detailsByPid.set(pid, details);
				}
			} catch (err) {
				// Process details can be unavailable for short-lived or protected processes.
			}
		})
	);

	await Promise.all(
		missingPids.map(async pid => {
			try {
				const { stdout } = await executeCommand(profile.getProcessName(pid), { maxBuffer: 1024 * 64, timeout: 2500 });
				const name = profile.parseProcessName(stdout, pid);
				if (name) {
					namesByPid.set(pid, name);
				}
			} catch (err) {
				// Keep the original command from the port scanner when process lookup is unavailable.
			}
		})
	);

	return ports.map(item => {
		const details = detailsByPid.get(item.pid);
		const pidName = details?.name ?? namesByPid.get(item.pid) ?? item.command;
		const service = describePort(item.port);
		const commandFull = details?.commandLine ?? namesByPid.get(item.pid) ?? pidName;
		const commandShort = service ? `${getProcessDisplayName(pidName)} (${service})` : getProcessDisplayName(pidName);

		return {
			...item,
			command: commandShort,
			commandFull,
			processPath: details?.processPath,
			service
		};
	});
}

function getProcessDisplayName(command: string): string {
	const firstToken = command.trim().split(/\s+/)[0] ?? '';
	const executablePath = firstToken.match(/^"([^"]+)"/)?.[1] ?? firstToken;

	return executablePath.split(/[\\/]/).filter(Boolean).pop() ?? executablePath;
}

async function getListeningPidsByPort(port: string): Promise<string[]> {
	const profile = getPortCommandProfile();

	try {
		const { stdout } = await executeCommand(profile.findListeningPids(port), { maxBuffer: 1024 * 1024, timeout: 5000 });
		return profile.parseListeningPids(stdout, port);
	} catch (err) {
		const execError = err as childProcess.ExecException & { stdout?: string };

		if (profile.isEmptyListeningResult(execError)) {
			return [];
		}

		throw err;
	}
}
