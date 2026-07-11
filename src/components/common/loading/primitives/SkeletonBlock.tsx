import {
  skeletonFillClass,
  skeletonSurfaceClass,
} from "@/src/components/common/loading/skeletonTokens";

type SkeletonBlockRounded = "sm" | "md" | "lg" | "xl" | "full" | "none";

type SkeletonBlockTone = "fill" | "surface";

const roundedClasses: Record<SkeletonBlockRounded, string> = {
  sm: "rounded-sm",
  md: "rounded",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
  none: "",
};

export type SkeletonBlockProps = {
  className?: string;
  rounded?: SkeletonBlockRounded;
  tone?: SkeletonBlockTone;
  as?: "div" | "span";
};

export function SkeletonBlock({
  className = "",
  rounded = "md",
  tone = "fill",
  as: Tag = "div",
}: SkeletonBlockProps) {
  const fillClass = tone === "surface" ? skeletonSurfaceClass : skeletonFillClass;

  return (
    <Tag
      aria-hidden="true"
      className={[roundedClasses[rounded], fillClass, className].filter(Boolean).join(" ")}
    />
  );
}
