import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths so GitHub Pages project sites work under /repo-name/
  base: "./",
  server: {
    port: 5173,
    open: true,
  },
});
