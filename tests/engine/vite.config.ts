import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { readFileSync } from 'node:fs';
export default defineConfig({
  root: new URL('../..', import.meta.url).pathname,
  server: {
    host: '127.0.0.1',
    port: 35174,
    cors: true,
    proxy: { '/api/v1': 'http://127.0.0.1:35439' },
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [
    react(),
    {
      name: 'engine-audit-only',
      enforce: 'pre',
      transform(source, id) {
        if (!id.endsWith('/app/runner.ts')) return;
        source=source.replace('antialias: true,','antialias: true, preserveDrawingBuffer:true,');
        const marker = '  return {\n    start,\n';
        if (!source.includes(marker))
          throw new Error('Engine probe insertion point changed');
        return source.replace(
          marker,
          readFileSync(new URL('./probe.txt', import.meta.url), 'utf8') +
            '\n' +
            marker,
        );
      },
    },
  ],
});
