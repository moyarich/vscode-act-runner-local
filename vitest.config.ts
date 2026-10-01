import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      vscode: resolve(__dirname, 'src/__mocks__/vscode.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
