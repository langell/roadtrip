'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const SUBJECTS = [
  'Trip planning question',
  'Account or billing issue',
  'Bug or technical problem',
  'Feature request',
  'Privacy or data question',
  'Other',
];

const ContactForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0] ?? '');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState('submitting');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (res.ok) {
        setState('success');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="rounded-2xl bg-wayfarer-surface p-8 shadow-wayfarer-soft text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-wayfarer-primary/10">
          <svg
            className="h-7 w-7 text-wayfarer-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="mb-2 font-display text-xl font-bold text-wayfarer-primary">
          Message sent!
        </h3>
        <p className="text-sm text-wayfarer-text-muted">
          We&apos;ll get back to you at <span className="font-semibold">{email}</span>{' '}
          within 1–2 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-wayfarer-text-muted">
            Your name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-xl border border-wayfarer-accent/30 bg-wayfarer-surface px-4 py-3 text-sm text-wayfarer-text-main placeholder:text-wayfarer-text-muted/50 focus:border-wayfarer-primary focus:outline-none focus:ring-1 focus:ring-wayfarer-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-wayfarer-text-muted">
            Email address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full rounded-xl border border-wayfarer-accent/30 bg-wayfarer-surface px-4 py-3 text-sm text-wayfarer-text-main placeholder:text-wayfarer-text-muted/50 focus:border-wayfarer-primary focus:outline-none focus:ring-1 focus:ring-wayfarer-primary"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-wayfarer-text-muted">
          Subject
        </label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-wayfarer-accent/30 bg-wayfarer-surface px-4 py-3 text-sm text-wayfarer-text-main focus:border-wayfarer-primary focus:outline-none focus:ring-1 focus:ring-wayfarer-primary"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-wayfarer-text-muted">
          Message
        </label>
        <textarea
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue or question in as much detail as possible..."
          className="w-full resize-none rounded-xl border border-wayfarer-accent/30 bg-wayfarer-surface px-4 py-3 text-sm text-wayfarer-text-main placeholder:text-wayfarer-text-muted/50 focus:border-wayfarer-primary focus:outline-none focus:ring-1 focus:ring-wayfarer-primary"
        />
      </div>

      {state === 'error' && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          Something went wrong. Please try again or email us directly at{' '}
          <a href="mailto:support@hiptrip.net" className="font-semibold underline">
            support@hiptrip.net
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="flex items-center gap-2 rounded-xl bg-wayfarer-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-60"
      >
        {state === 'submitting' ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Sending…
          </>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  );
};

import SimpleHeader from '../../components/SimpleHeader';

const SupportPage = () => (
  <>
    <SimpleHeader />
    <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Help
          </p>
          <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
            Support
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-wayfarer-text-muted">
            We&apos;re here to help. Browse common questions in our{' '}
            <Link
              href="/faq"
              className="font-semibold text-wayfarer-primary hover:opacity-80"
            >
              FAQ
            </Link>{' '}
            or send us a message below — we typically reply within 1–2 business days.
          </p>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/faq"
            className="flex items-start gap-3 rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft transition-transform hover:-translate-y-0.5 hover:shadow-wayfarer-ambient"
          >
            <span className="text-2xl">❓</span>
            <div>
              <p className="font-display text-sm font-bold text-wayfarer-primary">FAQ</p>
              <p className="text-xs text-wayfarer-text-muted">Browse common questions</p>
            </div>
          </Link>
          <a
            href="mailto:support@hiptrip.net"
            className="flex items-start gap-3 rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft transition-transform hover:-translate-y-0.5 hover:shadow-wayfarer-ambient"
          >
            <span className="text-2xl">✉️</span>
            <div>
              <p className="font-display text-sm font-bold text-wayfarer-primary">
                Email Us
              </p>
              <p className="text-xs text-wayfarer-text-muted">support@hiptrip.net</p>
            </div>
          </a>
          <Link
            href="/privacy"
            className="flex items-start gap-3 rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft transition-transform hover:-translate-y-0.5 hover:shadow-wayfarer-ambient"
          >
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-display text-sm font-bold text-wayfarer-primary">
                Privacy Policy
              </p>
              <p className="text-xs text-wayfarer-text-muted">How we handle your data</p>
            </div>
          </Link>
        </div>

        {/* Contact form */}
        <div className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft md:p-8">
          <h2 className="mb-6 font-display text-xl font-bold text-wayfarer-primary">
            Send us a message
          </h2>
          <ContactForm />
        </div>
      </div>
    </main>
  </>
);

export default SupportPage;
