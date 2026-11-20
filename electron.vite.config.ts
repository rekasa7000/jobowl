import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

const alias = { '@shared': resolve('src/shared') };

// The renderer's CSP is strict in production. The dev server needs inline
// scripts and a websocket for hot reload, so relax it only while serving.
function devCsp(): Plugin {
  return {
    name: 'jobowl:dev-csp',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:* http://localhost:*; object-src 'none'; frame-src 'none'" />`,
      ),
  };
}

export default defineConfig({
  main: { resolve: { alias } },
  // Sandboxed preload scripts must be CommonJS and can't require() packages, so zod is bundled in.
  preload: {
    resolve: { alias },
    build: {
      externalizeDeps: { exclude: ['zod'] },
      rolldownOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias: { ...alias, '@renderer': resolve('src/renderer') } },
    plugins: [react(), tailwindcss(), devCsp()],
    build: { rolldownOptions: { input: resolve('src/renderer/index.html') } },
  },
});
