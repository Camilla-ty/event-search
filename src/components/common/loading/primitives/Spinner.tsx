import {
  spinnerBaseClass,
  spinnerSizeClasses,
} from "@/src/components/common/loading/skeletonTokens";

export type SpinnerSize = keyof typeof spinnerSizeClasses;

export type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
  /** When set, spinner is exposed to assistive tech instead of aria-hidden. */
  label?: string;
};

export function Spinner({ size = "md", className = "", label }: SpinnerProps) {
  const classes = [spinnerBaseClass, spinnerSizeClasses[size], className]
    .filter(Boolean)
    .join(" ");

  if (label !== undefined && label.trim() !== "") {
    return <span className={classes} role="img" aria-label={label} />;
  }

  return <span className={classes} aria-hidden="true" />;
}
