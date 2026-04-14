import { AppTopbar } from "./AppTopbar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout({
  children,
  backLink,
  rightPanel,
}: {
  children: React.ReactNode;
  backLink?: { label: string; href: string };
  rightPanel?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppTopbar backLink={backLink} />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 bg-muted p-5">{children}</main>
        {rightPanel && (
          <aside className="hidden w-[240px] shrink-0 border-l border-border bg-card p-4 lg:block">
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
