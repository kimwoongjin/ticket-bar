const getRequiredServerEnv = (key: 'SUPABASE_SERVICE_ROLE_KEY'): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${key}`);
  }

  return value;
};

export const getServerEnv = () => {
  return {
    supabaseServiceRoleKey: getRequiredServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
  } as const;
};
