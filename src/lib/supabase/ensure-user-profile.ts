import type { SupabaseClient, User } from '@supabase/supabase-js';

interface EnsureUserProfileResult {
  ok: boolean;
  error?: string;
}

const toAuthProvider = (user: User): 'google' | 'email' => {
  const provider = user.app_metadata?.provider;

  if (provider === 'google') {
    return 'google';
  }

  return 'email';
};

const toDisplayName = (user: User): string => {
  const fromName = user.user_metadata?.name;
  if (typeof fromName === 'string' && fromName.trim()) {
    return fromName.trim();
  }

  const fromFullName = user.user_metadata?.full_name;
  if (typeof fromFullName === 'string' && fromFullName.trim()) {
    return fromFullName.trim();
  }

  if (user.email) {
    const emailPrefix = user.email.split('@')[0]?.trim();
    if (emailPrefix) {
      return emailPrefix;
    }
  }

  return `user-${user.id.slice(0, 8)}`;
};

const toAvatarUrl = (user: User): string | null => {
  const avatarUrl = user.user_metadata?.avatar_url;
  if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
    return avatarUrl.trim();
  }

  const pictureUrl = user.user_metadata?.picture;
  if (typeof pictureUrl === 'string' && pictureUrl.trim()) {
    return pictureUrl.trim();
  }

  return null;
};

export const ensurePublicUserProfile = async (
  supabase: SupabaseClient,
  user: User,
): Promise<EnsureUserProfileResult> => {
  if (!user.email) {
    return {
      ok: false,
      error: 'Authenticated user email is missing.',
    };
  }

  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      name: toDisplayName(user),
      avatar_url: toAvatarUrl(user),
      auth_provider: toAuthProvider(user),
    },
    { onConflict: 'id' },
  );

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return { ok: true };
};
