import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { PluginOption } from 'vite';

const disableWorkerOptimization = (): PluginOption => ({
  name: 'disable-worker-optimization',
  config: () => ({
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  })
});

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  worker: {
    format: 'es',
    plugins: [disableWorkerOptimization()]
  }
});
