export function MetricCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string | number;
  sub: string;
  valueColor?: "teal" | "pending" | "default";
}) {
  const colorClass =
    valueColor === "teal"
      ? "text-teal-dark"
      : valueColor === "pending"
        ? "text-status-pending"
        : "text-foreground";

  return (
    <div className="rounded-lg bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-medium ${colorClass}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
