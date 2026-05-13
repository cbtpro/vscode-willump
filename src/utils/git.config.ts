import * as childProcess from 'child_process';
import { promisify } from 'util';
import { localize } from '../i18n';

const execFileAsync = promisify(childProcess.execFile);

export interface GitConfigScope {
	name: string;
	email: string;
	configPath: string;
	available: boolean;
	error?: string;
}

export interface GitConfigInfo {
	local: GitConfigScope;
	global: GitConfigScope;
	workspacePath: string;
}

export async function getGitConfigInfo(workspacePath: string): Promise<GitConfigInfo> {
	const [local, global] = await Promise.all([readScope('local', workspacePath), readScope('global')]);

	return {
		local,
		global,
		workspacePath
	};
}

export async function updateGitConfig(scope: 'local' | 'global', data: { name: string; email: string }, workspacePath: string): Promise<void> {
	const argsPrefix = scope === 'global' ? ['--global'] : ['--local'];
	const options = scope === 'global' ? undefined : { cwd: workspacePath };

	await execGit([...argsPrefix, 'user.name', data.name], options);
	await execGit([...argsPrefix, 'user.email', data.email], options);
}

async function readScope(scope: 'local' | 'global', workspacePath?: string): Promise<GitConfigScope> {
	const argsPrefix = scope === 'global' ? ['--global'] : ['--local'];
	const options = scope === 'global' ? undefined : { cwd: workspacePath };

	try {
		if (scope === 'local') {
			await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
				encoding: 'utf8',
				timeout: 5000,
				...options
			});
		}

		const [name, email, configPath] = await Promise.all([
			readGitConfig([...argsPrefix, '--get', 'user.name'], options),
			readGitConfig([...argsPrefix, '--get', 'user.email'], options),
			readGitConfig([...argsPrefix, '--show-origin', '--get', 'user.name'], options)
		]);

		return {
			name,
			email,
			configPath: parseConfigOrigin(configPath),
			available: true
		};
	} catch (err) {
		const error = err instanceof Error ? err.message : localize('git.loadFailed');

		return {
			name: '',
			email: '',
			configPath: '',
			available: false,
			error
		};
	}
}

async function readGitConfig(args: string[], options?: childProcess.ExecFileOptions): Promise<string> {
	try {
		const { stdout } = await execGit(args, options);
		return stdout.trim();
	} catch (err) {
		return '';
	}
}

async function execGit(args: string[], options?: childProcess.ExecFileOptions): Promise<{ stdout: string; stderr: string }> {
	const { stdout, stderr } = await execFileAsync('git', ['config', ...args], {
		encoding: 'utf8',
		timeout: 5000,
		...options
	});

	return {
		stdout: String(stdout),
		stderr: String(stderr)
	};
}

function parseConfigOrigin(origin: string): string {
	const match = origin.match(/^file:(.+?)\t/);
	return match?.[1] ?? '';
}
