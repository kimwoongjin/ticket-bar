import type { NextRequest } from 'next/server';

export const toSafeNextPath = (value: string | null, fallbackPath: string): string => {
  if (!value) {
    return fallbackPath;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallbackPath;
  }

  return value;
};

export const resolveRequestOrigin = (request: NextRequest): string => {
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
};
