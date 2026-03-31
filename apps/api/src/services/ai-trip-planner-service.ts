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

export type AiTripPlans = z.infer<typeof AiTripPlansSchema> & { degraded?: boolean };

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

  private readonly themeKeywords: Record<string, string[]> = {
    scenic: [
      'viewpoint',
      'overlook',
      'waterfront',
      'coast',
      'scenic',
      'lake',
      'trail',
      'falls',
      'ridge',
      'bluff',
      'creek',
      'river',
      'gorge',
      'canyon',
      'beach',
      'bay',
      'harbor',
      'pier',
    ],
    foodie: [
      'restaurant',
      'food',
      'market',
      'brewery',
      'brew',
      'cafe',
      'bakery',
      'diner',
      'pub',
      'bistro',
      'eatery',
      'taco',
      'pizza',
      'burger',
      'bbq',
      'sushi',
      'kitchen',
      'grill',
      'wine',
      'farm',
      'co-op',
      'creamery',
      'chocolat',
      'candy',
      'dining',
      'cuisine',
      'eat',
      'bar &',
    ],
    culture: [
      'museum',
      'history',
      'historic',
      'gallery',
      'landmark',
      'arts',
      'cultural',
      'theatre',
      'theater',
      'heritage',
      'monument',
      'library',
      'cathedral',
      'chapel',
      'district',
      'center',
    ],
    adventure: [
      'hike',
      'kayak',
      'climb',
      'outdoor',
      'adventure',
      'park',
      'trail',
      'ski',
      'bike',
      'raft',
      'zipline',
      'summit',
      'ridge',
      'wilderness',
      'preserve',
      'forest',
      'gorge',
    ],
    family: [
      'family',
      'kids',
      'playground',
      'zoo',
      'aquarium',
      'all-ages',
      'children',
      'discovery',
      'science',
      'fair',
      'park',
      'farm',
      'petting',
    ],
    sports: [
      'stadium',
      'arena',
      'sports',
      'game',
      'match',
      'athletic',
      'field',
      'ballpark',
      'rink',
      'track',
      'gym',
      'center',
    ],
  };

  private buildThemePrompt(themes: string[]) {
    const themeGuidance: Record<string, string> = {
      scenic:
        'Include dramatic viewpoints, waterfronts, bluffs, overlooks, and photogenic routes.',
      foodie:
        'Include memorable local food experiences: iconic restaurants, bakeries, markets, or regional specialties.',
      culture:
        'Include cultural depth: museums, landmarks, local history, arts districts, or architecture.',
      adventure:
        'Include active outdoor experiences: hikes, paddling spots, climbing areas, parks, or trail towns.',
      family:
        'Include family-friendly pacing and activities suitable for mixed ages with easy logistics.',
      sports:
        'Include sports-centric experiences: stadium districts, game-day venues, training hubs, or iconic athletic sites.',
    };

    return themes
      .map((theme) => {
        const guidance =
          themeGuidance[theme] ??
          `Include meaningful experiences aligned to the "${theme}" theme.`;
        return `- ${theme}: ${guidance}`;
      })
      .join('\n');
  }

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

  private extractJsonText(rawText: string) {
    const trimmed = rawText.trim();

    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1).trim();
    }

    return trimmed;
  }

  private parsePlansFromResponseBody(responseBodyText: string): AiTripPlans {
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

    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        reason: 'missing_candidates',
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(this.extractJsonText(rawText));
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

  private evaluateThemeCoverage(plans: AiTripPlans, themes: string[]) {
    const normalizedThemes = Array.from(
      new Set(themes.map((theme) => theme.trim().toLowerCase()).filter(Boolean)),
    );

    const missingByOption = plans.options.map((option, index) => {
      const corpus = [option.title, option.rationale, ...option.stops]
        .join(' ')
        .toLowerCase();
      const missingThemes = normalizedThemes.filter((theme) => {
        const keywords = this.themeKeywords[theme] ?? [theme];
        return !keywords.some((keyword) => corpus.includes(keyword.toLowerCase()));
      });

      return {
        optionIndex: index,
        missingThemes,
      };
    });

    const hasMissing = missingByOption.some((entry) => entry.missingThemes.length > 0);
    return {
      isCovered: !hasMissing,
      missingByOption,
    };
  }

  private async requestWithModelFallback(params: {
    prompt: string;
    apiKey: string;
    model: string;
    fallbackModel: string;
  }): Promise<{
    responseBodyText: string;
    attemptLabel: string;
    status: number | undefined;
  }> {
    const attempts: Array<{ model: string; apiVersion: 'v1' | 'v1beta' }> = [
      { model: params.model, apiVersion: 'v1' },
      { model: params.model, apiVersion: 'v1beta' },
    ];

    if (params.model !== params.fallbackModel) {
      attempts.push({ model: params.fallbackModel, apiVersion: 'v1' });
      attempts.push({ model: params.fallbackModel, apiVersion: 'v1beta' });
    }

    let response: Response | null = null;
    let responseBodyText = '';
    let attemptLabel = '';
    let lastAttemptedStatus = 0;

    for (const attempt of attempts) {
      attemptLabel = `${attempt.model}@${attempt.apiVersion}`;
      const attempted = await this.requestModel(
        attempt.model,
        attempt.apiVersion,
        params.apiKey,
        params.prompt,
      );
      response = attempted.response;
      responseBodyText = attempted.bodyText;
      lastAttemptedStatus = response.status;

      if (response.ok) {
        return {
          responseBodyText,
          attemptLabel,
          status: response.status,
        };
      }

      if (response.status !== 404) {
        break;
      }
    }

    if (lastAttemptedStatus === 0) {
      throw new Error('NO_MODEL_ATTEMPTS');
    }

    throw new AiTripPlannerError('AI_REQUEST_FAILED', 'request', {
      status: response?.status,
      body: responseBodyText,
      attempted: attemptLabel,
    });
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

  private buildModifierPrompt(modifiers?: {
    smartPitstops?: boolean;
    photoOps?: boolean;
  }) {
    const lines: string[] = [];
    if (modifiers?.smartPitstops) {
      lines.push(
        '- smart pitstops: Weave in 1-2 practical road trip stops per option — a well-regarded local coffee shop, a scenic fuel stop, or a roadside spot worth a 10-minute stretch.',
      );
    }
    if (modifiers?.photoOps) {
      lines.push(
        '- photo ops: Prioritize stops with strong visual character — golden-hour overlooks, striking murals, iconic backdrops, or locations known for photography.',
      );
    }
    return lines.join('\n');
  }

  async generatePlans(input: {
    location: string;
    radiusKm: number;
    themes: string[];
    maxOptions: 2 | 3;
    modifiers?: { smartPitstops?: boolean; photoOps?: boolean };
  }): Promise<AiTripPlans> {
    const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      throw new AiTripPlannerError('AI_KEY_NOT_CONFIGURED', 'config');
    }

    const model = env.GOOGLE_AI_MODEL;
    const fallbackModel = 'gemini-2.5-flash';

    const themePrompt = this.buildThemePrompt(input.themes);
    const modifierPrompt = this.buildModifierPrompt(input.modifiers);
    const prompt = [
      'You are an expert regional road-trip designer.',
      'Create distinctly lovable itinerary options that feel surprising, local, and memorable.',
      '',
      'Trip request:',
      `- Origin: ${input.location}`,
      `- Max search radius: ${input.radiusKm} km`,
      `- Selected themes: ${input.themes.join(', ')}`,
      `- Required options: exactly ${input.maxOptions}`,
      '',
      'Theme direction (apply all selected themes):',
      themePrompt,
      ...(modifierPrompt
        ? ['', 'Additional modifiers (layer on top of themes):', modifierPrompt]
        : []),
      '',
      'Hard requirements:',
      '- Every itinerary option must include all selected themes (no theme may be omitted).',
      '- Ensure each option mixes themes naturally across the full stop sequence.',
      '- Make each option feel different in vibe, pacing, and stop composition.',
      '- Stops must be realistic place names the Places API can resolve (avoid generic placeholders).',
      '- Use 3-6 stops per option unless location density is low.',
      '- Keep rationale concise (1-2 sentences) and explicitly reference how all selected themes are satisfied.',
      '',
      'Output rules:',
      '- Return JSON only (no markdown, no prose, no code fences).',
      '- Use this exact schema:',
      '{"options":[{"title":"...","rationale":"...","stops":["Stop 1","Stop 2"]}]}',
      '- `options` length must equal requested option count.',
      '- Each `stops` array must contain 2-8 stop names.',
      '- All fields are required and must be non-empty strings.',
    ].join('\n');

    let responseBodyText = '';
    let attemptLabel = '';
    try {
      const primaryAttempt = await this.requestWithModelFallback({
        prompt,
        apiKey,
        model,
        fallbackModel,
      });
      responseBodyText = primaryAttempt.responseBodyText;
      attemptLabel = primaryAttempt.attemptLabel;

      const primaryPlans = this.parsePlansFromResponseBody(responseBodyText);
      const primaryCoverage = this.evaluateThemeCoverage(primaryPlans, input.themes);
      if (primaryCoverage.isCovered) {
        return primaryPlans;
      }

      // If all requested options are accounted for and only some fail coverage,
      // retry only when we'd lose too many — otherwise proceed to retry for a better result.
      const retryPrompt = [
        prompt,
        '',
        'Correction required: the prior result did not satisfy all selected themes in every option.',
        `Missing theme coverage by option: ${JSON.stringify(primaryCoverage.missingByOption)}.`,
        'Regenerate from scratch and ensure each option explicitly includes all selected themes.',
      ].join('\n');

      const retryAttempt = await this.requestWithModelFallback({
        prompt: retryPrompt,
        apiKey,
        model,
        fallbackModel,
      });
      responseBodyText = retryAttempt.responseBodyText;
      attemptLabel = retryAttempt.attemptLabel;

      const retryPlans = this.parsePlansFromResponseBody(responseBodyText);
      const retryCoverage = this.evaluateThemeCoverage(retryPlans, input.themes);
      if (retryCoverage.isCovered) {
        return retryPlans;
      }

      // Filter to options that pass coverage; return partial set rather than erroring.
      const passingIndices = new Set(
        retryCoverage.missingByOption
          .filter((entry) => entry.missingThemes.length === 0)
          .map((entry) => entry.optionIndex),
      );
      const passingOptions = retryPlans.options.filter((_, i) => passingIndices.has(i));
      if (passingOptions.length > 0) {
        return { options: passingOptions, degraded: true };
      }

      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        reason: 'theme_coverage_failed',
        missingByOption: retryCoverage.missingByOption,
      });
    } catch (error) {
      if (error instanceof AiTripPlannerError) {
        throw error;
      }

      throw new AiTripPlannerError('AI_REQUEST_FAILED', 'request', {
        reason: String(error),
        attempted: attemptLabel,
      });
    }
  }
}

export const aiTripPlannerService = new AiTripPlannerService();
