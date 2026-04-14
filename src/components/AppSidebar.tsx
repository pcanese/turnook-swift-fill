import { Link, useLocation } from "@tanstack/react-router";

const navSections = [
  {
    label: "Principal",
    items: [
      { title: "Agenda", href: "/", badge: null },
      { title: "Lista de espera", href: "/lista-espera", badge: { count: 7, color: "bg-status-pending text-status-pending-bg" } },
      { title: "Pacientes", href: "/pacientes", badge: null },
    ],
  },
  {
    label: "Actividad",
    items: [
      { title: "Notificaciones", href: "/notificaciones", badge: { count: 2, color: "bg-status-fallen text-white" } },
      { title: "Historial", href: "/historial", badge: null },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configuración", href: "/configuracion", badge: null },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-[200px] shrink-0 border-r border-border bg-card md:block">
      <nav className="py-4">
        {navSections.map((section) => (
          <div key={section.label} className="mb-2 px-3">
            <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 rounded-md px-2 py-[7px] text-[13px] transition-colors ${
                    isActive
                      ? "bg-teal-lighter font-medium text-teal-dark"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isActive ? "bg-teal" : "bg-current opacity-40"
                    }`}
                  />
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${item.badge.color}`}
                    >
                      {item.badge.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
