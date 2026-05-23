import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: false }),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      '@guess/game-engine': resolve(projectRoot, 'packages/game-engine/src/index.ts'),
    }
  },
  build: {
    // H.4 — emit hidden sourcemaps so /scripts/upload-sourcemaps.ts can ship
    // them to R2 (and out of the public dist) for admin-side stack resolution.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
});
