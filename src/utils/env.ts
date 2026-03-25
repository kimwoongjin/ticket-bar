type PublicEnvKey = 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

const getRequiredEnv = (key: PublicEnvKey): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  supabaseUrl: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
} as const;
