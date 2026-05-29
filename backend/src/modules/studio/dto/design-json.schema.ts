import { z } from 'zod';

export const designJsonSchema = z.object({
  version: z.string().optional(),
  width: z.number().min(1),
  height: z.number().min(1),
  backgroundColor: z.string().optional(),
  elements: z
    .array(
      z
        .object({
          id: z.string(),
          type: z.enum(['text', 'image', 'shape', 'group']),
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
          rotation: z.number().optional(),
          opacity: z.number().min(0).max(1).optional(),
          content: z.any().optional(), // Specific data based on type
        })
        .passthrough(),
    )
    .default([]),
});
