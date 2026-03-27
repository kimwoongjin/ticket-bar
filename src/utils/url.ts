export const toSafeNextPath = (value: string | null, fallbackPath: string): string => {
  if (!value) {
    return fallbackPath;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallbackPath;
  }

  return value;
};
