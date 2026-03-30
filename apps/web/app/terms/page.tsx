const TermsPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
        Legal
      </p>
      <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
        Terms of Service
      </h1>
      <p className="max-w-3xl text-sm leading-relaxed text-wayfarer-text-muted">
        Placeholder terms for development preview. Final terms should be reviewed by legal
        counsel before production publication.
      </p>

      <section className="space-y-5">
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Acceptable Use
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Users agree to use HipTrip responsibly and avoid misuse of platform services.
          </p>
        </article>
        <article className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft">
          <h2 className="mb-2 font-display text-2xl font-semibold text-wayfarer-primary">
            Service Availability
          </h2>
          <p className="text-sm leading-relaxed text-wayfarer-text-muted">
            Platform features may evolve over time while we maintain and improve product
            reliability.
          </p>
        </article>
      </section>
    </div>
  </main>
);

export default TermsPage;
