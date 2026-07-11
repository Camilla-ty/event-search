import { SkeletonBlock } from "@/src/components/common/loading/primitives/SkeletonBlock";

type SkeletonCircleSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<SkeletonCircleSize, string> = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-24 w-24",
  xl: "h-40 w-40",
};

export type SkeletonCircleProps = {
  className?: string;
  size?: SkeletonCircleSize;
};

export function SkeletonCircle({ className = "", size = "md" }: SkeletonCircleProps) {
  return (
    <SkeletonBlock
      rounded="full"
      className={[sizeClasses[size], className].filter(Boolean).join(" ")}
    />
  );
}
