import { SearchBar } from "@/src/components/common";
import { NavSessionBar } from "@/src/components/auth/NavSessionBar";
import { MainNav } from "@/src/components/layout/MainNav";
import { getMarketingNavSession } from "@/src/lib/auth/marketingSession";

type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default async function MarketingLayout({ children }: MarketingLayoutProps) {
  const navSession = await getMarketingNavSession();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 w-64">
        <MainNav sessionSlot={<NavSessionBar initial={navSession} />} />
      </aside>
      <div className="ml-64">
        <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SearchBar
              placeholder="Search sponsors or events..."
              className="min-w-0 flex-1"
            />
            <NavSessionBar
              initial={navSession}
              className="border-t border-slate-200 pt-4 lg:border-t-0 lg:pt-0 dark:border-slate-800"
            />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
