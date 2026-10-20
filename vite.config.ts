import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served from the root of https://utubeflow.codelove.in (GitHub Pages custom domain), so base stays "/".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("node_modules/@firebase") || id.includes("node_modules/firebase")
            ? "firebase"
            : id.includes("node_modules")
              ? "vendor"
              : undefined,
      },
    },
  },
});
