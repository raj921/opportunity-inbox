import { NumberTicker } from "@/components/motion/number-ticker";
import { cn } from "@/lib/utils";

export type Stat = { label: string; value: string | number; note?: string; accent?: "gold" | "rose" | "sky" | "mint" | "lilac"; onClick?: () => void; active?: boolean };

const FILL = { gold: "bg-gold", rose: "bg-rose", sky: "bg-sky", mint: "bg-mint", lilac: "bg-lilac" };

// One tile per number. A tile takes its accent only when it has something to say; a tile can act as a filter.
export function StatStrip({ items, compact }: { items: Stat[]; compact?: boolean }) {
  return (
    <section aria-label="Overview" className={cn("grid grid-cols-2 gap-2.5", items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {items.map((s) => {
        const body = (
          <>
            <span className={cn("eyebrow", s.accent && "!text-ink")}>{s.label}</span>
            <span className={cn("font-heading leading-none font-bold tracking-[-0.03em] tabular", compact ? "text-[34px]" : "text-[40px]")}>{typeof s.value === "number" ? <NumberTicker value={s.value} startOnView={false} duration={0.7} /> : s.value}</span>
            {s.note && <span className={cn("text-xs", s.accent ? "text-ink" : "text-muted-foreground")}>{s.note}</span>}
          </>
        );
        const cls = cn("grid content-between rounded-2xl text-left transition-[transform,box-shadow] duration-300 ease-[var(--ease-snap)]", s.accent ? [FILL[s.accent], "text-ink"] : "bg-card", compact ? "gap-3 px-4 py-3.5" : "min-h-48 gap-4 p-5", s.onClick && "hover:-translate-y-0.5", s.active && "shadow-[inset_0_0_0_1.5px_var(--foreground)]");
        return s.onClick
          ? <button key={s.label} type="button" onClick={s.onClick} aria-pressed={s.active} className={cls}>{body}</button>
          : <div key={s.label} className={cls}>{body}</div>;
      })}
    </section>
  );
}
