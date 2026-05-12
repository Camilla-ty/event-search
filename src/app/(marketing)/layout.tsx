import { SearchBar } from "@/src/components/common";
import { MainNav } from "@/src/components/layout/MainNav";

type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 w-64">
        <MainNav />
      </aside>
      <div className="ml-64">
        <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <SearchBar placeholder="Search sponsors or events..." />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
