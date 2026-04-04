'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GooglePlacesAutocomplete from '../../../components/GooglePlacesAutocomplete';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

type Sponsor = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  url: string | null;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
  createdAt: string;
};

type FormState = {
  placeId: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  lat: string;
  lng: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  placeId: '',
  title: '',
  description: '',
  url: '',
  imageUrl: '',
  lat: '',
  lng: '',
  active: true,
});

const sponsorToForm = (s: Sponsor): FormState => ({
  placeId: s.placeId,
  title: s.title,
  description: s.description,
  url: s.url ?? '',
  imageUrl: s.imageUrl ?? '',
  lat: s.lat != null ? String(s.lat) : '',
  lng: s.lng != null ? String(s.lng) : '',
  active: s.active,
});

const getToken = async (): Promise<string | undefined> => {
  try {
    const res = await fetch('/api/auth/api-token', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { token?: string };
    return data.token;
  } catch {
    return undefined;
  }
};

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return token
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { 'content-type': 'application/json' };
};

/** Fetch place details (name, address, coords, photo, website) from Google Places API */
const fetchPlaceDetails = async (placeId: string): Promise<Partial<FormState>> => {
  if (typeof window === 'undefined' || !window.google?.maps?.importLibrary) return {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Place } = (await window.google.maps.importLibrary('places')) as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const place = new Place({ id: placeId }) as {
      fetchFields: (opts: { fields: string[] }) => Promise<void>;
      displayName: string | null;
      formattedAddress: string | null;
      location: { lat: () => number; lng: () => number } | null;
      photos: { getURI: (opts: { maxWidth: number }) => string }[] | undefined;
      websiteURI: string | null;
    };
    await place.fetchFields({
      fields: ['displayName', 'formattedAddress', 'location', 'photos', 'websiteURI'],
    });
    const result: Partial<FormState> = { placeId };
    if (place.displayName) result.title = place.displayName;
    if (place.location) {
      result.lat = String(place.location.lat());
      result.lng = String(place.location.lng());
    }
    if (place.photos?.[0]) result.imageUrl = place.photos[0].getURI({ maxWidth: 800 });
    if (place.websiteURI) result.url = place.websiteURI;
    return result;
  } catch {
    return {};
  }
};

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<
    'new' | (string & NonNullable<unknown>) | null
  >(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [placeSearch, setPlaceSearch] = useState('');
  const [fetchingPlace, setFetchingPlace] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/admin/sponsors`, { headers });
      if (res.status === 401 || res.status === 403) {
        setError('Access denied.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      setSponsors((await res.json()) as Sponsor[]);
    } catch {
      setError('Could not load sponsors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setForm(emptyForm());
    setPlaceSearch('');
    setEditingId('new');
  };

  const openEdit = (s: Sponsor) => {
    setForm(sponsorToForm(s));
    setPlaceSearch(s.title);
    setEditingId(s.id);
  };

  const cancel = () => setEditingId(null);

  const handlePlaceSelect = async (description: string, placeId: string) => {
    setPlaceSearch(description);
    setFetchingPlace(true);
    const details = await fetchPlaceDetails(placeId);
    setForm((f) => ({ ...f, ...details }));
    setFetchingPlace(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const headers = await authHeaders();
      const body = {
        placeId: form.placeId || undefined,
        title: form.title,
        description: form.description,
        url: form.url || null,
        imageUrl: form.imageUrl || null,
        lat: form.lat !== '' ? parseFloat(form.lat) : null,
        lng: form.lng !== '' ? parseFloat(form.lng) : null,
        active: form.active,
      };
      const url =
        editingId === 'new'
          ? `${API_BASE}/admin/sponsors`
          : `${API_BASE}/admin/sponsors/${editingId}`;
      const method = editingId === 'new' ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Save failed');
      setEditingId(null);
      await load();
    } catch {
      alert('Save failed. Check the console.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Sponsor) => {
    const headers = await authHeaders();
    await fetch(`${API_BASE}/admin/sponsors/${s.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ active: !s.active }),
    });
    await load();
  };

  const deleteSponsor = async (id: string) => {
    const headers = await authHeaders();
    await fetch(`${API_BASE}/admin/sponsors/${id}`, { method: 'DELETE', headers });
    setDeleteConfirm(null);
    await load();
  };

  const field = (
    label: string,
    key: keyof FormState,
    type = 'text',
    placeholder = '',
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold uppercase tracking-wider text-wayfarer-text-muted">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="rounded-lg border border-wayfarer-accent/30 bg-wayfarer-surface px-3 py-2 text-sm text-wayfarer-text-main outline-none focus:border-wayfarer-primary focus:ring-1 focus:ring-wayfarer-primary"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
      <header className="flex h-16 items-center justify-between border-b border-wayfarer-accent/20 px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-wayfarer-text-muted hover:text-wayfarer-primary"
          >
            ← Back
          </Link>
          <h1 className="font-display text-lg font-extrabold text-wayfarer-primary">
            Sponsor Management
          </h1>
        </div>
        <button
          onClick={openNew}
          className="rounded-xl bg-wayfarer-primary px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
        >
          + New Sponsor
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {loading && <p className="text-sm text-wayfarer-text-muted">Loading...</p>}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {sponsors.length === 0 && (
              <p className="text-sm text-wayfarer-text-muted">
                No sponsors yet. Add one above.
              </p>
            )}
            {sponsors.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-4 rounded-2xl bg-wayfarer-surface p-5 shadow-wayfarer-soft"
              >
                <div className="flex items-start gap-4">
                  {s.imageUrl ? (
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wayfarer-surface-deep text-lg text-wayfarer-text-muted">
                      ★
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-wayfarer-text-main">
                        {s.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.active ? 'bg-green-100 text-green-700' : 'bg-wayfarer-surface-deep text-wayfarer-text-muted'}`}
                      >
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-wayfarer-text-muted">{s.description}</p>
                    <div className="flex flex-wrap gap-3 pt-1 text-xs text-wayfarer-text-muted">
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-wayfarer-primary"
                        >
                          {s.url}
                        </a>
                      )}
                      {s.lat != null && s.lng != null && (
                        <span>
                          📍 {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => void toggleActive(s)}
                    className="rounded-lg border border-wayfarer-accent/30 px-3 py-1.5 text-xs font-semibold text-wayfarer-text-muted transition hover:bg-wayfarer-surface-deep"
                  >
                    {s.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="rounded-lg border border-wayfarer-accent/30 px-3 py-1.5 text-xs font-semibold text-wayfarer-text-muted transition hover:bg-wayfarer-surface-deep"
                  >
                    Edit
                  </button>
                  {deleteConfirm === s.id ? (
                    <>
                      <button
                        onClick={() => void deleteSponsor(s.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded-lg border border-wayfarer-accent/30 px-3 py-1.5 text-xs font-semibold text-wayfarer-text-muted transition hover:bg-wayfarer-surface-deep"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(s.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Create / Edit form ─────────────────────────── */}
        {editingId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-wayfarer-bg p-8 shadow-wayfarer-ambient max-h-[90vh] overflow-y-auto">
              <h2 className="mb-6 font-display text-xl font-extrabold text-wayfarer-primary">
                {editingId === 'new' ? 'New Sponsor' : 'Edit Sponsor'}
              </h2>

              <div className="space-y-4">
                {/* Places search */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-wayfarer-text-muted">
                    Search Google Places
                  </label>
                  <div className="relative">
                    <GooglePlacesAutocomplete
                      value={placeSearch}
                      onChange={setPlaceSearch}
                      onSelect={(val) => setPlaceSearch(val)}
                      onSelectWithPlaceId={(desc, placeId) =>
                        void handlePlaceSelect(desc, placeId)
                      }
                      placeholder="Search for a business or location…"
                      placeTypes={[]}
                    />
                    {fetchingPlace && (
                      <p className="mt-1 text-xs text-wayfarer-text-muted">
                        Fetching details…
                      </p>
                    )}
                  </div>
                  {form.placeId && (
                    <p className="text-[11px] text-wayfarer-text-muted">
                      Place ID: {form.placeId}
                    </p>
                  )}
                </div>

                <div className="border-t border-wayfarer-accent/20 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wayfarer-text-muted">
                    Details (auto-filled or edit manually)
                  </p>
                  {field('Title *', 'title', 'text', 'e.g. Crater Lake Lodge')}
                  <div className="mt-4 flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-wayfarer-text-muted">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Short tagline shown on the ad card"
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      className="rounded-lg border border-wayfarer-accent/30 bg-wayfarer-surface px-3 py-2 text-sm text-wayfarer-text-main outline-none focus:border-wayfarer-primary focus:ring-1 focus:ring-wayfarer-primary"
                    />
                  </div>
                  <div className="mt-4">
                    {field('Destination URL', 'url', 'url', 'https://example.com')}
                  </div>
                  <div className="mt-4">
                    {field(
                      'Image URL',
                      'imageUrl',
                      'url',
                      'https://example.com/photo.jpg',
                    )}
                  </div>
                  {form.imageUrl && (
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="mt-2 h-24 w-full rounded-xl object-cover"
                    />
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {field('Latitude', 'lat', 'number', '45.52')}
                    {field('Longitude', 'lng', 'number', '-122.68')}
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, active: e.target.checked }))
                      }
                      className="h-4 w-4 rounded accent-wayfarer-primary"
                    />
                    <span className="text-sm font-medium text-wayfarer-text-main">
                      Active (show in trips)
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={cancel}
                  className="rounded-xl border border-wayfarer-accent/30 px-5 py-2.5 text-sm font-semibold text-wayfarer-text-muted transition hover:bg-wayfarer-surface-deep"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving || !form.title || !form.description}
                  className="rounded-xl bg-wayfarer-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
