export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
