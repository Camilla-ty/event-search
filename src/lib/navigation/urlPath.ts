/** Build a same-origin relative URL from pathname + search params. */
export function buildPathWithSearchParams(
  pathname: string,
  params: URLSearchParams,
): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** True when two relative URLs represent the same pathname + query. */
export function areSameDocumentUrls(left: string, right: string): boolean {
  return left === right;
}
