export type StorageMirrorObjectSummary = {
  path: string;
  size: number | null;
  updated_at: string | null;
};

export type StorageMirrorManifest = {
  kind: "company-logos-mirror";
  version: 2;
  source: "db_referenced_paths";
  mirrored_at: string;
  bucket: string;
  /** Same as downloaded_count (kept for backward compatibility). */
  object_count: number;
  referenced_path_count: number;
  downloaded_count: number;
  missing_paths: string[];
  skipped_external_url_count: number;
  skipped_invalid_count: number;
  total_bytes: number;
  top_level_prefixes: string[];
  supabase_host: string | null;
  git_sha: string | null;
};

export function topLevelPrefixes(paths: string[]): string[] {
  const prefixes = new Set<string>();
  for (const objectPath of paths) {
    const slash = objectPath.indexOf("/");
    prefixes.add(slash === -1 ? objectPath : objectPath.slice(0, slash));
  }
  return [...prefixes].sort();
}

export function buildStorageMirrorManifest(params: {
  bucket: string;
  mirroredAt: string;
  referencedPathCount: number;
  downloadedObjects: StorageMirrorObjectSummary[];
  missingPaths: string[];
  skippedExternalUrlCount: number;
  skippedInvalidCount: number;
  supabaseHost: string | null;
  gitSha: string | null;
}): StorageMirrorManifest {
  const downloadedPaths = params.downloadedObjects.map((object) => object.path);
  const totalBytes = params.downloadedObjects.reduce(
    (sum, object) => sum + (object.size ?? 0),
    0,
  );

  return {
    kind: "company-logos-mirror",
    version: 2,
    source: "db_referenced_paths",
    mirrored_at: params.mirroredAt,
    bucket: params.bucket,
    object_count: params.downloadedObjects.length,
    referenced_path_count: params.referencedPathCount,
    downloaded_count: params.downloadedObjects.length,
    missing_paths: [...params.missingPaths].sort(),
    skipped_external_url_count: params.skippedExternalUrlCount,
    skipped_invalid_count: params.skippedInvalidCount,
    total_bytes: totalBytes,
    top_level_prefixes: topLevelPrefixes(downloadedPaths),
    supabase_host: params.supabaseHost,
    git_sha: params.gitSha,
  };
}
