import * as assert from 'assert';
import { getPortCommandProfile } from '../utils/port.commands';

suite('Port Command Profile Test Suite', () => {
	test('generates POSIX commands for checking, listing, finding and killing ports', () => {
		const profile = getPortCommandProfile('darwin');

		assert.deepStrictEqual(profile.checkPortUsage('8080'), {
			type: 'file',
			file: 'lsof',
			args: ['-iTCP:8080', '-sTCP:LISTEN', '-P', '-n']
		});
		assert.deepStrictEqual(profile.findListeningPids('8080'), {
			type: 'file',
			file: 'lsof',
			args: ['-tiTCP:8080', '-sTCP:LISTEN']
		});
		assert.deepStrictEqual(profile.getProcessName('12345'), {
			type: 'file',
			file: 'ps',
			args: ['-p', '12345', '-o', 'command=']
		});
		assert.deepStrictEqual(profile.killPid('12345'), {
			type: 'file',
			file: 'kill',
			args: ['-9', '12345']
		});
		assert.deepStrictEqual(profile.listListeningPorts(), {
			type: 'file',
			file: 'lsof',
			args: ['-iTCP', '-sTCP:LISTEN', '-P', '-n']
		});
	});

	test('generates Windows commands for checking, listing, finding and killing ports', () => {
		const profile = getPortCommandProfile('win32');

		assert.deepStrictEqual(profile.checkPortUsage('8080'), {
			type: 'shell',
			command: 'netstat -ano | findstr :8080'
		});
		assert.deepStrictEqual(profile.findListeningPids('8080'), {
			type: 'shell',
			command: 'netstat -ano'
		});
		assert.deepStrictEqual(profile.getProcessName('12345'), {
			type: 'file',
			file: 'tasklist',
			args: ['/FI', 'PID eq 12345', '/FO', 'CSV', '/NH']
		});
		assert.deepStrictEqual(profile.killPid('12345'), {
			type: 'file',
			file: 'taskkill',
			args: ['/PID', '12345', '/F']
		});
		assert.deepStrictEqual(profile.listProcessNames?.(), {
			type: 'file',
			file: 'tasklist',
			args: ['/FO', 'CSV', '/NH']
		});
		assert.deepStrictEqual(profile.listListeningPorts(), {
			type: 'shell',
			command: 'netstat -ano'
		});
	});

	test('parses POSIX listening ports and filters connected client rows', () => {
		const profile = getPortCommandProfile('darwin');
		const stdout = [
			'COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
			'java    50324 user   57u  IPv6 123456      0t0  TCP *:8080 (LISTEN)',
			'Google  83903 user   66u  IPv4 654321      0t0  TCP 127.0.0.1:50100->127.0.0.1:8080 (ESTABLISHED)',
			'node    61000 user   21u  IPv4 789012      0t0  TCP 127.0.0.1:3000 (LISTEN)',
			'node    61000 user   22u  IPv6 789013      0t0  TCP *:3000 (LISTEN)'
		].join('\n');

		assert.deepStrictEqual(profile.parseListeningPorts(stdout), [
			{ command: 'java', pid: '50324', port: '8080', type: 'TCP LISTEN' },
			{ command: 'node', pid: '61000', port: '3000', type: 'TCP LISTEN' }
		]);
	});

	test('parses POSIX all network connections with protocol and state', () => {
		const profile = getPortCommandProfile('darwin');
		const stdout = [
			'COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
			'java    50324 user   57u  IPv6 123456      0t0  TCP *:8080 (LISTEN)',
			'Google  83903 user   66u  IPv4 654321      0t0  TCP 127.0.0.1:50100->127.0.0.1:8080 (ESTABLISHED)',
			'mDNS    200 user   10u  IPv4 111111      0t0  UDP *:5353'
		].join('\n');

		assert.deepStrictEqual(profile.parseAllPorts(stdout), [
			{ command: 'java', pid: '50324', port: '8080', type: 'TCP LISTEN' },
			{ command: 'Google', pid: '83903', port: '50100', type: 'TCP ESTABLISHED' },
			{ command: 'mDNS', pid: '200', port: '5353', type: 'UDP' }
		]);
	});

	test('parses POSIX listening pids and removes duplicates or invalid values', () => {
		const profile = getPortCommandProfile('linux');

		assert.deepStrictEqual(profile.parseListeningPids('50324\n83903\n50324\nnot-a-pid\n', '8080'), ['50324', '83903']);
	});

	test('parses POSIX full process names from ps command output', () => {
		const profile = getPortCommandProfile('darwin');

		assert.strictEqual(
			profile.parseProcessName('/Applications/Docker.app/Contents/MacOS/com.docker.backend --watch\n', '1000'),
			'com.docker.backend'
		);
		assert.strictEqual(profile.parseProcessName('"ControlCenter" --some-flag\n', '1001'), 'ControlCenter');
	});

	test('treats empty POSIX lsof result as no listening ports', () => {
		const profile = getPortCommandProfile('darwin');

		assert.strictEqual(profile.isEmptyListeningResult({ code: 1, stdout: '' }), true);
		assert.strictEqual(profile.isEmptyListeningResult({ code: 1, stdout: 'something' }), false);
		assert.strictEqual(profile.isEmptyListeningResult({ code: 2, stdout: '' }), false);
	});

	test('parses Windows listening ports and filters non-listening rows', () => {
		const profile = getPortCommandProfile('win32');
		const stdout = [
			'  Proto  Local Address          Foreign Address        State           PID',
			'  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       50324',
			'  TCP    127.0.0.1:50100        127.0.0.1:8080         ESTABLISHED     83903',
			'  TCP    [::]:3000              [::]:0                 LISTENING       61000',
			'  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       50324'
		].join('\n');

		assert.deepStrictEqual(profile.parseListeningPorts(stdout), [
			{ command: 'Unknown', pid: '50324', port: '8080', type: 'TCP LISTENING' },
			{ command: 'Unknown', pid: '61000', port: '3000', type: 'TCP LISTENING' }
		]);
	});

	test('parses Windows ports from local address and ignores port zero placeholders', () => {
		const profile = getPortCommandProfile('win32');
		const stdout = [
			'  Proto  Local Address          Foreign Address        State           PID',
			'  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       1111',
			'  TCP    [::]:9229              [::]:0                 LISTENING       2222',
			'  TCP    0.0.0.0:0              0.0.0.0:0              LISTENING       3333'
		].join('\n');

		assert.deepStrictEqual(profile.parseListeningPorts(stdout), [
			{ command: 'Unknown', pid: '1111', port: '5173', type: 'TCP LISTENING' },
			{ command: 'Unknown', pid: '2222', port: '9229', type: 'TCP LISTENING' }
		]);
	});

	test('parses Windows all connections including UDP and non-listening TCP rows', () => {
		const profile = getPortCommandProfile('win32');
		const stdout = [
			'  Proto  Local Address          Foreign Address        State           PID',
			'  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       50324',
			'  TCP    127.0.0.1:50100        127.0.0.1:8080         ESTABLISHED     83903',
			'  UDP    0.0.0.0:5353           *:*                                    200',
			'  TCP    0.0.0.0:0              0.0.0.0:0              LISTENING       3333'
		].join('\n');

		assert.deepStrictEqual(profile.parseAllPorts(stdout), [
			{ command: 'Unknown', pid: '50324', port: '8080', type: 'TCP LISTENING' },
			{ command: 'Unknown', pid: '83903', port: '50100', type: 'TCP ESTABLISHED' },
			{ command: 'Unknown', pid: '200', port: '5353', type: 'UDP' }
		]);
	});

	test('parses Windows process names from tasklist CSV output', () => {
		const profile = getPortCommandProfile('win32');

		assert.strictEqual(
			profile.parseProcessName('"com.docker.backend.exe","12345","Console","1","10,000 K"\r\n', '12345'),
			'com.docker.backend.exe'
		);
		assert.strictEqual(profile.parseProcessName('INFO: No tasks are running which match the specified criteria.\r\n', '12345'), undefined);
	});

	test('parses Windows tasklist output into a PID process name map', () => {
		const profile = getPortCommandProfile('win32');
		const processNames = profile.parseProcessNameList?.([
			'"node.exe","1852","Console","1","22,948 K"',
			'"Code.exe","42988","Console","1","165,448 K"',
			'"Next AI Draw.io.exe","55364","Console","1","39,376 K"'
		].join('\r\n'));

		assert.strictEqual(processNames?.get('1852'), 'node.exe');
		assert.strictEqual(processNames?.get('42988'), 'Code.exe');
		assert.strictEqual(processNames?.get('55364'), 'Next AI Draw.io.exe');
	});

	test('parses Windows listening pids by exact local port', () => {
		const profile = getPortCommandProfile('win32');
		const stdout = [
			'  Proto  Local Address          Foreign Address        State           PID',
			'  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       50324',
			'  TCP    127.0.0.1:18080        0.0.0.0:0              LISTENING       70000',
			'  TCP    127.0.0.1:50100        127.0.0.1:8080         ESTABLISHED     83903',
			'  TCP    [::]:8080              [::]:0                 LISTENING       50324'
		].join('\n');

		assert.deepStrictEqual(profile.parseListeningPids(stdout, '8080'), ['50324']);
	});
});
