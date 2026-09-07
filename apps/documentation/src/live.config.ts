import { defineLiveCollection } from "astro:content";
import { z } from "astro/zod";
import { npmPowerupsLoader } from "./loaders/npm-powerups-loader";

/**
 * Live collection of npm packages tagged with the `powerups-package` keyword.
 * Data is fetched fresh from the npm registry search API at request time.
 */
const powerups = defineLiveCollection({
	loader: npmPowerupsLoader(),
	schema: z.object({
		name: z.string(),
		version: z.string(),
		description: z.string(),
		keywords: z.array(z.string()),
		license: z.string().nullable(),
		publisher: z.string(),
		date: z.string(),
    downloads: z.object({
      monthly: z.number(),
      weekly: z.number(),
    }),
		links: z.object({
			npm: z.url(),
			repository: z.string().nullable(),
			homepage: z.string().nullable(),
		}),
		searchScore: z.number(),
		score: z.object({
			final: z.number(),
			quality: z.number(),
			popularity: z.number(),
			maintenance: z.number(),
		}),
	}),
});

export const collections = { powerups };