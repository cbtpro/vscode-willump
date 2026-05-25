import * as vscode from 'vscode';

const messages = {
	'zh-CN': {
		'command.checkPort.prompt': '请输入要检查的端口（用空格分隔），例如：3000 8080',
		'command.killPort.prompt': '输入要终止进程的端口（用空格分隔）',
		'feature.devConfig.description': 'Git / 后续更多配置',
		'feature.devConfig.git.description': '作者 / 邮箱',
		'feature.devConfig.git.open': '打开 Git 开发配置',
		'feature.devConfig.git.title': 'Git',
		'feature.devConfig.title': '开发配置',
		'feature.ports.description': '查看 / 搜索 / 终止',
		'feature.ports.open': '打开端口占用视图',
		'feature.ports.title': '端口占用',
		'feature.system.description': '计算机 / 网络 / 硬件',
		'feature.system.open': '打开本机信息',
		'feature.system.title': '本机信息',
		'git.loadFailed': '读取 Git 配置失败',
		'git.noWorkspace': '当前没有打开工作区，无法读取项目 Git 配置',
		'git.saveFailed': '保存 Git 配置失败',
		'git.saveMissingScope': '缺少工作区或配置范围，无法保存 Git 配置',
		'git.title': 'Git 开发配置',
		'port.check.available': '端口 {port} 没有被占用',
		'port.check.occupied': '端口 {port} 已被占用：\n{output}',
		'port.invalid': '无效的端口：{port}',
		'port.invalidPid': '无效的进程 PID：{pid}',
		'port.kill.failed': '无法终止端口 {port} 的进程 {pid}',
		'port.kill.failedMany': '无法终止端口 {port} 的进程 {pids}',
		'port.kill.missing': '缺少端口或进程信息，无法终止进程',
		'port.kill.success': '已终止端口 {port} 的进程 {pid}',
		'port.killResult.failed': '终止进程失败',
		'port.list.failed': '获取端口数据失败',
		'port.output.title': '当前占用端口：',
		'system.loadFailed': '获取本机信息失败',
		'system.title': '本机信息'
	},
	'en-US': {
		'command.checkPort.prompt': 'Enter ports to check, separated by spaces. Example: 3000 8080',
		'command.killPort.prompt': 'Enter ports whose processes should be terminated, separated by spaces.',
		'feature.devConfig.description': 'Git / more configs later',
		'feature.devConfig.git.description': 'Author / email',
		'feature.devConfig.git.open': 'Open Git config',
		'feature.devConfig.git.title': 'Git',
		'feature.devConfig.title': 'Dev Config',
		'feature.ports.description': 'View / search / terminate',
		'feature.ports.open': 'Open ports view',
		'feature.ports.title': 'Ports',
		'feature.system.description': 'Computer / network / hardware',
		'feature.system.open': 'Open system info',
		'feature.system.title': 'System Info',
		'git.loadFailed': 'Failed to read Git config',
		'git.noWorkspace': 'No workspace is open, so project Git config cannot be read.',
		'git.saveFailed': 'Failed to save Git config',
		'git.saveMissingScope': 'Missing workspace or config scope, so Git config cannot be saved.',
		'git.title': 'Git Config',
		'port.check.available': 'Port {port} is not in use',
		'port.check.occupied': 'Port {port} is in use:\n{output}',
		'port.invalid': 'Invalid port: {port}',
		'port.invalidPid': 'Invalid process PID: {pid}',
		'port.kill.failed': 'Failed to terminate process {pid} on port {port}',
		'port.kill.failedMany': 'Failed to terminate processes on port {port}: {pids}',
		'port.kill.missing': 'Missing port or process info, cannot terminate process.',
		'port.kill.success': 'Terminated process {pid} on port {port}',
		'port.killResult.failed': 'Failed to terminate process',
		'port.list.failed': 'Failed to load port data',
		'port.output.title': 'Current occupied ports:',
		'system.loadFailed': 'Failed to load system info',
		'system.title': 'System Info'
	}
} as const;

type Locale = keyof typeof messages;

export function localize(key: keyof typeof messages['en-US'], params: Record<string, string | number> = {}): string {
	const locale = getLocale();
	const template: string = messages[locale][key] ?? messages['en-US'][key] ?? key;
	return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}

function getLocale(): Locale {
	return vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}
