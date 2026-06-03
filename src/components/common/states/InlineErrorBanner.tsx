import { feedbackErrorClass, feedbackSuccessClass, feedbackWarningClass } from "@/src/lib/design/classes";

type InlineBannerVariant = "error" | "success" | "warning";

const variantClass: Record<InlineBannerVariant, string> = {
  error: feedbackErrorClass,
  success: feedbackSuccessClass,
  warning: feedbackWarningClass,
};

export function InlineErrorBanner({
  message,
  variant = "error",
  className,
}: {
  message: string;
  variant?: InlineBannerVariant;
  className?: string;
}) {
  if (!message.trim()) {
    return null;
  }

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={[variantClass[variant], className].filter(Boolean).join(" ")}
    >
      {message}
    </div>
  );
}
