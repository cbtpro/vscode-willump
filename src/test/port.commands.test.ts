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
		assert.deepStrictEqual(profile.killPid('12345'), {
			type: 'file',
			file: 'taskkill',
			args: ['/PID', '12345', '/F']
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
			{ command: 'java', pid: '50324', port: '8080' },
			{ command: 'node', pid: '61000', port: '3000' }
		]);
	});

	test('parses POSIX listening pids and removes duplicates or invalid values', () => {
		const profile = getPortCommandProfile('linux');

		assert.deepStrictEqual(profile.parseListeningPids('50324\n83903\n50324\nnot-a-pid\n', '8080'), ['50324', '83903']);
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
			{ command: 'Unknown', pid: '50324', port: '8080' },
			{ command: 'Unknown', pid: '61000', port: '3000' }
		]);
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
