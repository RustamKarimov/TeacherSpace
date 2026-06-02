import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
          if (id.includes("katex")) return "vendor-katex";
          if (id.includes("lucide-react") || id.includes("@floating-ui")) return "vendor-ui";
          return "vendor";
        }
      }
    }
  }
});
