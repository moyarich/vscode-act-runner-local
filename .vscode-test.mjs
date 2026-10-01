import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'test/integration/**/*.test.js',
  version: process.env.VSCODE_VERSION || 'stable',
  workspaceFolder: '.',
  mocha: {
    ui: 'tdd',
    timeout: 30_000,
  },
  launchArgs: [
    '--disable-extensions',
    '--disable-gpu',
    '--disable-workspace-trust',
  ],
  extensionDevelopmentPath: '.',
});
