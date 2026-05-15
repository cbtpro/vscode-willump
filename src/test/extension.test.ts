import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// Mock minimal vscode API for unit tests
const vscode = { window: { showInformationMessage: () => {} } } as any;
// import * as myExtension from '../../extension';

if (typeof describe === 'function') {
	describe('Extension Test Suite', () => {
		vscode.window.showInformationMessage('Start all tests.');

		test('Sample test', () => {
			assert.strictEqual(-1, [1, 2, 3].indexOf(5));
			assert.strictEqual(-1, [1, 2, 3].indexOf(0));
		});
	});
}
