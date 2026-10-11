export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export function getPagination(query: Record<string, unknown>, defaultLimit = 12): Pagination {
  const page = Math.max(1, Number(query.page) || 1);
  const rawLimit = Number(query.limit) || defaultLimit;
  const limit = Math.min(50, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginated<T>(items: T[], total: number, { page, limit }: Pagination): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
