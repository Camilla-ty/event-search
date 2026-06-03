"use client";

import { useRouter } from "next/navigation";

export function LoginBackLink() {
  const router = useRouter();

  function handleBack() {
    const referrer = document.referrer;
    let sameOriginReferrer = false;
    if (referrer) {
      try {
        sameOriginReferrer =
          new URL(referrer).origin === window.location.origin;
      } catch {
        sameOriginReferrer = false;
      }
    }

    if (sameOriginReferrer && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-6 text-sm font-medium text-slate-600 transition hover:text-slate-900"
    >
      ← Back
    </button>
  );
}
