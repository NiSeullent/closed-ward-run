import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
export default defineConfig({base:'/closed-ward-run/',plugins:[react()],css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:'docs',emptyOutDir:true},resolve:{alias:{'@':new URL('.',import.meta.url).pathname}}});
