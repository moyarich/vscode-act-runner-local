import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node18',
    sourcemap: 'hidden',
    minify: false,
    lib: {
      entry: 'src/extension.ts',
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: ['vscode'],
      output: {
        exports: 'named',
        entryFileNames: 'extension.js',
      },
    },
  },
});
