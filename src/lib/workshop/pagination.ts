/** Pagination helpers for workshop list APIs (shared until Prisma-backed workshop tables exist). */

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
  };
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
  return { page, pageSize };
}
