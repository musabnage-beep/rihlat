import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
