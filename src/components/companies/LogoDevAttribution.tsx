export function LogoDevAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-400 ${className}`.trim()}>
      Logos provided by{" "}
      <a
        href="https://www.logo.dev"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-slate-300 underline-offset-2 hover:text-slate-500"
      >
        Logo.dev
      </a>
    </p>
  );
}
