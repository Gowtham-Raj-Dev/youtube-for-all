import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Relative base: index.html sets a <base href> at runtime, so one build works both at
// https://utubeflow.codelove.in/ and at https://<user>.github.io/youtube-for-all/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
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
