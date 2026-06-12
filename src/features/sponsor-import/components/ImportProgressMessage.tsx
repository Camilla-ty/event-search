type ImportProgressMessageProps = {
  message: string;
};

export function ImportProgressMessage({ message }: ImportProgressMessageProps) {
  return (
    <p
      className="flex items-center gap-2 text-sm text-slate-600"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-primary"
        aria-hidden
      />
      {message}
    </p>
  );
}
