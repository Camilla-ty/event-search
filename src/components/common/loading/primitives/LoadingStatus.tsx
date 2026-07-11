import { Spinner, type SpinnerSize } from "@/src/components/common/loading/primitives/Spinner";
import { loadingStatusTextClass } from "@/src/components/common/loading/skeletonTokens";

export type LoadingStatusProps = {
  message: string;
  showSpinner?: boolean;
  spinnerSize?: SpinnerSize;
  className?: string;
  live?: "polite" | "off";
  as?: "p" | "div";
};

export function LoadingStatus({
  message,
  showSpinner = true,
  spinnerSize = "md",
  className = "",
  live = "polite",
  as: Tag = "p",
}: LoadingStatusProps) {
  return (
    <Tag
      className={["flex items-center gap-2", loadingStatusTextClass, className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live={live}
    >
      {showSpinner ? <Spinner size={spinnerSize} /> : null}
      {message}
    </Tag>
  );
}
