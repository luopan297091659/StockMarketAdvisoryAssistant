import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: { strictPort: true },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/echarts") || id.includes("node_modules/zrender")) return "charts";
          if (id.includes("node_modules/vue") || id.includes("node_modules/pinia")) return "framework";
          return undefined;
        },
      },
    },
  },
});
