import { z } from 'zod';
import { env } from '../config/env.js';

const StopDescriptionSchema = z.object({
  name: z.string().min(1).describe('Exact stop name as provided'),
  description: z.string().min(1).describe('2-3 sentence travel narrative for this stop'),
});

const StopDescriptionsSchema = z.object({
  stops: z.array(StopDescriptionSchema),
});

type StopDescriptions = Record<string, string>;

type PlannerStage = 'config' | 'request' | 'parse';

export class AiStopDescriptionError extends Error {
  readonly stage: PlannerStage;
  constructor(code: string, stage: PlannerStage) {
    super(code);
    this.name = 'AiStopDescriptionError';
    this.stage = stage;
  }
}

export type { StopDescriptions };

export class AiStopDescriptionService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async generateDescriptions(input: {
    stops: string[];
    location: string;
    themes: string[];
  }): Promise<StopDescriptions> {
    const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      throw new AiStopDescriptionError('AI_KEY_NOT_CONFIGURED', 'config');
    }

    const stopList = input.stops.map((name, i) => `${i + 1}. ${name}`).join('\n');

    const prompt = [
      'You are a travel writer crafting vivid, inviting stop descriptions for a road trip app.',
      '',
      `Trip context:`,
      `- Origin / region: ${input.location}`,
      `- Trip themes: ${input.themes.join(', ')}`,
      '',
      'Write a description for each stop below.',
      'Each description must be 2-3 sentences. Be specific, sensory, and inspiring.',
      'Mention what makes the stop worthwhile and fit for the trip themes.',
      'Do not start with the stop name — start with an evocative detail or scene.',
      '',
      'Stops:',
      stopList,
      '',
      'Output rules:',
      '- Return JSON only (no markdown, no prose, no code fences).',
      '- Use this exact schema:',
      '{"stops":[{"name":"Stop Name","description":"..."}]}',
      '- Include every stop in the same order as the input list.',
      '- name must exactly match the input stop name.',
      '- All fields required and non-empty.',
    ].join('\n');

    const model = env.GOOGLE_AI_MODEL;
    const fallbackModel = 'gemini-2.5-flash';

    const { responseBodyText } = await this.requestWithFallback({
      prompt,
      apiKey,
      model,
      fallbackModel,
    });

    let parsed: unknown;
    try {
      const raw = JSON.parse(responseBodyText) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        }>;
      };
      // Concatenate all non-thinking parts (thinking models emit thought:true parts
      // for internal reasoning that must be excluded from the actual response text).
      const parts = raw.candidates?.[0]?.content?.parts ?? [];
      const rawText = parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('');
      // Strip optional markdown code fences before parsing JSON
      const jsonText = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(jsonText);
    } catch {
      throw new AiStopDescriptionError('AI_INVALID_RESPONSE', 'parse');
    }

    const validated = StopDescriptionsSchema.safeParse(parsed);
    if (!validated.success) {
      throw new AiStopDescriptionError('AI_INVALID_RESPONSE', 'parse');
    }

    const result: StopDescriptions = {};
    for (const stop of validated.data.stops) {
      result[stop.name] = stop.description;
    }
    return result;
  }

  private async requestWithFallback(params: {
    prompt: string;
    apiKey: string;
    model: string;
    fallbackModel: string;
  }): Promise<{ responseBodyText: string }> {
    const attempts: Array<{ model: string; apiVersion: 'v1' | 'v1beta' }> = [
      { model: params.model, apiVersion: 'v1' },
      { model: params.model, apiVersion: 'v1beta' },
    ];
    if (params.model !== params.fallbackModel) {
      attempts.push({ model: params.fallbackModel, apiVersion: 'v1' });
      attempts.push({ model: params.fallbackModel, apiVersion: 'v1beta' });
    }

    let lastStatus = 0;
    for (const attempt of attempts) {
      const url = new URL(
        `https://generativelanguage.googleapis.com/${attempt.apiVersion}/models/${encodeURIComponent(attempt.model)}:generateContent`,
      );
      url.searchParams.set('key', params.apiKey);

      const response = await this.fetchFn(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: params.prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });

      const bodyText = await response.text();
      lastStatus = response.status;

      if (response.ok) return { responseBodyText: bodyText };
      if (response.status !== 404) break;
    }

    throw new AiStopDescriptionError(
      lastStatus === 0 ? 'AI_REQUEST_FAILED' : 'AI_REQUEST_FAILED',
      'request',
    );
  }
}

export const aiStopDescriptionService = new AiStopDescriptionService();
