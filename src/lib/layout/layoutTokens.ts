import type { LayoutMode } from "@/src/lib/layout/layoutMode";

export type LayoutTokens = {
  shell: string;
  contentColumn: string;
  main: string;
  page: string;
  searchHeader: string;
};

const tokens: Record<LayoutMode, LayoutTokens> = {
  marketing: {
    shell: "min-h-screen bg-surface-page",
    contentColumn: "ml-0 lg:ml-[15rem]",
    main: "px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
    page: "w-full max-w-[1400px]",
    searchHeader:
      "sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8 lg:py-5",
  },
  app: {
    shell: "min-h-screen bg-surface-page",
    contentColumn: "ml-0 lg:ml-[15rem]",
    main: "px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
    page: "w-full max-w-[1400px]",
    searchHeader:
      "sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8 lg:py-5",
  },
  admin: {
    shell: "min-h-screen bg-surface-page",
    contentColumn: "mx-auto w-full max-w-6xl",
    main: "px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
    page: "w-full",
    searchHeader: "",
  },
  auth: {
    shell: "min-h-screen bg-surface-page",
    contentColumn: "mx-auto flex w-full max-w-md flex-col justify-center",
    main: "px-4 py-8 sm:px-6",
    page: "w-full",
    searchHeader: "",
  },
};

export function getLayoutTokens(mode: LayoutMode): LayoutTokens {
  return tokens[mode];
}
