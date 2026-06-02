"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/src/components/common";
import { fetchAuthUserExists } from "@/src/lib/auth/fetchAuthUserExists";
import { createClient } from "@/src/lib/supabase/client";

type Step = "credentials" | "verify";

export type EmailOtpAuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill email when opened from login "Sign up instead". */
  initialEmail?: string;
  title?: string;
  description?: string;
};

export function EmailOtpAuthModal({
  open,
  onClose,
  onSuccess,
  initialEmail = "",
  title = "Sign up",
  description = "Create your account with email and display name. We will send a one-time verification code.",
}: EmailOtpAuthModalProps) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("credentials");
      setEmail("");
      setDisplayName("");
      setOtp("");
      setError(null);
      setIsSubmitting(false);
      return;
    }

    const prefilled = initialEmail.trim();
    if (prefilled) {
      setEmail(prefilled);
    }
  }, [open, initialEmail]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    if (!trimmedEmail) {
      setError("Email is required.");
      setIsSubmitting(false);
      return;
    }
    if (!trimmedDisplayName) {
      setError("Display name is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: checkError } = await fetchAuthUserExists(trimmedEmail);
      if (checkError) {
        setError(checkError);
        return;
      }

      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          data: { display_name: trimmedDisplayName },
        },
      });

      if (otpError) {
        setError(otpError.message);
        return;
      }

      setStep("verify");
    } catch (sendError) {
      const message =
        sendError instanceof Error && sendError.message.trim() !== ""
          ? sendError.message.trim()
          : "Could not send verification code.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const token = otp.trim();

    if (!trimmedEmail || token === "") {
      setError("Enter the code from your email.");
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      if (!data.session) {
        setError("Verification succeeded but no session was created. Try again.");
        return;
      }

      onSuccess();
      onClose();
    } catch (verifyFailure) {
      const message =
        verifyFailure instanceof Error && verifyFailure.message.trim() !== ""
          ? verifyFailure.message.trim()
          : "Verification failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <ModalPanel ariaLabelledBy="email-otp-auth-title" onClose={onClose}>
        <header className="space-y-1 pr-6">
          <h2
            id="email-otp-auth-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </header>

        {step === "credentials" ? (
          <form onSubmit={handleSendOtp} className="mt-5 space-y-4" noValidate>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Display name
              </span>
              <input
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Your name"
              />
            </label>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Sending code…" : "Send verification code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4" noValidate>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter the code sent to <span className="font-medium">{email.trim()}</span>.
            </p>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                required
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tracking-widest outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="123456"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:flex-1">
                {isSubmitting ? "Verifying…" : "Verify and continue"}
              </Button>
            </div>
          </form>
        )}

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100">
            {error}
          </div>
        ) : null}
      </ModalPanel>
    </div>
  );
}

function ModalPanel({
  children,
  ariaLabelledBy,
  onClose,
}: {
  children: ReactNode;
  ariaLabelledBy: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 text-xl leading-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        ×
      </button>
      {children}
    </div>
  );
}
