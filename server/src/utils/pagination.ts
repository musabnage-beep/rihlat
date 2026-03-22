export function parsePagination(page?: number | string, limit?: number | string) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));

  return {
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page?: number | string,
  limit?: number | string,
) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const totalPages = Math.ceil(total / limitNum);

  return {
    data,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
}
