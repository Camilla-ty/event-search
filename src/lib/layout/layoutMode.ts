export type LayoutMode = "marketing" | "app" | "admin" | "auth";

export function isSidebarLayoutMode(mode: LayoutMode): boolean {
  return mode === "marketing" || mode === "app";
}
