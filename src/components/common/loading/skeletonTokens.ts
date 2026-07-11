/** Shared Tailwind classes for loading primitives and route skeletons. */

export const skeletonFillClass = "bg-slate-200";

export const skeletonSurfaceClass = "bg-slate-100";

export const skeletonBorderClass = "border-slate-200";

export const skeletonPulseWrapperClass = "animate-pulse motion-reduce:animate-none";

export const spinnerSizeClasses = {
  sm: "h-4 w-4",
  md: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

export const spinnerBaseClass =
  "inline-block rounded-full border-2 border-slate-300 border-t-brand-primary animate-spin motion-reduce:animate-none";

export const loadingStatusTextClass = "text-sm text-slate-600";
