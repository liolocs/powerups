// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig, envField } from "astro/config"
import react from "@astrojs/react"

import mdx from "@astrojs/mdx";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), mdx()],

  env: {
    schema: {
      GITHUB_REPO_URL: envField.string({ context: "client", access: "public", default: "https://github.com/liolocs/powerups" })
    }
  },

  adapter: cloudflare()
})