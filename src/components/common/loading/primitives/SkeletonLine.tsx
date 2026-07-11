import { skeletonFillClass } from "@/src/components/common/loading/skeletonTokens";

type SkeletonLineSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<SkeletonLineSize, string> = {
  xs: "h-3",
  sm: "h-4",
  md: "h-5",
  lg: "h-8",
};

export type SkeletonLineProps = {
  className?: string;
  size?: SkeletonLineSize;
  as?: "div" | "span";
};

export function SkeletonLine({
  className = "",
  size = "sm",
  as: Tag = "div",
}: SkeletonLineProps) {
  return (
    <Tag
      aria-hidden="true"
      className={["rounded", skeletonFillClass, sizeClasses[size], className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
