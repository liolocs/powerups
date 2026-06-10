import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import wails from "@wailsio/runtime/plugins/vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true
  },

  plugins: [tailwindcss(), svelte(), wails("./bindings")],

  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    }
  }
});
