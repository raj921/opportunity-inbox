import { NumberTicker } from "@/components/motion/number-ticker";
import { cn } from "@/lib/utils";

export type Stat = { label: string; value: string | number; note?: string; accent?: "gold" | "rose" | "sky" | "mint" | "lilac"; onClick?: () => void; active?: boolean };

const FILL = { gold: "bg-gold", rose: "bg-rose", sky: "bg-sky", mint: "bg-mint", lilac: "bg-lilac" };

// One tile per number. A tile takes its accent only when it has something to say; a tile can act as a filter.
export function StatStrip({ items, compact }: { items: Stat[]; compact?: boolean }) {
  return (
    <section aria-label="Overview" className={cn("grid gap-2.5", items.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
      {items.map((s) => {
        const body = (
          <>
            <span className={cn("eyebrow [overflow-wrap:anywhere]", s.accent && "!text-ink")}>{s.label}</span>
            <span className={cn("font-heading leading-none font-bold tracking-[-0.03em] tabular", compact ? "text-[28px] sm:text-[32px]" : "text-[32px] sm:text-[36px]")}>{typeof s.value === "number" ? <NumberTicker value={s.value} startOnView={false} duration={0.7} /> : s.value}</span>
            {s.note && <span className={cn("text-xs leading-4 [overflow-wrap:anywhere]", s.accent ? "text-ink" : "text-muted-foreground")}>{s.note}</span>}
          </>
        );
        const cls = cn("grid min-w-0 content-between rounded-2xl border border-transparent text-left transition-[transform,box-shadow] duration-300 ease-[var(--ease-snap)]", s.accent ? [FILL[s.accent], "text-ink"] : "border-border bg-card", compact ? "gap-2 px-3 py-3 sm:px-4" : "gap-2.5 p-3 sm:p-4", s.onClick && "hover:-translate-y-0.5", s.active && "shadow-[inset_0_0_0_1.5px_var(--foreground)]");
        return s.onClick
          ? <button key={s.label} type="button" onClick={s.onClick} aria-pressed={s.active} className={cls}>{body}</button>
          : <div key={s.label} className={cls}>{body}</div>;
      })}
    </section>
  );
}
