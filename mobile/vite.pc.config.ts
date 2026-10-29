// One-file build for playing on a computer: every image, font and sound is inlined, and the
// optional rewarded ads are replaced by labelled test ads (there is no ad network in a browser).
// Run: npm run build:pc, then node scripts/inline-html.mjs dist-pc Due-by-Dusk.html
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(
  base,
  defineConfig({
    define: { 'import.meta.env.VITE_TEST_ADS': JSON.stringify('true') },
    build: {
      outDir: 'dist-pc',
      assetsInlineLimit: () => true,
      chunkSizeWarningLimit: 20000,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
);
