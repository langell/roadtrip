const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export type AnalyticsEventType =
  | 'trip_generate'
  | 'trip_save'
  | 'trip_open'
  | 'sponsored_click'
  | 'sponsored_impression';

/**
 * Fire-and-forget analytics event. Never throws — analytics must not break flows.
 */
export const recordEvent = (
  type: AnalyticsEventType,
  payload: Record<string, unknown> = {},
): void => {
  void fetch(`${apiBaseUrl}/analytics/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  }).catch(() => {
    // Swallow — analytics must never break user flows
  });
};
