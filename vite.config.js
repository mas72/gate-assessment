import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function stubNodeBuiltins() {
  const stubs = new Set(['node:fs', 'fs', 'node:path', 'path', 'node:url', 'url']);
  return {
    name: 'stub-node-builtins',
    enforce: 'pre',
    resolveId(id) {
      if (stubs.has(id)) return `\0stub:${id}`;
    },
    load(id) {
      if (!id.startsWith('\0stub:')) return null;
      return `
        export function readFileSync() { return ''; }
        export function dirname() { return ''; }
        export function join() { return ''; }
        export function fileURLToPath() { return ''; }
        export default {};
      `;
    },
  };
}

export default defineConfig({
  plugins: [react(), stubNodeBuiltins()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
