const assert = require('node:assert/strict');
const vscode = require('vscode');

suite('Act Visual Runner extension', () => {
  test('activates and registers its core commands', async () => {
    const extension = vscode.extensions.getExtension('fean-developer.act-visual-runner');

    assert.ok(extension, 'Expected the extension to be available in the Extension Host');

    await extension.activate();
    assert.equal(extension.isActive, true);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('actRunner.showMenu'));
    assert.ok(commands.includes('actRunner.runWorkflow'));
    assert.ok(commands.includes('actRunner.validateWorkflow'));
  });
});
