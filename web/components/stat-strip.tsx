import { cn } from "@/lib/utils";

export type Stat = { label: string; value: string | number; note?: string; tone?: "late"; onClick?: () => void; active?: boolean };

// Four numbers in one container, divided by hairlines. A cell can act as a filter.
export function StatStrip({ items, compact }: { items: Stat[]; compact?: boolean }) {
  return (
    <section aria-label="Overview" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-[var(--lift)] md:grid-cols-4">
      {items.map((s) => {
        const body = (
          <>
            <span className="text-[13px] text-muted-foreground">{s.label}</span>
            <span className={cn("leading-none font-medium tracking-[-0.03em] tabular", compact ? "text-[28px]" : "text-[32px]", s.tone === "late" && "text-late")}>{s.value}</span>
            {s.note && <span className="text-xs text-muted-foreground">{s.note}</span>}
          </>
        );
        const cls = cn("grid content-between bg-card text-left transition-colors duration-150", compact ? "gap-2.5 p-4" : "gap-3 p-5", s.onClick && "hover:bg-secondary/60", s.active && "bg-secondary/70");
        return s.onClick
          ? <button key={s.label} type="button" onClick={s.onClick} aria-pressed={s.active} className={cls}>{body}</button>
          : <div key={s.label} className={cls}>{body}</div>;
      })}
    </section>
  );
}
