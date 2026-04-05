export const metadata = {
  title: 'Privacy Policy — HipTrip',
};

const SECTIONS = [
  {
    title: 'Information We Collect',
    items: [
      {
        subtitle: 'Account Information',
        text: 'When you create an account, we collect your name, email address, and authentication credentials. If you sign in via a third-party provider (e.g., Google), we receive the profile information you authorize that provider to share.',
      },
      {
        subtitle: 'Trip and Usage Data',
        text: 'We store the trips you plan, save, and share — including origin/destination locations, selected stops, trip preferences, and itinerary details. We also collect usage data such as features accessed, searches performed, and pages visited.',
      },
      {
        subtitle: 'Device and Technical Information',
        text: 'We automatically collect IP address, browser type, operating system, referring URLs, and general location (at the city/region level) to operate and improve the Service.',
      },
      {
        subtitle: 'Communications',
        text: 'If you contact us through our support form or email, we retain those communications to respond to your inquiry and improve our service.',
      },
    ],
  },
  {
    title: 'How We Use Your Information',
    items: [
      {
        subtitle: 'Service Operation',
        text: 'To generate AI trip plans, save and retrieve your trips, personalize recommendations, and provide core platform functionality.',
      },
      {
        subtitle: 'Improvement and Research',
        text: 'To analyze usage patterns, fix bugs, improve route quality, and train and refine our AI planning models. Where possible, we use aggregated or anonymized data for this purpose.',
      },
      {
        subtitle: 'Communications',
        text: 'To send transactional emails (e.g., trip confirmations, account notices) and, with your consent, product updates. You can opt out of marketing emails at any time.',
      },
      {
        subtitle: 'Safety and Compliance',
        text: 'To detect and prevent fraud, abuse, and violations of our Terms of Service, and to comply with applicable legal obligations.',
      },
    ],
  },
  {
    title: 'How We Share Your Information',
    items: [
      {
        subtitle: 'Shared Trips',
        text: 'When you share a trip via a share link, the trip content (stops, itinerary, photos) is publicly accessible to anyone with the link. Do not include sensitive personal information in trip names or notes.',
      },
      {
        subtitle: 'Service Providers',
        text: 'We share data with third-party vendors who help us operate the Service — including cloud hosting (Vercel), database services, AI model providers (Google Gemini), and email delivery (Resend). These providers are contractually bound to protect your data and may not use it for their own purposes.',
      },
      {
        subtitle: 'Affiliate Partners',
        text: 'When you click a hotel or travel booking link, your browser is directed to a partner site (e.g., Expedia, Booking.com). We do not share your personal account data with these partners; standard browser referral data (the referring URL) is transmitted.',
      },
      {
        subtitle: 'Legal Requirements',
        text: 'We may disclose your information if required by law, court order, or governmental authority, or to protect the rights, property, or safety of HipTrip, our users, or others.',
      },
      {
        subtitle: 'Business Transfers',
        text: 'In the event of a merger, acquisition, or sale of all or substantially all of our assets, your information may be transferred as part of that transaction. We will notify you via email or a prominent notice on the Service before your data is transferred and becomes subject to a different privacy policy.',
      },
    ],
  },
  {
    title: 'Data Retention',
    items: [
      {
        subtitle: 'Account Data',
        text: 'We retain your account information and saved trips for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law.',
      },
      {
        subtitle: 'Usage and Log Data',
        text: 'Aggregated usage logs are retained for up to 12 months. Anonymized data may be retained indefinitely for research and product improvement.',
      },
    ],
  },
  {
    title: 'Your Rights and Choices',
    items: [
      {
        subtitle: 'Access and Correction',
        text: 'You can view and update your account information at any time through your account settings.',
      },
      {
        subtitle: 'Data Deletion',
        text: 'You may request deletion of your account and associated personal data by emailing support@hiptrip.net with the subject "Delete My Account." We will process your request within 30 days.',
      },
      {
        subtitle: 'Marketing Opt-Out',
        text: 'You may unsubscribe from marketing emails at any time using the unsubscribe link in any email we send.',
      },
      {
        subtitle: 'California Residents (CCPA)',
        text: 'California residents have the right to know what personal information we collect, request deletion, opt out of sale (we do not sell personal data), and not be discriminated against for exercising these rights. Contact us at support@hiptrip.net to submit a request.',
      },
    ],
  },
  {
    title: 'Cookies and Tracking',
    items: [
      {
        subtitle: 'Essential Cookies',
        text: 'We use session cookies required for authentication and core Service functionality. These cannot be disabled without breaking the Service.',
      },
      {
        subtitle: 'Analytics',
        text: 'We use privacy-respecting analytics to understand how the Service is used. This data is aggregated and does not identify you personally.',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        subtitle: 'Measures',
        text: 'We implement industry-standard security practices including HTTPS encryption, hashed password storage, and access controls to protect your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.',
      },
    ],
  },
  {
    title: "Children's Privacy",
    items: [
      {
        subtitle: 'Age Requirement',
        text: 'HipTrip is not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly. If you believe we have inadvertently collected information from a child, please contact us at support@hiptrip.net.',
      },
    ],
  },
  {
    title: 'Changes to This Policy',
    items: [
      {
        subtitle: 'Updates',
        text: 'We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by posting a prominent notice on the Service. Your continued use of HipTrip after changes take effect constitutes acceptance of the updated policy.',
      },
    ],
  },
  {
    title: 'Contact Us',
    items: [
      {
        subtitle: 'Privacy Questions',
        text: 'If you have questions or concerns about this Privacy Policy or our data practices, please contact us at support@hiptrip.net. We aim to respond within 2 business days.',
      },
    ],
  },
];

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
        Last updated: April 5, 2026. This policy explains how HipTrip collects, uses, and
        protects your personal information.
      </p>

      <section className="space-y-4">
        {SECTIONS.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft"
          >
            <h2 className="mb-4 font-display text-lg font-semibold text-wayfarer-primary">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.subtitle}>
                  <p className="mb-1 text-sm font-semibold text-wayfarer-text-main">
                    {item.subtitle}
                  </p>
                  <p className="text-sm leading-relaxed text-wayfarer-text-muted">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  </main>
);

export default PrivacyPage;
