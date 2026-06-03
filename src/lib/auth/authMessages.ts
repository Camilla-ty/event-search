/** Policy-locked auth UX copy (login/signup entry points). */

export const LOGIN_ACCOUNT_NOT_FOUND_MESSAGE =
  "No account found. Please sign up first.";

export const SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE =
  "This email is already registered!";

/** Query param on /login after signup detects an existing email. */
export const AUTH_NOTICE_EMAIL_ALREADY_REGISTERED = "email_already_registered";

export const AUTH_EMAIL_REQUIRED = "Email is required.";

export const AUTH_DISPLAY_NAME_REQUIRED = "Display name is required.";

export const AUTH_OTP_CODE_REQUIRED = "Enter the code from your email.";

export const AUTH_OTP_SEND_FAILED = "Could not send verification code.";

export const AUTH_VERIFY_FAILED = "Verification failed.";

export const AUTH_NO_SESSION_AFTER_VERIFY =
  "Verification succeeded but no session was created. Try again.";

export const AUTH_GOOGLE_START_FAILED = "Could not start Google sign-in.";

export const AUTH_GO_TO_SIGNUP = "Go to sign up";

export const AUTH_GO_TO_LOGIN = "Log in";

export const AUTH_CREATE_ACCOUNT = "Create an account";

export const AUTH_TRY_DIFFERENT_EMAIL = "Try a different email";

export const AUTH_ACCOUNT_VERIFY_FAILED =
  "Could not verify whether an account exists. Please try again.";

export const AUTH_REDIRECTING_TO_LOGIN = "Taking you to log in…";

export const AUTH_REDIRECTING_AFTER_AUTH = "Signing you in…";

export function normalizeAuthCheckError(
  error: string | null | undefined,
): string {
  const trimmed = typeof error === "string" ? error.trim() : "";
  return trimmed !== "" ? trimmed : AUTH_ACCOUNT_VERIFY_FAILED;
}

export function getLoginNoticeMessage(
  notice: string | null | undefined,
): string | null {
  if (notice === AUTH_NOTICE_EMAIL_ALREADY_REGISTERED) {
    return SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE;
  }
  return null;
}
