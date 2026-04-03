import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { resolveUserMembership } from '@/lib/supabase/couple-membership';
import { env } from '@/utils/env';

const AUTH_ROUTES = ['/login', '/signup'] as const;
const PROTECTED_ROUTE_PREFIXES = [
  '/home',
  '/tickets',
  '/logs',
  '/stats',
  '/settings',
  '/onboarding',
] as const;
const ONBOARDING_ROUTES = ['/onboarding'] as const;
const ISSUER_ONLY_ROUTES = ['/settings/rules'] as const;

const isRouteMatch = (pathname: string, routes: readonly string[]): boolean => {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
};

const isAuthRoute = (pathname: string): boolean => {
  return isRouteMatch(pathname, AUTH_ROUTES);
};

const isProtectedRoute = (pathname: string): boolean => {
  return isRouteMatch(pathname, PROTECTED_ROUTE_PREFIXES);
};

const isOnboardingRoute = (pathname: string): boolean => {
  return isRouteMatch(pathname, ONBOARDING_ROUTES);
};

const isIssuerOnlyRoute = (pathname: string): boolean => {
  return isRouteMatch(pathname, ISSUER_ONLY_ROUTES);
};

const createRedirectResponse = (
  request: NextRequest,
  currentResponse: NextResponse,
  pathname: string,
  nextPath?: string,
): NextResponse => {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = '';

  if (nextPath) {
    redirectUrl.searchParams.set('next', nextPath);
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);

  currentResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      redirectResponse.headers.append(key, value);
    }
  });

  return redirectResponse;
};

export const updateSession = async (request: NextRequest): Promise<NextResponse> => {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedRoute(pathname)) {
      const nextPath = `${pathname}${search}`;
      return createRedirectResponse(request, response, '/login', nextPath);
    }

    return response;
  }

  const { membership } = await resolveUserMembership(supabase, user.id);

  const isConnected = membership?.status === 'active';
  const role = membership?.role;

  if (isAuthRoute(pathname)) {
    return createRedirectResponse(request, response, isConnected ? '/home' : '/onboarding');
  }

  if (!isProtectedRoute(pathname)) {
    return response;
  }

  if (!isConnected && !isOnboardingRoute(pathname)) {
    return createRedirectResponse(request, response, '/onboarding');
  }

  if (isConnected && isOnboardingRoute(pathname)) {
    return createRedirectResponse(request, response, '/home');
  }

  if (isIssuerOnlyRoute(pathname) && role !== 'issuer') {
    return createRedirectResponse(request, response, '/settings');
  }

  return response;
};
