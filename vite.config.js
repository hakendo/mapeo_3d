import { defineConfig } from 'vite';

// Visor estático embebible. base relativa para poder servirlo desde cualquier
// subruta o CDN (Cloudflare Pages / Netlify / Vercel) sin reconfigurar.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
