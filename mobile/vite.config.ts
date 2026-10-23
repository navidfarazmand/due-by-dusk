import { defineConfig } from 'vite';
export default defineConfig({ base:'./', publicDir:'public', server:{host:'127.0.0.1',port:5173}, build:{outDir:'dist',sourcemap:false,assetsInlineLimit:0} });
