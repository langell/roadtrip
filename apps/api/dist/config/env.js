import { z } from 'zod';
const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
});
export const env = schema.parse(process.env);
