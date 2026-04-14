export function AppTopbar({ backLink }: { backLink?: { label: string; href: string } }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
      <div className="flex items-center gap-3">
        {backLink && (
          <>
            <a href={backLink.href} className="text-sm text-muted-foreground hover:text-foreground">
              ‹ {backLink.label}
            </a>
            <div className="h-4 w-px bg-border" />
          </>
        )}
        <span className="text-[15px] font-medium text-foreground">
          turno<span className="text-teal">ok</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Dr. Martín García · Cardiología
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-lighter text-xs font-medium text-teal-dark">
          MG
        </div>
      </div>
    </header>
  );
}
