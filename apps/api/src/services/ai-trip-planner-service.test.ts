import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiTripPlannerService, AiTripPlannerError } from './ai-trip-planner-service.js';

// ---------------------------------------------------------------------------
// Hoisted mutable env mock — mutate fields per-test as needed
// ---------------------------------------------------------------------------
const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    GOOGLE_AI_API_KEY: 'test-api-key' as string | undefined,
    AI_GATEWAY_API_KEY: undefined as string | undefined,
    GOOGLE_AI_MODEL: 'gemini-2.5-pro',
  };
  return { mockEnv };
});

vi.mock('../config/env.js', () => ({ env: mockEnv }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap inner plan JSON as a Gemini API response body string */
const geminiBody = (innerText: string) =>
  JSON.stringify({ candidates: [{ content: { parts: [{ text: innerText }] } }] });

const makeStop = (
  name: string,
  stopType: 'attraction' | 'pit_stop' | 'photo_op' | null = 'attraction',
) => ({ name, stopType });

/** Build a minimal valid plans object — rationale/stops cover scenic AND foodie keywords */
const validPlans = (count: 2 | 3 = 2) => ({
  options: Array.from({ length: count }, (_, i) => ({
    title: `Route ${i + 1}`,
    rationale: `Covers scenic viewpoints, local restaurants, and trail highlights for option ${i + 1}.`,
    stops: [makeStop(`Coastal Viewpoint ${i + 1}`), makeStop(`Ridge Trail ${i + 1}`)],
  })),
});

/** A plan option that intentionally has no theme keywords */
const bareOption = (i = 0) => ({
  title: `Route ${i}`,
  rationale: 'A balanced route.',
  stops: [makeStop('Place Alpha'), makeStop('Place Beta')],
});

/** Build a mock fetch that returns sequential responses */
const mockFetch = (
  ...responses: Array<{ ok: boolean; status?: number; body?: string }>
) => {
  let idx = 0;
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const r = responses[idx++] ?? { ok: false, status: 500, body: '{}' };
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      text: async () => r.body ?? '{}',
    } as Response;
  });
};

const ok = (body: string) => ({ ok: true, status: 200, body });
const notFound = () => ({ ok: false, status: 404, body: '{}' });
const serverError = () => ({ ok: false, status: 500, body: '{}' });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiTripPlannerService', () => {
  beforeEach(() => {
    // Reset env to defaults before each test
    mockEnv.GOOGLE_AI_API_KEY = 'test-api-key';
    mockEnv.AI_GATEWAY_API_KEY = undefined;
    mockEnv.GOOGLE_AI_MODEL = 'gemini-2.5-pro';
  });

  // -------------------------------------------------------------------------
  // generatePlans — happy path
  // -------------------------------------------------------------------------

  describe('generatePlans', () => {
    it('returns plans when primary request succeeds with theme coverage', async () => {
      const plans = validPlans(2);
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 150,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
      expect(result.options[0].title).toBe('Route 1');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('includes AI_GATEWAY_API_KEY as fallback when GOOGLE_AI_API_KEY is absent', async () => {
      mockEnv.GOOGLE_AI_API_KEY = undefined;
      mockEnv.AI_GATEWAY_API_KEY = 'gw-key';

      const plans = validPlans(2);
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 150,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
    });

    it('throws AI_KEY_NOT_CONFIGURED when no API key is available', async () => {
      mockEnv.GOOGLE_AI_API_KEY = undefined;
      mockEnv.AI_GATEWAY_API_KEY = undefined;

      const service = new AiTripPlannerService(vi.fn());

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 150,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({
        message: 'AI_KEY_NOT_CONFIGURED',
        stage: 'config',
      });
    });

    it('passes location, radiusKm, themes and maxOptions into the prompt', async () => {
      const plans = validPlans(3);
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      await service.generatePlans({
        location: 'Denver, CO',
        radiusKm: 200,
        themes: ['scenic', 'foodie'],
        maxOptions: 3,
      });

      const body = JSON.parse(
        String((fetch.mock.calls[0] as [URL, RequestInit])[1]?.body),
      ) as { contents: [{ parts: [{ text: string }] }] };
      const prompt = body.contents[0].parts[0].text;

      expect(prompt).toContain('Denver, CO');
      expect(prompt).toContain('200 km');
      expect(prompt).toContain('scenic, foodie');
      expect(prompt).toContain('exactly 3');
    });

    it('includes smart pitstops modifier in prompt when enabled', async () => {
      const plans = validPlans(2);
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
        modifiers: { smartPitstops: true },
      });

      const body = JSON.parse(
        String((fetch.mock.calls[0] as [URL, RequestInit])[1]?.body),
      ) as { contents: [{ parts: [{ text: string }] }] };

      expect(body.contents[0].parts[0].text).toContain('smart pitstops');
    });

    it('includes photo ops modifier in prompt when enabled', async () => {
      const plans = validPlans(2);
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
        modifiers: { photoOps: true },
      });

      const body = JSON.parse(
        String((fetch.mock.calls[0] as [URL, RequestInit])[1]?.body),
      ) as { contents: [{ parts: [{ text: string }] }] };

      expect(body.contents[0].parts[0].text).toContain('photo ops');
    });

    it('omits modifier section when no modifiers are provided', async () => {
      const plans = validPlans(2);
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      const body = JSON.parse(
        String((fetch.mock.calls[0] as [URL, RequestInit])[1]?.body),
      ) as { contents: [{ parts: [{ text: string }] }] };

      expect(body.contents[0].parts[0].text).not.toContain('Additional modifiers');
    });
  });

  // -------------------------------------------------------------------------
  // Response parsing
  // -------------------------------------------------------------------------

  describe('response parsing', () => {
    it('parses fenced JSON (```json ... ```) from the response', async () => {
      const plans = validPlans(2);
      const fenced = `\`\`\`json\n${JSON.stringify(plans)}\n\`\`\``;
      const fetch = mockFetch(ok(geminiBody(fenced)));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
    });

    it('parses fenced JSON (``` without language tag) from the response', async () => {
      const plans = validPlans(2);
      const fenced = `\`\`\`\n${JSON.stringify(plans)}\n\`\`\``;
      const fetch = mockFetch(ok(geminiBody(fenced)));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
    });

    it('extracts JSON embedded in prose text', async () => {
      const plans = validPlans(2);
      const withProse = `Here are your plans: ${JSON.stringify(plans)} Hope that helps!`;
      const fetch = mockFetch(ok(geminiBody(withProse)));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
    });

    it('throws AI_INVALID_RESPONSE (parse) when outer response body is not JSON', async () => {
      const fetch = mockFetch(ok('not json at all'));
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({
        message: 'AI_INVALID_RESPONSE',
        stage: 'parse',
      });
    });

    it('throws AI_INVALID_RESPONSE (parse) when candidates are missing', async () => {
      const fetch = mockFetch(ok(JSON.stringify({ candidates: [] })));
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({
        message: 'AI_INVALID_RESPONSE',
        stage: 'parse',
        details: { reason: 'missing_candidates' },
      });
    });

    it('throws AI_INVALID_RESPONSE (parse) when inner text is not valid JSON', async () => {
      const fetch = mockFetch(ok(geminiBody('{ invalid json }')));
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({
        message: 'AI_INVALID_RESPONSE',
        stage: 'parse',
      });
    });

    it('throws AI_INVALID_RESPONSE (parse) when schema validation fails — options missing', async () => {
      const fetch = mockFetch(ok(geminiBody(JSON.stringify({ options: [] }))));
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({ message: 'AI_INVALID_RESPONSE', stage: 'parse' });
    });

    it('throws AI_INVALID_RESPONSE (parse) when option stops array is too short', async () => {
      const badPlans = {
        options: [{ title: 'Route', rationale: 'Good', stops: [makeStop('Only one')] }],
      };
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(badPlans))));
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({ message: 'AI_INVALID_RESPONSE', stage: 'parse' });
    });

    it('fills in default rationale when option rationale is empty', async () => {
      const plans = {
        options: [
          {
            title: 'Scenic Loop',
            rationale: '',
            stops: [makeStop('Viewpoint Trail'), makeStop('River Gorge')],
          },
          {
            title: 'Coastal Run',
            rationale: '   ',
            stops: [makeStop('Beach Bay'), makeStop('Harbor Pier')],
          },
        ],
      };
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options[0].rationale).toBe(
        'A balanced route aligned to your selected themes.',
      );
      expect(result.options[1].rationale).toBe(
        'A balanced route aligned to your selected themes.',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Model fallback
  // -------------------------------------------------------------------------

  describe('model fallback', () => {
    it('falls back to v1beta when v1 returns 404', async () => {
      const plans = validPlans(2);
      const fetch = mockFetch(notFound(), ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to fallback model when primary model 404s on all api versions', async () => {
      mockEnv.GOOGLE_AI_MODEL = 'gemini-primary';
      const plans = validPlans(2);
      // v1 → 404, v1beta → 404, fallback v1 → success
      const fetch = mockFetch(
        notFound(),
        notFound(),
        ok(geminiBody(JSON.stringify(plans))),
      );
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('stops fallback immediately on non-404 error and throws AI_REQUEST_FAILED', async () => {
      const fetch = mockFetch(serverError());
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({ message: 'AI_REQUEST_FAILED', stage: 'request' });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('throws AI_REQUEST_FAILED when all fallback attempts return 404', async () => {
      mockEnv.GOOGLE_AI_MODEL = 'gemini-primary';
      // v1 → 404, v1beta → 404, fallback v1 → 404, fallback v1beta → 404
      const fetch = mockFetch(notFound(), notFound(), notFound(), notFound());
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({ message: 'AI_REQUEST_FAILED', stage: 'request' });
    });

    it('wraps network errors as AI_REQUEST_FAILED', async () => {
      const fetch = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('connection refused'));
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({ message: 'AI_REQUEST_FAILED', stage: 'request' });
    });
  });

  // -------------------------------------------------------------------------
  // Theme coverage retry logic
  // -------------------------------------------------------------------------

  describe('theme coverage', () => {
    it('returns primary result immediately when theme coverage passes', async () => {
      const plans = validPlans(2); // stops include "Viewpoint" and "Trail" → scenic covered
      const fetch = mockFetch(ok(geminiBody(JSON.stringify(plans))));
      const service = new AiTripPlannerService(fetch);

      await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries when primary response fails theme coverage and returns retry result', async () => {
      const failingPlans = { options: [bareOption(1), bareOption(2)] };
      const passingPlans = validPlans(2);
      const fetch = mockFetch(
        ok(geminiBody(JSON.stringify(failingPlans))),
        ok(geminiBody(JSON.stringify(passingPlans))),
      );
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('includes correction message in retry prompt', async () => {
      const failingPlans = { options: [bareOption(1), bareOption(2)] };
      const passingPlans = validPlans(2);
      const fetch = mockFetch(
        ok(geminiBody(JSON.stringify(failingPlans))),
        ok(geminiBody(JSON.stringify(passingPlans))),
      );
      const service = new AiTripPlannerService(fetch);

      await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      const retryBody = JSON.parse(
        String((fetch.mock.calls[1] as [URL, RequestInit])[1]?.body),
      ) as { contents: [{ parts: [{ text: string }] }] };

      expect(retryBody.contents[0].parts[0].text).toContain(
        'Correction required: the prior result did not satisfy all selected themes',
      );
    });

    it('returns only passing options when retry partially covers themes', async () => {
      const failingPlans = { options: [bareOption(1), bareOption(2)] };
      // Second attempt: one option passes (has "viewpoint"), one does not
      const partialPlans = {
        options: [
          {
            title: 'Route 1',
            rationale: 'Great viewpoint.',
            stops: [makeStop('Viewpoint Trail'), makeStop('Lake Path')],
          },
          bareOption(2),
        ],
      };
      const fetch = mockFetch(
        ok(geminiBody(JSON.stringify(failingPlans))),
        ok(geminiBody(JSON.stringify(partialPlans))),
      );
      const service = new AiTripPlannerService(fetch);

      const result = await service.generatePlans({
        location: 'Portland, OR',
        radiusKm: 100,
        themes: ['scenic'],
        maxOptions: 2,
      });

      expect(result.options).toHaveLength(1);
      expect(result.options[0].title).toBe('Route 1');
    });

    it('throws AI_INVALID_RESPONSE when no options pass theme coverage after retry', async () => {
      const failingPlans = { options: [bareOption(1), bareOption(2)] };
      const fetch = mockFetch(
        ok(geminiBody(JSON.stringify(failingPlans))),
        ok(geminiBody(JSON.stringify(failingPlans))),
      );
      const service = new AiTripPlannerService(fetch);

      await expect(
        service.generatePlans({
          location: 'Portland, OR',
          radiusKm: 100,
          themes: ['scenic'],
          maxOptions: 2,
        }),
      ).rejects.toMatchObject({
        message: 'AI_INVALID_RESPONSE',
        stage: 'parse',
        details: { reason: 'theme_coverage_failed' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // AiTripPlannerError
  // -------------------------------------------------------------------------

  describe('AiTripPlannerError', () => {
    it('exposes code, stage, and details', () => {
      const err = new AiTripPlannerError('MY_CODE', 'request', { foo: 'bar' });

      expect(err.message).toBe('MY_CODE');
      expect(err.stage).toBe('request');
      expect(err.details).toEqual({ foo: 'bar' });
      expect(err.name).toBe('AiTripPlannerError');
    });

    it('defaults details to empty object', () => {
      const err = new AiTripPlannerError('MY_CODE', 'config');
      expect(err.details).toEqual({});
    });

    it('is instanceof Error', () => {
      const err = new AiTripPlannerError('X', 'parse');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
