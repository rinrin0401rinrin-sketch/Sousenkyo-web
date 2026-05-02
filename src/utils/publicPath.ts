export function publicPath(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:|mailto:|tel:)/i.test(path)) return path;

  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}
