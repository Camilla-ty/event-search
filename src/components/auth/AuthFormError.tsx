export function AuthFormError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100">
      {message}
    </div>
  );
}
