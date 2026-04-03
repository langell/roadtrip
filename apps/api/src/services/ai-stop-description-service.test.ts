import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiStopDescriptionService } from './ai-stop-description-service.js';

const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    GOOGLE_AI_API_KEY: 'test-key' as string | undefined,
    AI_GATEWAY_API_KEY: undefined as string | undefined,
    GOOGLE_AI_MODEL: 'gemini-2.5-flash',
  };
  return { mockEnv };
});

vi.mock('../config/env.js', () => ({ env: mockEnv }));

beforeEach(() => {
  mockEnv.GOOGLE_AI_API_KEY = 'test-key';
  mockEnv.AI_GATEWAY_API_KEY = undefined;
  mockEnv.GOOGLE_AI_MODEL = 'gemini-2.5-flash';
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
});
