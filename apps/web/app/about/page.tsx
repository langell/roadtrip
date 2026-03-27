const AboutPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
        Company
      </p>
      <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
        About HopTrip
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-wayfarer-text-muted">
        HopTrip helps travelers turn everyday drives into curated journeys with scenic
        routes, local discoveries, and practical trip planning tools.
      </p>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Our Mission
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Make road travel feel intentional by blending map intelligence with editorial
            trip storytelling.
          </p>
        </article>
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            What We Build
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Route planning, stop recommendations, and trip experiences designed for both
            explorers and everyday drivers.
          </p>
        </article>
      </section>
    </div>
  </main>
);

export default AboutPage;
