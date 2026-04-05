# Stories Status

Tracks completed and in-progress story work in chronological order.
For priority order, see [RANKING.md](RANKING.md).

## In Progress

_(none)_

## Completed

- 2026-04-05 — RT-042 `2026-04-share-plan-before-saving.md` — POST /trips/share-preview + GET /trips/preview/:token; PlanPreview DB model (48h TTL); ↗ Share button on each plan card; /preview/[token] public page with stop cards and Save CTA.
- 2026-04-05 — RT-041 `2026-04-stop-preview-sheet.md` — StopPreviewSheet component (bottom sheet mobile / centered modal desktop); tap any resolved stop in planner to preview photo, description, distance, Maps link without leaving page.
- 2026-04-05 — RT-040 `2026-04-swappable-alternative-stops.md` — AI returns 2 alt stop names per stop; parallel Places resolution; ⇄ swap button cycles through alternatives in-place; active selection baked into saved plan.
- 2026-04-05 — RT-039 `2026-04-plan-refinement.md` — POST /trips/refine-plan; refinePlan() AI service method (tier 1); inline refine UI with undo on each plan card.
- 2026-04-05 — RT-038 `2026-04-personalization-from-saved-trips.md` — getUserPreferences() builds theme/stop/radius hint from saved trips; injected into AI prompt for authenticated users.

- 2026-04-05 — RT-037 `2026-04-two-tier-model-routing.md` — Tier 1 (fast model) for initial <3-theme requests; Tier 2 (full model) for 3-theme + retries. GOOGLE_AI_MODEL_FAST env var.
- 2026-04-05 — RT-036 `2026-04-cache-prewarming.md` — nightly GET /jobs/prewarm-cache; top-N trending locations × theme combos; CRON_SECRET auth; bounded to PREWARM_MAX_GENERATIONS.
- 2026-04-05 — RT-035 `2026-04-fuzzy-cache-matching.md` — locationKey OR condition in cache lookup; normalizeLocationKey fast path + lat/lng bounding box fallback.
- 2026-04-05 — RT-034 `2026-04-streaming-plan-generation.md` — true AI token streaming via streamGenerateContent + SSE; first option appears within ~1s.
- 2026-04-05 — RT-043 `2026-04-hotel-affiliate-cards.md` — passive hotel affiliate cards on stop detail pages.
- 2026-04-05 — RT-045 `2026-04-legal-and-support-pages.md` — Terms, Privacy, Support (contact form), FAQ pages with Resend email delivery.

- 2026-03-31 — RT-033 `2026-03-route-map-view.md` — /trips/[id]/map, numbered markers, stop list panel, sponsored stop card, drive-time legs.
- 2026-03-31 — RT-032 `2026-03-discovery-feed.md` — /discover page, trending routes, nearby stops, sponsored injection, home redirect.
- 2026-03-31 — RT-020 `2026-03-security-best-practices.md` — photo endpoint rate limiting, security checklist doc, auth/logging audit.
- 2026-03-31 — RT-016 `2026-03-ai-trip-planner-web-experience.md` — implemented; closing as done.
- 2026-03-31 — RT-015 `2026-03-ai-trip-planner-api-orchestration.md` — implemented; closing as done.
- 2026-03-31 — RT-014 `2026-03-ai-trip-planning-and-stop-details.md` — implemented; closing as done.
- 2026-03-31 — RT-007 `2026-03-reliability-deploy-hardening.md` — /ready endpoint, CI --frozen-lockfile + build step, env.example cleanup.
- 2026-03-31 — RT-031 `2026-03-shareable-plan-links.md` — share button, /s/[token] public page, bento layout with images.
- 2026-03-31 — RT-029 `2026-03-save-and-select-plan.md` — save flow wired end-to-end with auth gate.
- 2026-03-31 — RT-030 `2026-03-pwa-and-remove-native.md` — PWA manifest/SW/icons, mobile app removed, /trips page, a11y fixes.

- 2026-03-30 — RT-028 `2026-03-smart-pitstops-photo-ops-toggles.md` — pill toggles wired to API modifiers.
- 2026-03-30 — RT-001 `2026-03-trip-suggestions.md` — schema FK fix, test auth bypass fix, all 45 API tests passing.
- 2026-03-30 — RT-018 `2026-03-main-search-ui-improvements.md` moved to `stories/Done/`.
- 2026-03-30 — RT-004 `2026-03-auth-user-context.md` moved to `stories/Done/`.
- 2026-03-30 — RT-027 `2026-03-account-page.md` moved to `stories/Done/`.
- 2026-03-30 — RT-026 `2026-03-sign-in-page.md` moved to `stories/Done/`.
- 2026-03-30 — RT-025 `2026-03-web-stitch-home-and-planner-parity.md` moved to `stories/Done/`.
- 2026-03-27 — RT-017 `2026-03-itinerary-cache-by-location.md` moved to `stories/Done/`.
- 2026-03-27 — RT-013 `2026-03-footer-legal-pages.md` moved to `stories/Done/`.
- 2026-03-27 — RT-012 `2026-03-footer-product-pages.md` moved to `stories/Done/`.
- 2026-03-27 — RT-011 `2026-03-footer-company-pages.md` moved to `stories/Done/`.
- 2026-03-27 — RT-024 `2026-03-web-stitch-design-token-alignment.md` moved to `stories/Done/`.
- 2026-03-27 — RT-008 `2026-03-web-stitch-audit-and-gap-map.md` moved to `stories/Done/`.
- 2026-03-26 — RT-010 `2026-03-observability-baseline.md` moved to `stories/Done/`.
- 2026-03-26 — RT-009 `2026-03-structured-logging.md` moved to `stories/Done/`.
- 2026-03-26 — RT-003 `2026-03-saved-trip-details-mobile.md` moved to `stories/Done/`.
- 2026-03-26 — RT-002 `2026-03-real-places-integration.md` moved to `stories/Done/`.
