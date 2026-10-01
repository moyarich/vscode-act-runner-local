import { defineConfig } from 'vite';

export default defineConfig({
  // The extension runs in VS Code's Node.js extension host, not a browser.
  // SSR mode gives Vite Node resolution semantics while Rollup still emits
  // the CommonJS bundle expected by package.json's "main" entry.
  build: {
    ssr: 'src/extension.ts',
    target: 'node18',
    sourcemap: 'hidden',
    minify: false,
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      // VS Code provides this module at runtime.
      external: ['vscode'],
      output: {
        format: 'cjs',
        exports: 'named',
        entryFileNames: 'extension.js',
      },
    },
  },
  // Webpack currently bundles npm dependencies into extension.js.
  // Keep that behavior so the Vite output is a drop-in parallel build.
  ssr: {
    noExternal: true,
  },
});
