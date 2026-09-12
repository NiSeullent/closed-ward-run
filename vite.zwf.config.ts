import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { readFileSync } from 'node:fs';

const audioDataUrl = (name: string) =>
  `data:audio/mpeg;base64,${readFileSync(new URL(`./public/audio/${name}`, import.meta.url)).toString('base64')}`;

export default defineConfig({
  base: './',
  define: {
    __ZUKU_RUNTIME__: true,
    __ZWF_AUDIO_SONG1__: JSON.stringify(audioDataUrl('song1.mp3')),
    __ZWF_AUDIO_CLOSED_RUN__: JSON.stringify(
      audioDataUrl('closed-run-bgm.mp3'),
    ),
  },
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'dist/zwf-web', emptyOutDir: true },
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
});
