import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiStopDescriptionService } from './ai-stop-description-service.js';

const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    GOOGLE_AI_API_KEY: 'test-key' as string | undefined,
    AI_GATEWAY_API_KEY: undefined as string | undefined,
    GOOGLE_AI_MODEL: 'gemini-2.5-flash',
    GOOGLE_AI_MODEL_FAST: 'gemini-2.0-flash' as string | undefined,
  };
  return { mockEnv };
});

vi.mock('../config/env.js', () => ({ env: mockEnv }));

beforeEach(() => {
  mockEnv.GOOGLE_AI_API_KEY = 'test-key';
  mockEnv.AI_GATEWAY_API_KEY = undefined;
  mockEnv.GOOGLE_AI_MODEL = 'gemini-2.5-flash';
  mockEnv.GOOGLE_AI_MODEL_FAST = 'gemini-2.0-flash';
});

const geminiBody = (innerText: string) =>
  JSON.stringify({ candidates: [{ content: { parts: [{ text: innerText }] } }] });

const ok = (body: string) =>
  ({ ok: true, status: 200, text: async () => body }) as Response;

const fail = (status: number) =>
  ({ ok: false, status, text: async () => '{}' }) as Response;

const validResponse = (stops: Array<{ name: string; description: string }>) =>
  geminiBody(JSON.stringify({ stops }));

describe('AiStopDescriptionService', () => {
  describe('generateDescriptions', () => {
    it('returns a name→description map for each stop', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        ok(
          validResponse([
            {
              name: 'Bixby Bridge',
              description: 'A soaring concrete arch spans a rocky canyon.',
            },
            {
              name: 'Point Lobos',
              description: 'Twisted cypress trees frame the Pacific.',
            },
          ]),
        ),
      );
      const service = new AiStopDescriptionService(fetch);

      const result = await service.generateDescriptions({
        stops: ['Bixby Bridge', 'Point Lobos'],
        location: 'Carmel, CA',
        themes: ['scenic'],
      });

      expect(result['Bixby Bridge']).toBe(
        'A soaring concrete arch spans a rocky canyon.',
      );
      expect(result['Point Lobos']).toBe('Twisted cypress trees frame the Pacific.');
    });

    it('includes stop names and location in the prompt', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          ok(validResponse([{ name: 'Bixby Bridge', description: 'A stunning stop.' }])),
        );
      const service = new AiStopDescriptionService(fetch);

      await service.generateDescriptions({
        stops: ['Bixby Bridge'],
        location: 'Carmel, CA',
        themes: ['scenic', 'foodie'],
      });

      const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      const prompt = body.contents[0].parts[0].text;
      expect(prompt).toContain('Bixby Bridge');
      expect(prompt).toContain('Carmel, CA');
      expect(prompt).toContain('scenic, foodie');
    });

    it('throws AI_KEY_NOT_CONFIGURED when no API key is set', async () => {
      mockEnv.GOOGLE_AI_API_KEY = undefined;
      mockEnv.AI_GATEWAY_API_KEY = undefined;
      const service = new AiStopDescriptionService(vi.fn());

      await expect(
        service.generateDescriptions({
          stops: ['Stop'],
          location: 'City',
          themes: ['scenic'],
        }),
      ).rejects.toMatchObject({ message: 'AI_KEY_NOT_CONFIGURED', stage: 'config' });
    });

    it('throws AI_INVALID_RESPONSE when JSON is malformed', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(ok(geminiBody('not json at all')));
      const service = new AiStopDescriptionService(fetch);

      await expect(
        service.generateDescriptions({
          stops: ['Stop'],
          location: 'City',
          themes: ['scenic'],
        }),
      ).rejects.toMatchObject({ message: 'AI_INVALID_RESPONSE', stage: 'parse' });
    });

    it('throws AI_INVALID_RESPONSE when schema validation fails', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          ok(geminiBody(JSON.stringify({ stops: [{ name: '', description: '' }] }))),
        );
      const service = new AiStopDescriptionService(fetch);

      await expect(
        service.generateDescriptions({
          stops: ['Stop'],
          location: 'City',
          themes: ['scenic'],
        }),
      ).rejects.toMatchObject({ message: 'AI_INVALID_RESPONSE', stage: 'parse' });
    });

    it('falls back to v1beta when v1 returns 404', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(fail(404))
        .mockResolvedValueOnce(
          ok(validResponse([{ name: 'Stop', description: 'Fallback worked.' }])),
        );
      const service = new AiStopDescriptionService(fetch);

      const result = await service.generateDescriptions({
        stops: ['Stop'],
        location: 'City',
        themes: ['scenic'],
      });

      expect(result['Stop']).toBe('Fallback worked.');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('throws AI_REQUEST_FAILED on non-404 error', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(fail(500));
      const service = new AiStopDescriptionService(fetch);

      await expect(
        service.generateDescriptions({
          stops: ['Stop'],
          location: 'City',
          themes: ['scenic'],
        }),
      ).rejects.toMatchObject({ message: 'AI_REQUEST_FAILED', stage: 'request' });
    });

    it('uses AI_GATEWAY_API_KEY when GOOGLE_AI_API_KEY is absent', async () => {
      mockEnv.GOOGLE_AI_API_KEY = undefined;
      mockEnv.AI_GATEWAY_API_KEY = 'gateway-key';

      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          ok(validResponse([{ name: 'Stop', description: 'Gateway description.' }])),
        );
      const service = new AiStopDescriptionService(fetch);

      const result = await service.generateDescriptions({
        stops: ['Stop'],
        location: 'City',
        themes: ['scenic'],
      });

      expect(result['Stop']).toBe('Gateway description.');
      const url = fetch.mock.calls[0][0] as string;
      expect(url).toContain('gateway-key');
    });
  });

  describe('generateDiscoverDescriptions', () => {
    const stops = [
      { placeId: 'p1', title: 'Bixby Bridge', description: 'A coastal bridge.' },
      { placeId: 'p2', title: 'Point Lobos', description: 'A rocky headland.' },
    ];

    it('returns placeId→description map', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        ok(
          validResponse([
            { name: 'Bixby Bridge', description: 'A soaring arch over the sea.' },
            { name: 'Point Lobos', description: 'Twisted cypress frames the Pacific.' },
          ]),
        ),
      );
      const service = new AiStopDescriptionService(fetch);

      const result = await service.generateDiscoverDescriptions(stops);

      expect(result['p1']).toBe('A soaring arch over the sea.');
      expect(result['p2']).toBe('Twisted cypress frames the Pacific.');
    });

    it('serves cached results without calling the API again', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        ok(
          validResponse([
            { name: 'Bixby Bridge', description: 'Cached description.' },
            { name: 'Point Lobos', description: 'Also cached.' },
          ]),
        ),
      );
      const service = new AiStopDescriptionService(fetch);

      await service.generateDiscoverDescriptions(stops);
      await service.generateDiscoverDescriptions(stops);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after cache is cleared', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          ok(validResponse([{ name: 'Bixby Bridge', description: 'Fresh.' }])),
        );
      const service = new AiStopDescriptionService(fetch);

      await service.generateDiscoverDescriptions([stops[0]]);
      service.clearDiscoverCache();
      await service.generateDiscoverDescriptions([stops[0]]);

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('uses GOOGLE_AI_MODEL_FAST for the request', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(
          ok(validResponse([{ name: 'Bixby Bridge', description: 'Fast model used.' }])),
        );
      const service = new AiStopDescriptionService(fetch);

      await service.generateDiscoverDescriptions([stops[0]]);

      const url = fetch.mock.calls[0][0] as string;
      expect(url).toContain('gemini-2.0-flash');
    });

    it('throws AI_KEY_NOT_CONFIGURED when no API key is set', async () => {
      mockEnv.GOOGLE_AI_API_KEY = undefined;
      mockEnv.AI_GATEWAY_API_KEY = undefined;
      const service = new AiStopDescriptionService(vi.fn());

      await expect(service.generateDiscoverDescriptions(stops)).rejects.toMatchObject({
        message: 'AI_KEY_NOT_CONFIGURED',
        stage: 'config',
      });
    });

    it('throws AI_INVALID_RESPONSE on malformed JSON', async () => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(ok(geminiBody('not json')));
      const service = new AiStopDescriptionService(fetch);

      await expect(
        service.generateDiscoverDescriptions([stops[0]]),
      ).rejects.toMatchObject({
        message: 'AI_INVALID_RESPONSE',
        stage: 'parse',
      });
    });

    it('returns empty object when input is empty', async () => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      const service = new AiStopDescriptionService(fetch);

      const result = await service.generateDiscoverDescriptions([]);

      expect(result).toEqual({});
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
