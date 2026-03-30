const JournalPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
        Company
      </p>
      <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
        HipTrip Journal
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-wayfarer-text-muted">
        Stories, road notes, and practical travel insights from the HipTrip team.
      </p>

      <section className="space-y-4">
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-wayfarer-text-muted">
            Coming Soon
          </p>
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Scenic Drives Worth the Detour
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            We are preparing launch articles that cover weekend routes, timing tips, and
            local favorites.
          </p>
        </article>
      </section>
    </div>
  </main>
);

export default JournalPage;
