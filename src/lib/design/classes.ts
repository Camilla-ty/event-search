/** Shared Tailwind class strings for the EventPixels design system. */

export const brandLinkClass =
  "font-medium text-brand-primary transition hover:text-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2";

export const subduedLinkClass =
  "font-medium text-slate-600 transition hover:text-slate-900";

export const navItemActiveClass =
  "border-l-2 border-brand-primary bg-brand-primary-muted pl-[10px] text-brand-primary";

export const navItemInactiveClass =
  "border-l-2 border-transparent pl-3 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900";

/** Desktop sidebar nav item (NavigationShell, AdminShell). */
export const sidebarNavItemBaseClass =
  "flex h-12 min-w-0 items-center gap-3 whitespace-nowrap rounded-lg border-l-2 px-4 text-sm transition";

export const sidebarNavItemActiveClass =
  "border-brand-primary bg-brand-primary-muted font-medium text-brand-primary";

export const sidebarNavItemInactiveClass =
  "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900";

export const mobileNavItemActiveClass =
  "bg-brand-primary-muted font-medium text-brand-primary";

export const mobileNavItemInactiveClass =
  "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

export const surfacePageClass = "min-h-screen bg-surface-page";

export const surfacePanelClass = "border border-slate-200 bg-white";

export const primaryCtaClass =
  "inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2";

export const secondaryCtaClass =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2";

export const formInputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

export const feedbackSuccessClass =
  "rounded-lg border border-brand-success/30 bg-brand-success/10 px-4 py-3 text-sm font-medium text-brand-success";

export const feedbackErrorClass =
  "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900";

export const feedbackWarningClass =
  "rounded-lg border border-brand-warning/40 bg-brand-warning/15 px-4 py-3 text-sm text-amber-950";

export function importFilterChipClass(active: boolean): string {
  return [
    "cursor-pointer rounded-md px-3 py-1.5 text-sm transition",
    active
      ? "bg-brand-primary-muted font-medium text-brand-primary"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200",
  ].join(" ");
}
