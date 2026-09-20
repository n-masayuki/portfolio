import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const works = defineCollection({
  loader: glob({
    base: './src/content/works',
    pattern: '*.md',
  }),
  schema: ({ image }) =>
    z.object({
      order: z.number(),
      title: z.string(),
      category: z.array(z.string()),
      period: z.string(),
      thumbnail: image().optional(),
      url: z.string().optional(),
      role: z.array(z.string()),
      technologies: z.array(z.string()),
    }),
});

export const collections = { works };
