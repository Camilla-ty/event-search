export type VenuesListParams = {
  search: string;
  includeArchived: boolean;
};

export function parseIncludeArchivedParam(
  value: string | null | undefined,
): boolean {
  return value === "true";
}

export function parseVenuesListParams(searchParams: URLSearchParams): VenuesListParams {
  return {
    search: (searchParams.get("search") ?? "").trim(),
    includeArchived: parseIncludeArchivedParam(searchParams.get("includeArchived")),
  };
}

export function parseVenuesListParamsFromRecord(
  raw: Record<string, string | undefined>,
): VenuesListParams {
  const searchParams = new URLSearchParams();
  if (raw.search !== undefined) {
    searchParams.set("search", raw.search);
  }
  if (raw.includeArchived !== undefined) {
    searchParams.set("includeArchived", raw.includeArchived);
  }
  return parseVenuesListParams(searchParams);
}

export function buildVenuesListSearchParams(params: VenuesListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  const trimmedSearch = params.search.trim();
  if (trimmedSearch !== "") {
    searchParams.set("search", trimmedSearch);
  }
  if (params.includeArchived) {
    searchParams.set("includeArchived", "true");
  }
  return searchParams;
}

export function buildVenuesListParamsKey(params: VenuesListParams): string {
  return `${params.includeArchived ? "1" : "0"}\0${params.search.trim()}`;
}
