import { z } from 'zod';
import { env } from '../config/env.js';

const AiTripOptionSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  stops: z.array(z.string().min(1)).min(2).max(8),
});

const AiTripPlansSchema = z.object({
  options: z.array(AiTripOptionSchema).min(2).max(3),
});

export type AiTripPlans = z.infer<typeof AiTripPlansSchema>;

type PlannerStage = 'config' | 'request' | 'parse';

export class AiTripPlannerError extends Error {
  readonly stage: PlannerStage;
  readonly details: Record<string, unknown>;

  constructor(code: string, stage: PlannerStage, details?: Record<string, unknown>) {
    super(code);
    this.name = 'AiTripPlannerError';
    this.stage = stage;
    this.details = details ?? {};
  }
}

export class AiTripPlannerService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  private normalizeAiResponse(value: unknown): unknown {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const root = value as Record<string, unknown>;
    if (!Array.isArray(root.options)) {
      return value;
    }

    return {
      ...root,
      options: root.options.map((option) => {
        if (!option || typeof option !== 'object') {
          return option;
        }

        const typedOption = option as Record<string, unknown>;
        if (typeof typedOption.rationale === 'string' && typedOption.rationale.trim()) {
          return typedOption;
        }

        return {
          ...typedOption,
          rationale: 'A balanced route aligned to your selected themes.',
        };
      }),
    };
  }

  private buildRequestPayload(prompt: string) {
    return {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    };
  }

  private async requestModel(
    model: string,
    apiVersion: 'v1' | 'v1beta',
    apiKey: string,
    prompt: string,
  ): Promise<{ response: Response; bodyText: string }> {
    const requestUrl = new URL(
      `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`,
    );
    requestUrl.searchParams.set('key', apiKey);

    const response = await this.fetchFn(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildRequestPayload(prompt)),
    });

    return {
      response,
      bodyText: await response.text(),
    };
  }

  async generatePlans(input: {
    location: string;
    radiusKm: number;
    themes: string[];
    maxOptions: 2 | 3;
  }): Promise<AiTripPlans> {
    const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      throw new AiTripPlannerError('AI_KEY_NOT_CONFIGURED', 'config');
    }

    const model = env.GOOGLE_AI_MODEL;
    const fallbackModel = 'gemini-2.5-flash';

    const prompt = [
      'Create a road trip plan JSON response only.',
      `Origin: ${input.location}`,
      `Search radius (km): ${input.radiusKm}`,
      `Themes: ${input.themes.join(', ')}`,
      `Return exactly ${input.maxOptions} itinerary options.`,
      'Each option must include: title, rationale, and stops (2-8 stop names).',
      'Do not include markdown. Return strict JSON in this shape:',
      '{"options":[{"title":"...","rationale":"...","stops":["..."]}]}.',
    ].join('\n');

    let response: Response | null = null;
    let responseBodyText = '';
    let attemptLabel = '';
    try {
      const attempts: Array<{ model: string; apiVersion: 'v1' | 'v1beta' }> = [
        { model, apiVersion: 'v1' },
        { model, apiVersion: 'v1beta' },
      ];

      if (model !== fallbackModel) {
        attempts.push({ model: fallbackModel, apiVersion: 'v1' });
        attempts.push({ model: fallbackModel, apiVersion: 'v1beta' });
      }

      let lastAttemptedStatus = 0;
      for (const attempt of attempts) {
        attemptLabel = `${attempt.model}@${attempt.apiVersion}`;
        const attempted = await this.requestModel(
          attempt.model,
          attempt.apiVersion,
          apiKey,
          prompt,
        );
        response = attempted.response;
        responseBodyText = attempted.bodyText;
        lastAttemptedStatus = response.status;

        if (response.ok) {
          break;
        }

        if (response.status !== 404) {
          break;
        }
      }

      if (lastAttemptedStatus === 0) {
        throw new Error('NO_MODEL_ATTEMPTS');
      }
    } catch (error) {
      throw new AiTripPlannerError('AI_REQUEST_FAILED', 'request', {
        reason: String(error),
        attempted: attemptLabel,
      });
    }

    if (!response || !response.ok) {
      throw new AiTripPlannerError('AI_REQUEST_FAILED', 'request', {
        status: response?.status,
        body: responseBodyText,
        attempted: attemptLabel,
      });
    }

    let payload: {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    try {
      payload = JSON.parse(responseBodyText) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };
    } catch (error) {
      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        reason: String(error),
      });
    }

    const typedPayload = payload as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const rawText = typedPayload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        reason: 'missing_candidates',
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        reason: String(error),
      });
    }

    const normalizedJson = this.normalizeAiResponse(parsedJson);
    const parsed = AiTripPlansSchema.safeParse(normalizedJson);
    if (!parsed.success) {
      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        issues: parsed.error.issues,
      });
    }

    return parsed.data;
  }
}

export const aiTripPlannerService = new AiTripPlannerService();
