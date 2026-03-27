const RoutePlannerProductPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
        Product
      </p>
      <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
        Route Planner
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-wayfarer-text-muted">
        Build routes quickly with destination context, stop recommendations, and trip
        customization controls.
      </p>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-xl font-semibold text-wayfarer-primary">
            Flexible Radius
          </h2>
          <p className="text-sm text-wayfarer-text-muted">
            Tune search radius based on drive time and comfort.
          </p>
        </article>
        <article className="rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-xl font-semibold text-wayfarer-primary">
            Curated Themes
          </h2>
          <p className="text-sm text-wayfarer-text-muted">
            Focus on scenic, food, family, or adventure-oriented routes.
          </p>
        </article>
        <article className="rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-xl font-semibold text-wayfarer-primary">
            Stop Prioritization
          </h2>
          <p className="text-sm text-wayfarer-text-muted">
            Balance distance, relevance, and overall route quality.
          </p>
        </article>
      </section>
    </div>
  </main>
);

export default RoutePlannerProductPage;
