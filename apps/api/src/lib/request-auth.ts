import { jwtVerify } from 'jose';

type HeaderLookup = {
  header: (name: string) => string | string[] | undefined;
};

const API_TOKEN_ISSUER = 'roadtrip-web';
const API_TOKEN_AUDIENCE = 'roadtrip-api';

const normalizeHeaderValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const parseBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token) {
    return undefined;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return undefined;
  }

  const bearerToken = token.trim();
  return bearerToken.length ? bearerToken : undefined;
};

const verifyApiToken = async (token: string) => {
  const secret = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return token;
    }
    return undefined;
  }

  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: API_TOKEN_ISSUER,
      audience: API_TOKEN_AUDIENCE,
    });

    const userId = verified.payload.sub;
    return typeof userId === 'string' && userId.length ? userId : undefined;
  } catch {
    return undefined;
  }
};

export const getRequestUserId = async (req: HeaderLookup) => {
  const authToken = parseBearerToken(normalizeHeaderValue(req.header('authorization')));
  if (authToken) {
    const userId = await verifyApiToken(authToken);
    if (userId) {
      return userId;
    }
  }

  const legacyUserId = normalizeHeaderValue(req.header('x-user-id'))?.trim();
  if (!legacyUserId?.length) {
    return undefined;
  }

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return legacyUserId;
  }

  return undefined;
};
