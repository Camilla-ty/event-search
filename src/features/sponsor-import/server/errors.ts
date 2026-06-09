export class SponsorImportHttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "SponsorImportHttpError";
    this.status = status;
    this.details = details;
  }
}

export function isUniqueViolation(message: string): boolean {
  return (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("sponsor_import_batches_one_active_per_edition")
  );
}
