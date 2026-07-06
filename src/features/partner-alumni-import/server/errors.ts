export class PartnerAlumniImportHttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "PartnerAlumniImportHttpError";
    this.status = status;
    this.details = details;
  }
}

export function isUniqueViolation(message: string): boolean {
  return (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("pai_batches_one_active_per_version")
  );
}

export function uniqueViolationUserMessage(message: string): string {
  if (message.includes("pai_batches_one_active_per_version")) {
    return "This version already has an active import in progress. Resume or discard it before starting another.";
  }

  return "A uniqueness constraint was violated. If an action is still running, wait for it to finish before retrying.";
}
