const PrivacyPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
        Legal
      </p>
      <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
        Privacy Policy
      </h1>
      <p className="max-w-3xl text-sm leading-relaxed text-wayfarer-text-muted">
        Placeholder policy content for product development. Final legal language should be
        reviewed and approved by legal counsel.
      </p>

      <section className="space-y-5">
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Data We Collect
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Account details, trip preferences, and route interactions necessary for core
            trip planning features.
          </p>
        </article>
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            How We Use Data
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Improve route quality, personalize recommendations, and support operational
            reliability.
          </p>
        </article>
      </section>
    </div>
  </main>
);

export default PrivacyPage;
