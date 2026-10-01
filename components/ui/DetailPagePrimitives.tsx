import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DetailTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

export function DetailTabs({
  ariaLabel,
  tabs,
  activeTab,
  onChange,
}: {
  ariaLabel: string;
  tabs: DetailTab[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <nav aria-label={ariaLabel} className="mx-auto flex max-w-[1280px] items-center gap-1.5 overflow-x-auto px-4 py-3 sm:px-6 lg:px-10">
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex h-11 shrink-0 items-center gap-2 rounded border bg-white px-4 text-[12px] font-medium transition active:scale-[.98] ${
                active
                  ? "border-[#7259B5]/40 text-[#7259B5]"
                  : "border-transparent text-black/40 hover:bg-black/[.04] hover:text-black/60"
              }`}
            >
              {Icon && <Icon size={13} strokeWidth={1.8} />}
              {label}
              {typeof count === "number" && count > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7259B5]/10 px-1 text-[9px] font-bold text-[#7259B5]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function DetailHeaderAction({
  label,
  icon: Icon,
  onClick,
  href,
  accent = false,
  tone,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  accent?: boolean;
  tone?: "purple" | "amber" | "black";
}) {
  const resolvedTone = tone ?? (accent ? "purple" : undefined);
  const className = `inline-flex h-11 items-center gap-2 rounded border bg-white px-4 text-[12px] font-medium transition hover:bg-black/[.04] active:scale-[.98] ${
    resolvedTone === "amber" ? "border-[#B07A14]/35 text-[#B07A14]" : resolvedTone === "purple" ? "border-[#7259B5]/30 text-[#7259B5]" : resolvedTone === "black" ? "border-black/[.15] text-black" : "border-black/[.12] text-black/55"
  }`;
  const content = <><Icon size={14} strokeWidth={1.8} />{label}</>;

  if (href) return <a href={href} className={className}>{content}</a>;
  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

export function DetailPageContent({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-10">{children}</main>;
}

export function DetailSidebarCard({ title, icon: Icon, count, action, variant = "default", children }: {
  title: string; icon?: LucideIcon; count?: number; action?: ReactNode; variant?: "primary" | "default"; children: ReactNode;
}) {
  const isPrimary = variant === "primary";
  return (
    <section
      className={`rounded border p-4 ${isPrimary ? "bg-black/[.02]" : "bg-white"}`}
      style={{ borderColor: isPrimary ? "rgba(13,13,13,.12)" : "rgba(13,13,13,.08)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={12} className="text-black/30" />}
          <h3 className={`text-[11px] font-semibold ${isPrimary ? "text-black/60" : "text-black/45"}`}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {typeof count === "number" && <span className="text-[10px] tabular-nums text-black/25">{count}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Link de volta para a lista da seção, no mesmo formato em todas as páginas de detalhe. */
export function DetailBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[12px] font-medium text-black/40 transition hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
      <ArrowLeft size={14} aria-hidden="true" /> {label}
    </Link>
  );
}

/** Esqueleto de carregamento com a mesma largura e cabeçalho da página final. */
export function DetailPageSkeleton({ sidebar = true }: { sidebar?: boolean }) {
  return (
    <div className="min-h-full" aria-busy="true" aria-label="Carregando">
      <div className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-[1280px] animate-pulse space-y-4 px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <div className="h-4 w-24 rounded bg-black/[.06]" />
          <div className="h-10 w-72 max-w-full rounded bg-black/[.06]" />
          <div className="h-4 w-48 rounded bg-black/[.05]" />
        </div>
      </div>
      <div className={`mx-auto grid max-w-[1280px] animate-pulse gap-6 px-4 py-7 sm:px-6 lg:px-10 ${sidebar ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
        <div className="space-y-4">{[0, 1, 2].map(index => <div key={index} className="h-32 rounded bg-black/[.04]" />)}</div>
        {sidebar && <div className="hidden space-y-4 lg:block">{[0, 1].map(index => <div key={index} className="h-40 rounded bg-black/[.04]" />)}</div>}
      </div>
    </div>
  );
}

/** Registro inexistente, removido ou sem acesso: explica e devolve à lista. */
export function DetailNotFound({ title, description, backHref, backLabel }: { title: string; description?: string; backHref: string; backLabel: string }) {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-9">
        <DetailBackLink href={backHref} label={backLabel} />
        <div className="py-20 text-center">
          <p className="text-[15px] font-semibold text-black/45">{title}</p>
          <p className="mt-1.5 text-[13px] text-black/30">{description ?? "O registro pode ter sido removido ou você não tem acesso a ele."}</p>
        </div>
      </div>
    </div>
  );
}
