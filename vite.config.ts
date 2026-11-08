import path from "path";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {tanstackRouter} from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // GitHub Pages serves the app from /octopos-helm/; locally and on a real domain it is /.
  // The Pages workflow sets BASE_PATH, everything else leaves it alone.
  base: process.env.BASE_PATH || "/",
  server: {
    // The dash takes 5173; running both side by side is the normal way to work on a client.
    port: 5180,
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
