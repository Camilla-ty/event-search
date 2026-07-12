export type EditionsListParams = {
  missingWebsite: boolean;
  missingDates: boolean;
  missingCity: boolean;
};

export type EditionsListFilter = "all" | "missingWebsite" | "missingDates" | "missingCity";

export function parseMissingFlag(value: string | null | undefined): boolean {
  return value === "1";
}

export function parseEditionsListParams(searchParams: URLSearchParams): EditionsListParams {
  return {
    missingWebsite: parseMissingFlag(searchParams.get("missingWebsite")),
    missingDates: parseMissingFlag(searchParams.get("missingDates")),
    missingCity: parseMissingFlag(searchParams.get("missingCity")),
  };
}

export function parseEditionsListParamsFromRecord(
  raw: Record<string, string | undefined>,
): EditionsListParams {
  const searchParams = new URLSearchParams();
  if (raw.missingWebsite !== undefined) {
    searchParams.set("missingWebsite", raw.missingWebsite);
  }
  if (raw.missingDates !== undefined) {
    searchParams.set("missingDates", raw.missingDates);
  }
  if (raw.missingCity !== undefined) {
    searchParams.set("missingCity", raw.missingCity);
  }
  return parseEditionsListParams(searchParams);
}

export function buildEditionsListSearchParams(params: EditionsListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params.missingWebsite) {
    searchParams.set("missingWebsite", "1");
  }
  if (params.missingDates) {
    searchParams.set("missingDates", "1");
  }
  if (params.missingCity) {
    searchParams.set("missingCity", "1");
  }
  return searchParams;
}

export function buildEditionsListParamsKey(params: EditionsListParams): string {
  return `${params.missingWebsite ? "1" : "0"}\0${params.missingDates ? "1" : "0"}\0${params.missingCity ? "1" : "0"}`;
}
