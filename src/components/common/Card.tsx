import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={[
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["mb-3 space-y-1", className].filter(Boolean).join(" ")} {...props} />
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h3
      className={["text-base font-semibold text-slate-900", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={["text-sm text-slate-600", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}
