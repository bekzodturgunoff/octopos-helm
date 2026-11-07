import path from "path";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {tanstackRouter} from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
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
