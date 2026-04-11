'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { shareTrip } from '../lib/api-client';
import { ShareModal, buildShareCaption } from './ShareModal';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function getApiToken(): Promise<string | undefined> {
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
}

async function deleteTripRequest(tripId: string): Promise<boolean> {
  try {
    const token = await getApiToken();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${apiBaseUrl}/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
      headers,
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

type Props = {
  tripId: string;
  tripName: string;
  stops: Array<{ name: string; order: number }>;
  shareToken?: string | null;
};

export default function TripCardActions({ tripId, tripName, stops }: Props) {
  const router = useRouter();
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'copied' | 'shared' | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shareModal, setShareModal] = useState<{ url: string; caption: string } | null>(
    null,
  );

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const result = await shareTrip(tripId);
      if (!result) return;

      const url = result.shareUrl;
      const caption = buildShareCaption(tripName, stops, url);

      if (navigator.share) {
        try {
          await navigator.share({ title: tripName, text: caption, url });
          setShareFeedback('shared');
          setTimeout(() => setShareFeedback(null), 2000);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          throw err;
        }
      } else {
        setShareModal({ url, caption });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setShowConfirm(false);
    setIsDeleting(true);
    try {
      const ok = await deleteTripRequest(tripId);
      if (ok) router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Share */}
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={isSharing}
          className="flex items-center gap-1.5 rounded-lg border border-wayfarer-primary/20 px-3 py-1.5 text-xs font-semibold text-wayfarer-primary transition hover:border-wayfarer-primary hover:bg-wayfarer-primary hover:text-white disabled:opacity-50"
        >
          {shareFeedback === 'shared' ? (
            'Shared!'
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {isSharing ? 'Sharing…' : 'Share'}
            </>
          )}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isDeleting}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-wayfarer-text-muted transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          title="Delete trip"
        >
          {isDeleting ? (
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          )}
        </button>
      </div>

      {/* Share modal */}
      {shareModal && (
        <ShareModal
          caption={shareModal.caption}
          url={shareModal.url}
          onClose={() => setShareModal(null)}
        />
      )}

      {/* Inline confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-wayfarer-text-main">
              Delete this trip?
            </h3>
            <p className="mb-5 text-sm text-wayfarer-text-muted">
              This cannot be undone. All stops will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-wayfarer-accent/30 py-2 text-sm font-semibold text-wayfarer-text-muted transition hover:bg-wayfarer-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirmed()}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
