import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="fade-up flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative mb-6">
        <div className="gradient-ring absolute inset-0 rounded-3xl opacity-30 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-ink-800/80 shadow-2xl">
          <Icon className="h-9 w-9 text-violet-300" strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 md:gap-2 xl:grid-cols-6">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="skeleton aspect-square rounded-xl" />
      ))}
    </div>
  );
}
