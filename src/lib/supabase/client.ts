import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/utils/env';

export const createClient = () =>
  createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
