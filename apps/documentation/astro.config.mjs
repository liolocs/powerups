// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig, envField } from "astro/config"
import pagefind from "astro-pagefind";
import react from "@astrojs/react"
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },

  integrations: [react(), mdx(), pagefind()],

  env: {
    schema: {
      GITHUB_REPO_URL: envField.string({ context: "client", access: "public", default: "https://github.com/liolocs/powerups" })
    }
  },

  adapter: cloudflare(),
  cache: { provider: cacheCloudflare() },
})