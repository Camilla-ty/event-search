"use client";

import { useEffect, type ReactNode } from "react";

import { AuthForm } from "@/src/components/auth/AuthForm";

export type EmailOtpAuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill email when opened from login "Sign up instead". */
  initialEmail?: string;
  redirectTo?: string;
  title?: string;
  description?: string;
};

export function EmailOtpAuthModal({
  open,
  onClose,
  onSuccess,
  initialEmail = "",
  redirectTo = "/",
  title = "Sign up",
  description = "Create your account to unlock additional sponsor tiers.",
}: EmailOtpAuthModalProps) {
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

  function handleSuccess() {
    onSuccess();
    onClose();
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

        <div className="mt-5">
          <AuthForm
            initialEmail={initialEmail}
            redirectTo={redirectTo}
            onSuccess={handleSuccess}
            showLoginLink={true}
            idPrefix="modal-auth"
          />
        </div>
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
