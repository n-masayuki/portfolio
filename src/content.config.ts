import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const works = defineCollection({
  loader: glob({
    base: './src/content/works',
    pattern: '*.md',
  }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    category: z.string(),
    period: z.string(),
    role: z.array(z.string()),
    technologies: z.array(z.string()),
  }),
});

export const collections = { works };