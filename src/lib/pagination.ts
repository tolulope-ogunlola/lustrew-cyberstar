// Offset pagination helpers for list endpoints.

export type Page = { page: number; pageSize: number; skip: number; take: number };
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; pages: number };

export function parsePage(url: URL, defaultSize = 25, maxSize = 200): Page {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(url.searchParams.get("pageSize")) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(items: T[], total: number, p: Page): Paginated<T> {
  return { items, total, page: p.page, pageSize: p.pageSize, pages: Math.max(1, Math.ceil(total / p.pageSize)) };
}
