import Link from "next/link";

import { primaryCtaClass } from "@/src/lib/design/classes";
import { BRAND_NAME } from "@/src/lib/design/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page does not exist on {BRAND_NAME}, or it may have been moved.
        </p>
        <div className="mt-6">
          <Link href="/" className={primaryCtaClass}>
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}
