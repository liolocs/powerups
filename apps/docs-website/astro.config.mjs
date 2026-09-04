// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import cloudflare from '@astrojs/cloudflare';
import lucode from 'lucode-starlight';

const site = process.env.NODE_ENV === "production" ? "https://powerups.dev" : "http://localhost:4321"

// https://astro.build/config
export default defineConfig({
  site,

	// Cloudflare Workers adapter — docs pages stay prerendered (static),
	// powerups pages opt into on-demand rendering with `export const prerender = false`.
	adapter: cloudflare({
		prerenderEnvironment: 'node',
		imageService: 'compile',
	}),

	integrations: [
		starlight({
      title: 'powerups.dev',
			description:
				'Guardrails for AI output — reusable powerups your AI agent can use instead of inventing code from scratch.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/liolocs/powerups' }],
      customCss: ['./src/styles/custom.css'],
			plugins: [
				lucode({
					navLinks: [
						{ label: 'Guides', link: '/guides/install/' },
						{ label: 'Reference', link: '/reference/cli/build/' },
						{ label: 'Powerups', link: '/powerups/' },
					],
          footerText: 'Powerups is released under the [MIT License](https://github.com/liolocs/powerups/blob/main/LICENSE).',
				}),
			],
			sidebar: [
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'CLI', items: [{ autogenerate: { directory: 'reference/cli' } }] },
						{ slug: 'reference/sdk' },
					],
				},
			],
		}),
	],
});
