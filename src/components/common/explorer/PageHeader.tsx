export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-2 border-b border-slate-200 pb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
    </header>
  );
}
