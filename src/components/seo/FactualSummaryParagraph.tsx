type FactualSummaryParagraphProps = {
  summary: string;
  className?: string;
};

/** Visible on-page factual summary (IR2). Server-rendered plain text only. */
export function FactualSummaryParagraph({
  summary,
  className,
}: FactualSummaryParagraphProps) {
  const trimmed = summary.trim();
  if (trimmed === "") return null;

  return (
    <p
      className={
        className ?? "text-sm leading-relaxed text-slate-700"
      }
    >
      {trimmed}
    </p>
  );
}
