const OfflineMapsProductPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
        Product
      </p>
      <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
        Offline Maps
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-wayfarer-text-muted">
        Keep your routes available even without reliable service, so road trips stay on
        track across remote areas.
      </p>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Download Regions
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Save route regions before departure for uninterrupted navigation context.
          </p>
        </article>
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Reliable Guidance
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Maintain direction and stop visibility when connectivity drops.
          </p>
        </article>
      </section>
    </div>
  </main>
);

export default OfflineMapsProductPage;
