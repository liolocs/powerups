// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
      title: 'powerup agents',
			description:
				'Guardrails for AI output — reusable powerups your AI agent can use instead of inventing code from scratch.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/liolocs/powerups' }],
			plugins: [
				lucode({
					navLinks: [
						{ label: 'Guides', link: '/guides/install/' },
						{ label: 'Reference', link: '/reference/cli/build/' },
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
