type StatCardProps = {
  title: string;
  value: number;
  accent?: "slate" | "amber" | "emerald" | "rose";
};

function getAccentClasses(accent: StatCardProps["accent"] = "slate") {
  if (accent === "amber") {
    return {
      dot: "bg-amber-500",
      ring: "ring-amber-100",
    };
  }

  if (accent === "emerald") {
    return {
      dot: "bg-emerald-500",
      ring: "ring-emerald-100",
    };
  }

  if (accent === "rose") {
    return {
      dot: "bg-rose-500",
      ring: "ring-rose-100",
    };
  }

  return {
    dot: "bg-slate-700",
    ring: "ring-slate-200",
  };
}

export function StatCard({
  title,
  value,
  accent = "slate",
}: StatCardProps) {
  const styles = getAccentClasses(accent);

  return (
    <div
      className={`premium-card-hover premium-shell rounded-[28px] p-5 ring-1 ${styles.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="premium-kicker text-[11px] text-slate-500 md:text-[12px]">{title}</div>
          <div className="premium-number mt-2 text-3xl font-semibold text-slate-900 md:text-4xl">
            {value}
          </div>
        </div>

        <div className={`h-3 w-3 rounded-full ${styles.dot}`} />
      </div>
    </div>
  );
}
