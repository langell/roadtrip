import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const getApiBaseUrl = (request: NextRequest) => {
  const configuredBaseUrl = (
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  )?.trim();

  if (!configuredBaseUrl?.length) {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : undefined;
  }

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = new URL(configuredBaseUrl).origin;

  if (configuredOrigin === requestOrigin) {
    return undefined;
  }

  return configuredOrigin;
};

export async function GET(request: NextRequest) {
  const apiBaseUrl = getApiBaseUrl(request);
  if (!apiBaseUrl) {
    return NextResponse.json(
      {
        error: 'API_BASE_URL_NOT_CONFIGURED',
      },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL('/suggestions', apiBaseUrl);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const authorization = request.headers.get('authorization');

  const upstreamResponse = await fetch(upstreamUrl, {
    cache: 'no-store',
    headers: authorization ? { authorization } : undefined,
  });

  const body = await upstreamResponse.text();

  return new NextResponse(body, {
    status: upstreamResponse.status,
    headers: {
      'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json',
    },
  });
}
