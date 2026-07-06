export class PartnerAlumniAdminError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "PartnerAlumniAdminError";
    this.status = status;
  }
}

export const DUPLICATE_PARTNER_ALUMNI_MEMBER_MESSAGE =
  "This company is already on this Partner Alumni version.";

export const DELETE_CURRENT_VERSION_MESSAGE =
  "Cannot delete the current version. Set another version as current first.";

export const SET_CURRENT_ZERO_MEMBERS_MESSAGE =
  "Cannot set as current: the version has no companies.";

export const VERSION_NOT_FOUND_MESSAGE = "Partner Alumni version not found.";

export const PROGRAM_NOT_FOUND_MESSAGE = "Partner Alumni program not found.";

export function mapPartnerAlumniAdminError(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof PartnerAlumniAdminError) {
    return { message: error.message, status: error.status };
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message === DUPLICATE_PARTNER_ALUMNI_MEMBER_MESSAGE ? 409 : 500;
  return { message, status };
}
