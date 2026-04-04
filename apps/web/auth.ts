import NextAuth from 'next-auth';
import Apple from 'next-auth/providers/apple';
import Google from 'next-auth/providers/google';
import { SignJWT } from 'jose';

const authSecret = [process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET].find(
  (value) => value && value.trim().length > 0,
);

const mintApiToken = async (userId: string, secret: string): Promise<string> =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('roadtrip-web')
    .setAudience('roadtrip-api')
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));

const toLogText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret:
    authSecret ??
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? 'roadtrip-dev-auth-secret-change-me'
      : undefined),
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, trigger, profile }) {
      if (profile?.sub) {
        token.sub = profile.sub;
      }
      // Fetch role from API on first sign-in or when session is refreshed
      const shouldFetchRole =
        trigger === 'signIn' || trigger === 'update' || token.role === undefined;
      if (shouldFetchRole && token.sub) {
        const secret =
          authSecret ??
          (process.env.NODE_ENV === 'development'
            ? 'roadtrip-dev-auth-secret-change-me'
            : undefined);
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
        if (secret) {
          try {
            const apiToken = await mintApiToken(token.sub, secret);
            const res = await fetch(`${apiBaseUrl}/users/me`, {
              headers: { authorization: `Bearer ${apiToken}` },
            });
            if (res.ok) {
              const data = (await res.json()) as { role?: string };
              token.role = data.role === 'ADMIN' ? 'ADMIN' : 'USER';
            }
          } catch {
            token.role = token.role ?? 'USER';
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role ?? 'USER') as 'USER' | 'ADMIN';
      }
      return session;
    },
  },
  events: {
    async signIn({ user, profile }) {
      const userId = (profile?.sub ?? user.id)?.toString();
      if (!userId) return;
      const secret =
        authSecret ??
        (process.env.NODE_ENV === 'development'
          ? 'roadtrip-dev-auth-secret-change-me'
          : undefined);
      if (!secret) return;
      try {
        const token = await mintApiToken(userId, secret);
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
        await fetch(`${apiBaseUrl}/users/me`, {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: user.email ?? null,
            name: user.name ?? null,
            image: user.image ?? null,
          }),
        });
      } catch {
        // Non-critical — don't block sign-in
      }
    },
  },
  logger: {
    error(code: unknown, ...message: unknown[]) {
      const payload = [toLogText(code), ...message.map(toLogText)].join(' ');
      if (
        payload.includes('JWTSessionError') ||
        payload.includes('no matching decryption secret')
      ) {
        return;
      }
      console.error(`[auth][error] ${code}`, ...message);
    },
  },
});
