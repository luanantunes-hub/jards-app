"use client";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, ListChecks, LayoutGrid, DollarSign, FileText, Landmark, CalendarDays, BookOpen, Ticket, Megaphone, Target, Package, Send } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import type { StatusPrestacao } from "@/lib/supabase/types";


export default function PrestacaoLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [titulo, setTitulo] = useState<string>("");
  const [status, setStatus] = useState<StatusPrestacao | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("prestacoes_contas")
      .select("titulo, status")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) { setTitulo(data.titulo); setStatus(data.status); }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Com muitas abas, a linha rola: a aba ativa entra na vista.
  const abasRef = useRef<HTMLElement>(null);
  useEffect(() => {
    abasRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const base = `/prestacoes/${id}`;
  const tabs = [
    { href: base,                    label: "Visão geral",  icon: LayoutGrid, exact: true },
    { href: `${base}/orcamento`,     label: "Orçamento",   icon: DollarSign, exact: false },
    { href: `${base}/comprovantes`,  label: "Comprovantes", icon: FileText,    exact: false },
    { href: `${base}/extrato`,       label: "Extrato",      icon: Landmark,    exact: false },
    { href: `${base}/conciliacao`,   label: "Conciliação",  icon: ArrowLeftRight, exact: false },
    { href: `${base}/pendencias`,    label: "Pendências",   icon: ListChecks,  exact: false },
    { href: `${base}/objeto`,        label: "Objeto",       icon: Target,      exact: false },
    { href: `${base}/atividades`,    label: "Atividades",   icon: CalendarDays, exact: false },
    { href: `${base}/relatorio`,     label: "Relatório",    icon: BookOpen,    exact: false },
    { href: `${base}/distribuicao`,  label: "Distribuição", icon: Ticket,      exact: false },
    { href: `${base}/bens`,          label: "Bens",         icon: Package,     exact: false },
    { href: `${base}/divulgacao`,    label: "Divulgação",   icon: Megaphone,   exact: false },
    { href: `${base}/envio`,         label: "Envio",        icon: Send,        exact: false },
  ];

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="min-h-full" style={{ background: "#F2F2F2" }}>
      {/* Header fixo */}
      <div className="bg-white border-b px-8 pt-6 pb-0" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <button
          onClick={() => router.push("/prestacoes")}
          className="flex items-center gap-1.5 text-[0.6875rem] text-black/40 hover:text-black/70 transition mb-3"
        >
          <ArrowLeft size={12} /> Prestações
        </button>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="font-bold text-[1.25rem] text-[#0D0D0D] truncate">{titulo || "…"}</h1>
          {status && <StatusBadge status={status} size="sm" />}
        </div>
        {/* Abas: no celular a linha rola na horizontal, sem quebrar o rótulo. */}
        <nav ref={abasRef} aria-label="Seções da prestação" className="flex gap-0 overflow-x-auto">
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-[0.75rem] font-medium border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]"
                style={{
                  borderColor: active ? "#7259B5" : "transparent",
                  color: active ? "#7259B5" : "rgba(13,13,13,.45)",
                }}
              >
                <Icon size={13} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo */}
      <div>{children}</div>
    </div>
  );
}
