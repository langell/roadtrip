import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { auth } from '../../../../auth';

const API_TOKEN_ISSUER = 'roadtrip-web';
const API_TOKEN_AUDIENCE = 'roadtrip-api';

const getAuthSecret = () => {
  const secret = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)?.trim();
  return secret?.length ? secret : undefined;
};

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? undefined;

  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const secret = getAuthSecret();
  if (!secret) {
    return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500 });
  }

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(API_TOKEN_ISSUER)
    .setAudience(API_TOKEN_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token });
}
