# Roadtrip — Claude Instructions

## Repo structure

```
apps/api/     Express API server (Node.js, standalone — NOT Vercel Functions)
apps/web/     Next.js 15 web app (App Router)
apps/mobile/  React Native mobile app
packages/     Shared types, UI components
```

Run commands:

- `pnpm dev:api` / `pnpm dev:web` — start individual apps
- `pnpm --filter @roadtrip/api test` — API tests
- `pnpm --filter @roadtrip/web build` — web build check
- `pnpm lint` — lint all packages

Always read `stories/RANKING.md` before picking up new work.

---

## Adding an API endpoint (`apps/api`)

The API is a plain Express server in `apps/api/src/server.ts`. All routes live there or under `apps/api/src/routes/`.

**Pattern — every endpoint follows this shape:**

```typescript
app.post(
  '/my-endpoint',
  requireAuth, // omit for public endpoints; adds res.locals.userId
  withAsyncHandler(async (req, res) => {
    const requestLogger = getRequestLogger(res);

    // 1. Validate input with Zod
    const schema = z.object({ field: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }
    const input = parsed.data;

    // 2. Call service / DB
    try {
      const result = await someService.doThing(input);
      res.status(200).json(result);
    } catch (error) {
      logError(requestLogger, 'my-endpoint.failure', error, { input });
      res.status(502).json({ error: 'UPSTREAM_ERROR' });
    }
  }),
);
```

**Key helpers:**

- `withAsyncHandler(fn)` — wraps async handlers to prevent unhandled rejections
- `requireAuth` middleware — rejects 401 if no valid token; sets `res.locals.userId`
- `getRequestLogger(res)` — returns a pino child logger with the request ID
- `logError(logger, msg, error, meta)` — logs structured error with stack
- `getRequestUserId(req)` — lower-level auth helper if you need userId without blocking

**Adding env vars:**

1. Add to `apps/api/src/config/env.ts` (Zod schema, `z.string().min(1).optional()`)
2. Add to `apps/api/vitest.setup.ts` with a test default
3. Access everywhere as `env.MY_VAR`

---

## Adding an AI feature (`apps/api`)

The AI service lives at `apps/api/src/services/ai-trip-planner-service.ts`. For new AI features, follow the same service class pattern.

**For structured extraction (invisible AI):**

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';

const mySchema = z.object({
  field: z.string().describe('Clear instruction for the model'),
  score: z.number().nullable().describe('0-10 rating, or null if unknown'),
});

export async function extractSomething(input: string) {
  const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error('AI_KEY_NOT_CONFIGURED');

  const { output } = await generateText({
    model: env.GOOGLE_AI_MODEL, // defaults to gemini-2.5-flash
    prompt: `Extract details from: "${input}"`,
    output: Output.object({ schema: mySchema }),
  });

  return output;
}
```

**Model in this project:** Gemini via `env.GOOGLE_AI_MODEL` (configured in env). Don't hardcode model strings.

**Always:**

- Use `nullable()` not `optional()` for fields that might be absent — LLMs handle it better
- Add `.describe()` to every Zod field — it guides the model
- Include relevant context in descriptions (e.g., today's date for date fields)
- Handle `AI_KEY_NOT_CONFIGURED` before calling the API

**For retries / theme coverage:** see `AiTripPlannerService.generatePlans()` — it has the retry + degraded fallback pattern.

---

## Adding a web API client method (`apps/web`)

Web API calls live in `apps/web/lib/api-client.ts`.

```typescript
export type MyResponse = {
  result: string;
};

export const callMyEndpoint = async (params: {
  field: string;
}): Promise<MyResponse | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/my-endpoint`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await buildAuthHeaders()), // attaches Bearer token if logged in
      },
      body: JSON.stringify(params),
      cache: 'no-store',
    });

    if (response.status === 401) {
      // handle auth required — return null or a typed auth-required result
      return null;
    }

    if (!response.ok) return null;
    return (await response.json()) as MyResponse;
  } catch {
    return null;
  }
};
```

**Auth flows automatically** — `buildAuthHeaders()` fetches a short-lived JWT from `/api/auth/api-token` (NextAuth session → JWT). No manual token handling needed.

---

## Adding a Next.js web feature (`apps/web`)

- App Router, Server Components by default. Add `'use client'` only when you need interactivity or browser APIs.
- Route Handlers live under `apps/web/app/api/`.
- Use `apps/web/lib/api-client.ts` for all calls to `apps/api`.
- Location autocomplete: reuse `GooglePlacesAutocomplete` component. Pass `locationBias` to scope results geographically.
- Draft state between pages: use `localStorage` (not `sessionStorage` — survives tab close).

**UI tokens** — always use `wayfarer-*` Tailwind tokens, never raw colors:

- `wayfarer-primary` — main brand green
- `wayfarer-secondary` — accent
- `wayfarer-bg` / `wayfarer-surface` / `wayfarer-surface-deep` — backgrounds
- `wayfarer-text-main` / `wayfarer-text-muted` — text
- `font-display` for headings, `font-body` for everything else
- `rounded-card`, `shadow-wayfarer-soft`, `shadow-wayfarer-ambient` for cards

---

## Writing tests

Tests use Vitest. Run with `pnpm --filter @roadtrip/api test`.

**Mocking `env` (the most common pattern):**

```typescript
const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    GOOGLE_AI_API_KEY: 'test-key' as string | undefined,
    GOOGLE_AI_MODEL: 'gemini-2.5-flash',
  };
  return { mockEnv };
});

vi.mock('../config/env.js', () => ({ env: mockEnv }));

beforeEach(() => {
  mockEnv.GOOGLE_AI_API_KEY = 'test-key'; // reset to defaults
});
```

**Mocking fetch:**

```typescript
const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
  ok: true,
  json: async () => ({ result: 'value' }),
} as Response);

const service = new MyService(fetchMock);
```

**Test file location:** same directory as the source file, `*.test.ts` suffix.

**Coverage thresholds:** 80% statements/branches/functions/lines globally. Services should be 95%+.

**When adding a new service or endpoint, always add tests.** Critical paths require:

- Happy path
- Input validation / missing fields
- Upstream error handling
- Auth gating (if applicable)
