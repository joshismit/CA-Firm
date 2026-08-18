import { z } from 'zod';
import { searchQuerySchema } from '../schemas/search.schema';

export type SearchQueryDto = z.infer<typeof searchQuerySchema>;
