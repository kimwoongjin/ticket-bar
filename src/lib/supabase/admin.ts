import { createClient } from '@supabase/supabase-js';

import { env } from '@/utils/env';
import { getServerEnv } from '@/utils/server-env';

export const createAdminClient = () => {
  const { supabaseServiceRoleKey } = getServerEnv();

  return createClient(env.supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
