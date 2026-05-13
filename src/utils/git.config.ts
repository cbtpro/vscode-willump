import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
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
	workspaces: GitWorkspaceOverview[];
	effectiveIdentity: {
		name: string;
		email: string;
		source: string;
		isGithubNoreply: boolean;
	};
	git: {
		available: boolean;
		version: string;
		path: string;
		error?: string;
	};
	remote: {
		remotes: GitRemoteInfo[];
	};
	branch: {
		current: string;
		upstream: string;
	};
	pushDefault: string;
	lineEnding: {
		autocrlf: string;
		eol: string;
		ignorecase: string;
	};
	editor: string;
	ssh: {
		publicKeys: string[];
		agentKeys: string[];
		error?: string;
	};
	hooks: GitHookInfo[];
	lfs: {
		available: boolean;
		version: string;
		enabled: boolean;
	};
}

export interface GitWorkspaceOverview {
	name: string;
	path: string;
	localName: string;
	localEmail: string;
	effectiveName: string;
	effectiveEmail: string;
	branch: string;
	upstream: string;
	remote: string;
	available: boolean;
	error?: string;
}

export interface GitRemoteInfo {
	name: string;
	url: string;
}

export interface GitHookInfo {
	name: string;
	executable: boolean;
}

export async function getGitConfigInfo(workspacePath: string, workspacePaths: string[] = [workspacePath]): Promise<GitConfigInfo> {
	const [local, global, git, remotes, branch, pushDefault, autocrlf, eol, ignorecase, editor, ssh, hooks, lfs, workspaces] = await Promise.all([
		readScope('local', workspacePath),
		readScope('global'),
		readGitAvailability(),
		readRemotes(workspacePath),
		readBranchInfo(workspacePath),
		readGitConfig(['--get', 'push.default'], { cwd: workspacePath }),
		readGitConfig(['--get', 'core.autocrlf'], { cwd: workspacePath }),
		readGitConfig(['--get', 'core.eol'], { cwd: workspacePath }),
		readGitConfig(['--get', 'core.ignorecase'], { cwd: workspacePath }),
		readGitConfig(['--global', '--get', 'core.editor']),
		readSshInfo(),
		readHooks(workspacePath),
		readLfsInfo(workspacePath),
		Promise.all(workspacePaths.map(readWorkspaceOverview))
	]);
	const effectiveName = local.name || global.name;
	const effectiveEmail = local.email || global.email;

	return {
		local,
		global,
		workspacePath,
		workspaces,
		effectiveIdentity: {
			name: effectiveName,
			email: effectiveEmail,
			source: local.name || local.email ? 'local' : 'global',
			isGithubNoreply: effectiveEmail.includes('@users.noreply.github.com')
		},
		git,
		remote: {
			remotes
		},
		branch,
		pushDefault,
		lineEnding: {
			autocrlf,
			eol,
			ignorecase
		},
		editor,
		ssh,
		hooks,
		lfs
	};
}

export async function updateGitConfig(scope: 'local' | 'global', data: { name: string; email: string }, workspacePath: string): Promise<void> {
	const argsPrefix = scope === 'global' ? ['--global'] : ['--local'];
	const options = scope === 'global' ? undefined : { cwd: workspacePath };

	await execGit([...argsPrefix, 'user.name', data.name], options);
	await execGit([...argsPrefix, 'user.email', data.email], options);
}

export async function updateGitSetting(scope: 'local' | 'global', key: string, value: string, workspacePath: string): Promise<void> {
	const argsPrefix = scope === 'global' ? ['--global'] : ['--local'];
	const options = scope === 'global' ? undefined : { cwd: workspacePath };

	await execGit([...argsPrefix, key, value], options);
}

async function readGitAvailability(): Promise<GitConfigInfo['git']> {
	try {
		const [{ stdout: version }, pathResult] = await Promise.all([
			execFileAsync('git', ['--version'], { encoding: 'utf8', timeout: 5000 }),
			execFileAsync('which', ['git'], { encoding: 'utf8', timeout: 5000 }).catch(() => ({ stdout: '' }))
		]);

		return {
			available: true,
			version: String(version).trim(),
			path: String(pathResult.stdout).trim()
		};
	} catch (err) {
		return {
			available: false,
			version: '',
			path: '',
			error: err instanceof Error ? err.message : 'Git unavailable'
		};
	}
}

async function readWorkspaceOverview(workspacePath: string): Promise<GitWorkspaceOverview> {
	try {
		const [localName, localEmail, effectiveName, effectiveEmail, branch, upstream, remotes] = await Promise.all([
			readGitConfig(['--local', '--get', 'user.name'], { cwd: workspacePath }),
			readGitConfig(['--local', '--get', 'user.email'], { cwd: workspacePath }),
			readGitConfig(['--get', 'user.name'], { cwd: workspacePath }),
			readGitConfig(['--get', 'user.email'], { cwd: workspacePath }),
			readGitConfig(['branch', '--show-current'], { cwd: workspacePath }),
			readGitConfig(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: workspacePath }),
			readRemotes(workspacePath)
		]);

		return {
			name: path.basename(workspacePath),
			path: workspacePath,
			localName,
			localEmail,
			effectiveName,
			effectiveEmail,
			branch,
			upstream,
			remote: remotes.map(item => `${item.name}: ${item.url}`).join('\n'),
			available: true
		};
	} catch (err) {
		return {
			name: path.basename(workspacePath),
			path: workspacePath,
			localName: '',
			localEmail: '',
			effectiveName: '',
			effectiveEmail: '',
			branch: '',
			upstream: '',
			remote: '',
			available: false,
			error: err instanceof Error ? err.message : 'Not a Git repository'
		};
	}
}

async function readRemotes(workspacePath: string): Promise<GitRemoteInfo[]> {
	const output = await readRawGit(['remote', '-v'], { cwd: workspacePath });
	const remotes = output
		.split(/\r?\n/)
		.map(line => line.trim().match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/))
		.filter((match): match is RegExpMatchArray => Boolean(match))
		.filter(match => match[3] === 'fetch')
		.map(match => ({ name: match[1], url: match[2] }));

	return remotes;
}

async function readBranchInfo(workspacePath: string): Promise<GitConfigInfo['branch']> {
	const [current, upstream] = await Promise.all([
		readRawGit(['branch', '--show-current'], { cwd: workspacePath }),
		readRawGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: workspacePath }).catch(() => '')
	]);

	return {
		current: current.trim(),
		upstream: upstream.trim()
	};
}

async function readSshInfo(): Promise<GitConfigInfo['ssh']> {
	try {
		const sshDir = path.join(os.homedir(), '.ssh');
		const files = await fs.readdir(sshDir).catch(() => []);
		const publicKeys = files.filter(file => file.endsWith('.pub')).map(file => path.join(sshDir, file));
		const agentResult = await execFileAsync('ssh-add', ['-l'], { encoding: 'utf8', timeout: 5000 }).catch(err => ({
			stdout: '',
			stderr: err instanceof Error ? err.message : ''
		}));

		return {
			publicKeys,
			agentKeys: String(agentResult.stdout).trim().split(/\r?\n/).filter(Boolean),
			error: String(agentResult.stderr || '').trim()
		};
	} catch (err) {
		return {
			publicKeys: [],
			agentKeys: [],
			error: err instanceof Error ? err.message : 'Failed to read SSH keys'
		};
	}
}

async function readHooks(workspacePath: string): Promise<GitHookInfo[]> {
	const gitDir = (await readRawGit(['rev-parse', '--git-dir'], { cwd: workspacePath }).catch(() => '')).trim();
	const hooksDir = gitDir ? path.resolve(workspacePath, gitDir, 'hooks') : '';
	const files = hooksDir ? await fs.readdir(hooksDir).catch(() => []) : [];
	const hooks = await Promise.all(
		files
			.filter(file => !file.endsWith('.sample'))
			.map(async file => {
				const stat = await fs.stat(path.join(hooksDir, file));
				return {
					name: file,
					executable: Boolean(stat.mode & 0o111)
				};
			})
	);

	return hooks;
}

async function readLfsInfo(workspacePath: string): Promise<GitConfigInfo['lfs']> {
	const version = await execFileAsync('git', ['lfs', 'version'], { encoding: 'utf8', timeout: 5000 })
		.then(result => String(result.stdout).trim())
		.catch(() => '');
	const filterProcess = await readGitConfig(['--get', 'filter.lfs.process'], { cwd: workspacePath });

	return {
		available: Boolean(version),
		version,
		enabled: Boolean(filterProcess)
	};
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
		if (isGitConfigArgs(args)) {
			const { stdout } = await execGit(args, options);
			return stdout.trim();
		}

		return (await readRawGit(args, options)).trim();
	} catch (err) {
		return '';
	}
}

async function readRawGit(args: string[], options?: childProcess.ExecFileOptions): Promise<string> {
	const { stdout } = await execFileAsync('git', args, {
		encoding: 'utf8',
		timeout: 5000,
		...options
	});

	return String(stdout);
}

function isGitConfigArgs(args: string[]): boolean {
	return args.includes('--get') || args.includes('--show-origin') || args.includes('--global') || args.includes('--local');
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
