import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const StopTypeSchema = z.enum(['attraction', 'pit_stop', 'photo_op']).nullable();

export type StopType = z.infer<typeof StopTypeSchema>;

const AiStopSchema = z.object({
  name: z.string().min(1),
  alternatives: z.array(z.string()).max(2).default([]),
  stopType: StopTypeSchema,
});

const AiTripOptionSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  stops: z.array(AiStopSchema).min(2).max(8),
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
      const corpus = [option.title, option.rationale, ...option.stops.map((s) => s.name)]
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
        '- smart pitstops: Weave in 1-2 practical road trip stops per option — a well-regarded local coffee shop, a scenic fuel stop, or a roadside spot worth a 10-minute stretch. Set stopType="pit_stop" on those stops.',
      );
    }
    if (modifiers?.photoOps) {
      lines.push(
        '- photo ops: Prioritize stops with strong visual character — golden-hour overlooks, striking murals, iconic backdrops, or locations known for photography. Set stopType="photo_op" on those stops.',
      );
    }
    return lines.join('\n');
  }

  private buildPlanPrompt(input: {
    location: string;
    radiusKm: number;
    themes: string[];
    maxOptions: 2 | 3;
    modifiers?: { smartPitstops?: boolean; photoOps?: boolean };
    userPreferences?: string;
  }): string {
    const themePrompt = this.buildThemePrompt(input.themes);
    const modifierPrompt = this.buildModifierPrompt(input.modifiers);
    return [
      'You are an expert regional road-trip designer.',
      'Create distinctly lovable itinerary options that feel surprising, local, and memorable.',
      ...(input.userPreferences
        ? [
            '',
            `User context: ${input.userPreferences} Weight suggestions toward these preferences but don't restrict creativity.`,
          ]
        : []),
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
      '{"options":[{"title":"...","rationale":"...","stops":[{"name":"Stop 1","alternatives":["Alt A","Alt B"],"stopType":"attraction"},{"name":"Stop 2","alternatives":[],"stopType":null}]}]}',
      '- `options` length must equal requested option count.',
      '- Each `stops` array must contain 2-8 stop objects.',
      '- Each stop must have a `name` (non-empty string), `alternatives` (array of 0-2 alternative place names), and `stopType` ("attraction", "pit_stop", "photo_op", or null).',
      '- Alternatives should be similar in character to the primary stop but different venues.',
      '- Use stopType="attraction" for standard themed stops. Only use "pit_stop" or "photo_op" when those modifiers are active.',
      '- All other fields are required and must be non-empty strings.',
    ].join('\n');
  }

  // Extracts newly complete option objects from accumulated streaming text.
  // Uses brace-depth counting (string-aware) to find complete JSON objects
  // within the "options":[...] array, returning only items beyond alreadyExtracted.
  private extractNewOptions(text: string, alreadyExtracted: number): unknown[] {
    const optionsIdx = text.indexOf('"options"');
    if (optionsIdx === -1) return [];

    const bracketIdx = text.indexOf('[', optionsIdx);
    if (bracketIdx === -1) return [];

    const allOptions: unknown[] = [];
    let pos = bracketIdx + 1;

    while (pos < text.length) {
      while (
        pos < text.length &&
        (text[pos] === ',' ||
          text[pos] === ' ' ||
          text[pos] === '\n' ||
          text[pos] === '\r' ||
          text[pos] === '\t')
      )
        pos++;

      if (pos >= text.length || text[pos] === ']') break;
      if (text[pos] !== '{') break;

      let depth = 0;
      let inString = false;
      let end = -1;
      for (let i = pos; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
          if (ch === '\\') {
            i++;
            continue;
          }
          if (ch === '"') inString = false;
        } else {
          if (ch === '"') inString = true;
          else if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
      }

      if (end === -1) break;

      try {
        allOptions.push(JSON.parse(text.slice(pos, end)));
        pos = end;
      } catch {
        break;
      }
    }

    return allOptions.slice(alreadyExtracted);
  }

  // Streams plan options from Gemini as they are parsed from the token stream.
  // Yields validated AiTripOption objects one by one without waiting for the
  // full response — enabling the route to resolve Places API and emit SSE
  // events for each option independently.
  async *generatePlansStream(input: {
    location: string;
    radiusKm: number;
    themes: string[];
    maxOptions: 2 | 3;
    modifiers?: { smartPitstops?: boolean; photoOps?: boolean };
    userPreferences?: string;
  }): AsyncGenerator<z.infer<typeof AiTripOptionSchema>> {
    const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
    if (!apiKey) throw new AiTripPlannerError('AI_KEY_NOT_CONFIGURED', 'config');

    const prompt = this.buildPlanPrompt(input);
    const model = env.GOOGLE_AI_MODEL;
    const fallbackModel = 'gemini-2.5-flash';
    const payload = JSON.stringify(this.buildRequestPayload(prompt));

    const buildStreamUrl = (m: string, apiVersion: 'v1beta' | 'v1') => {
      const url = new URL(
        `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(m)}:streamGenerateContent`,
      );
      url.searchParams.set('key', apiKey);
      url.searchParams.set('alt', 'sse');
      return url;
    };

    // Try primary model (v1beta then v1), then fallback model (v1beta then v1).
    // Mirrors the same resilience as the non-streaming requestWithModelFallback.
    const streamAttempts: Array<{ m: string; apiVersion: 'v1beta' | 'v1' }> = [
      { m: model, apiVersion: 'v1beta' },
      { m: model, apiVersion: 'v1' },
    ];
    if (model !== fallbackModel) {
      streamAttempts.push({ m: fallbackModel, apiVersion: 'v1beta' });
      streamAttempts.push({ m: fallbackModel, apiVersion: 'v1' });
    }

    let response: Response | null = null;
    for (const attempt of streamAttempts) {
      response = await this.fetchFn(buildStreamUrl(attempt.m, attempt.apiVersion), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (response.status !== 404) break;
    }

    if (!response || !response.ok || !response.body) {
      throw new AiTripPlannerError('AI_REQUEST_FAILED', 'request', {
        status: response?.status,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let accumulatedText = '';
    let extractedCount = 0;

    type GeminiChunk = {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() ?? '';

        for (const event of events) {
          const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          let chunk: GeminiChunk;
          try {
            chunk = JSON.parse(jsonStr) as GeminiChunk;
          } catch {
            continue;
          }

          const textDelta = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          accumulatedText += textDelta;

          const rawOptions = this.extractNewOptions(accumulatedText, extractedCount);
          for (const rawOption of rawOptions) {
            const normalized =
              typeof rawOption === 'object' && rawOption !== null
                ? {
                    ...(rawOption as Record<string, unknown>),
                    rationale:
                      typeof (rawOption as Record<string, unknown>).rationale ===
                        'string' &&
                      ((rawOption as Record<string, unknown>).rationale as string).trim()
                        ? (rawOption as Record<string, unknown>).rationale
                        : 'A balanced route aligned to your selected themes.',
                  }
                : rawOption;

            const parsed = AiTripOptionSchema.safeParse(normalized);
            if (parsed.success) {
              yield parsed.data;
              extractedCount++;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildRefinePlanPrompt(input: {
    existingOption: { title: string; rationale: string; stops: { name: string }[] };
    instruction: string;
    location: string;
    themes: string[];
  }): string {
    const stopList = input.existingOption.stops
      .map((s, i) => `  ${i + 1}. ${s.name}`)
      .join('\n');
    return [
      'You are an expert regional road-trip designer.',
      'The user wants to make a small edit to an existing trip plan.',
      '',
      'Existing plan:',
      `Title: ${input.existingOption.title}`,
      `Rationale: ${input.existingOption.rationale}`,
      'Stops:',
      stopList,
      '',
      `Location context: ${input.location}`,
      `Themes: ${input.themes.join(', ')}`,
      '',
      `User instruction: "${input.instruction}"`,
      '',
      'Rules:',
      '- Make the minimum change needed to satisfy the instruction.',
      '- Change at most 1-2 stops. Preserve everything else.',
      '- Keep the same themes and overall vibe.',
      '- Use realistic place names the Places API can resolve.',
      '- Update the title and rationale only if the edit materially changes the trip character.',
      '',
      'Output rules:',
      '- Return JSON only (no markdown, no prose, no code fences).',
      '- Use this exact schema:',
      '{"title":"...","rationale":"...","stops":[{"name":"Stop 1","stopType":"attraction"},{"name":"Stop 2","stopType":null}]}',
      '- `stops` must contain 2-8 stop objects.',
      '- Each stop must have a `name` (non-empty string) and `stopType` ("attraction", "pit_stop", "photo_op", or null).',
    ].join('\n');
  }

  async refinePlan(input: {
    existingOption: { title: string; rationale: string; stops: { name: string }[] };
    instruction: string;
    location: string;
    themes: string[];
  }): Promise<z.infer<typeof AiTripOptionSchema>> {
    const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      throw new AiTripPlannerError('AI_KEY_NOT_CONFIGURED', 'config');
    }

    const prompt = this.buildRefinePlanPrompt(input);
    const model = env.GOOGLE_AI_MODEL_FAST;
    const fallbackModel = env.GOOGLE_AI_MODEL;

    const { responseBodyText } = await this.requestWithModelFallback({
      prompt,
      apiKey,
      model,
      fallbackModel,
    });

    // Parse a single option object (not wrapped in { options: [] })
    let payload: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    try {
      payload = JSON.parse(responseBodyText) as typeof payload;
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

    // Ensure rationale is present
    if (
      parsedJson &&
      typeof parsedJson === 'object' &&
      !(
        'rationale' in parsedJson &&
        typeof (parsedJson as Record<string, unknown>).rationale === 'string' &&
        ((parsedJson as Record<string, unknown>).rationale as string).trim()
      )
    ) {
      parsedJson = {
        ...(parsedJson as Record<string, unknown>),
        rationale: input.existingOption.rationale,
      };
    }

    const parsed = AiTripOptionSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AiTripPlannerError('AI_INVALID_RESPONSE', 'parse', {
        issues: parsed.error.issues,
      });
    }

    return parsed.data;
  }

  async generatePlans(input: {
    location: string;
    radiusKm: number;
    themes: string[];
    maxOptions: 2 | 3;
    modifiers?: { smartPitstops?: boolean; photoOps?: boolean };
    userPreferences?: string;
  }): Promise<AiTripPlans> {
    const apiKey = env.GOOGLE_AI_API_KEY ?? env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      throw new AiTripPlannerError('AI_KEY_NOT_CONFIGURED', 'config');
    }

    // Tier 1 (fast/cheap) for initial attempt on simple requests (< 3 themes).
    // Tier 2 (full) for complex requests (>= 3 themes) and all retries.
    const isComplex = input.themes.length >= 3;
    const tier1Model = env.GOOGLE_AI_MODEL_FAST;
    const tier2Model = env.GOOGLE_AI_MODEL;
    const primaryModel = isComplex ? tier2Model : tier1Model;
    const primaryTier = isComplex ? 2 : 1;
    const fallbackModel = 'gemini-2.5-flash';

    const prompt = this.buildPlanPrompt(input);

    let responseBodyText = '';
    let attemptLabel = '';
    try {
      logger.info(
        { tier: primaryTier, model: primaryModel, themes: input.themes.length },
        'ai.plan.tier-selected',
      );

      const primaryAttempt = await this.requestWithModelFallback({
        prompt,
        apiKey,
        model: primaryModel,
        fallbackModel,
      });
      responseBodyText = primaryAttempt.responseBodyText;
      attemptLabel = primaryAttempt.attemptLabel;

      const primaryPlans = this.parsePlansFromResponseBody(responseBodyText);
      const primaryCoverage = this.evaluateThemeCoverage(primaryPlans, input.themes);
      if (primaryCoverage.isCovered) {
        return primaryPlans;
      }

      // Coverage failed — escalate to tier 2 for retry regardless of initial tier.
      logger.info({ tier: 2, model: tier2Model, attemptLabel }, 'ai.plan.tier-escalate');

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
        model: tier2Model,
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
