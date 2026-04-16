const statusMap = {
  confirmed: { label: "Confirmado", className: "badge-confirmed" },
  pending: { label: "Pendiente", className: "badge-pending" },
  fallen: { label: "Sin cubrir", className: "badge-fallen" },
  caido: { label: "Caído", className: "badge-fallen" },
  process: { label: "En proceso", className: "badge-process" },
  covered: { label: "Cubierto", className: "badge-covered" },
  free: { label: "Libre", className: "badge-free" },
} as const;

export type TurnoStatus = keyof typeof statusMap;

export function StatusBadge({ status }: { status: TurnoStatus }) {
  const s = statusMap[status];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
