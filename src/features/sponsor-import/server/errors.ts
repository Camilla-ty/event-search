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

export function uniqueViolationUserMessage(message: string): string {
  if (message.includes("sponsor_import_batches_one_active_per_edition")) {
    return "This edition already has an active import in progress. Resume or discard it before starting another.";
  }

  if (message.includes("sponsor_import_draft_links_batch_company_unique")) {
    return "Draft links for this import are already being created. Wait for the operation to finish — do not click Import to draft again.";
  }

  if (message.includes("event_sponsors_event_editions_id_company_id_unique")) {
    return "This company is already a sponsor on this edition.";
  }

  if (message.includes("companies") && message.includes("slug")) {
    return "A company with this slug already exists.";
  }

  return "A uniqueness constraint was violated. If an action is still running, wait for it to finish before retrying.";
}
