import type { Request } from 'express';
import { env } from '../config/env.js';

export const buildSuggestionImageUrl = (
  req: Request,
  photoName?: string,
): string | undefined => {
  if (!photoName) return undefined;
  const base = env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
  return `${base}/places/photo?name=${encodeURIComponent(photoName)}`;
};

export const rewritePhotoProxyUrl = (
  req: Request,
  imageUrl: string | undefined,
): string | undefined => {
  if (!imageUrl) return undefined;
  try {
    const parsed = new URL(imageUrl);
    const photoName = parsed.searchParams.get('name');
    if (parsed.pathname === '/places/photo' && photoName) {
      return buildSuggestionImageUrl(req, photoName);
    }
  } catch {
    // not a valid URL — return unchanged
  }
  return imageUrl;
};
