"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  FileStack,
  Mail,
  Phone,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type PanelTab = "relationship" | "negotiations" | "inscricoes";

export type CompanyPanelCompany = {
  id: string;
  nome: string;
  setor: string | null;
  domain_key: string | null;
  site: string | null;
  tipo: string;
};

type Contact = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
};

type Followup = {
  id: string;
  titulo: string;
  previsto_para: string;
};

type Negotiation = {
  id: string;
  titulo: string | null;
  status: string;
  valor_solicitado: number | null;
  proxima_prospeccao: string | null;
  projeto: { nome: string } | null;
};

type Registration = {
  id: string;
  status: string;
  valor: number | null;
  data_fechamento: string | null;
  projeto: { nome: string } | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  prospeccao: { label: "Prospecção", color: "#777777" },
  primeiro_contato: { label: "1º contato", color: "#2D72B0" },
  proposta_enviada: { label: "Proposta", color: "#B07A14" },
  em_negociacao: { label: "Negociação", color: "#B07A14" },
  aprovado: { label: "Aprovado", color: "#2E8932" },
  ganha: { label: "Ganha", color: "#2E8932" },
  recusado: { label: "Recusado", color: "#D94E4E" },
  reprovado: { label: "Reprovado", color: "#D94E4E" },
  perdido: { label: "Perdido", color: "#D94E4E" },
  cancelado: { label: "Cancelado", color: "#777777" },
  interesse: { label: "Interesse", color: "#7259B5" },
  inscrito: { label: "Inscrito", color: "#2D72B0" },
  em_analise: { label: "Em análise", color: "#B07A14" },
};

function fmtDate(value: string | null) {
  if (!value) return "Sem data";
  return new Date(`${value.split("T")[0]}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function StatusPill({ status }: { status: string }) {
  const item = STATUS[status] ?? { label: status.replaceAll("_", " "), color: "#777777" };
  return (
    <span
      className="rounded-full px-2 py-1 text-[0.5625rem] font-bold uppercase tracking-[.05em]"
      style={{ color: item.color, background: "#fff", border: `1px solid ${item.color}47` }}
    >
      {item.label}
    </span>
  );
}

export function CompanyQuickPanel({ company, onClose }: {
  company: CompanyPanelCompany;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<PanelTab>("relationship");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      supabase.from("contatos").select("id,nome,cargo,email,telefone").eq("empresa_crm_id", company.id).order("score", { ascending: false }),
      supabase.from("crm_followups").select("id,titulo,previsto_para").eq("empresa_crm_id", company.id).eq("status", "pendente").order("previsto_para", { ascending: true }).limit(6),
      supabase.from("captacoes").select("id,titulo,status,valor_solicitado,proxima_prospeccao,projeto:projetos_crm!projeto_id(nome)").eq("empresa_crm_id", company.id).order("updated_at", { ascending: false }),
      supabase.from("editais_user").select("id,status,valor,data_fechamento,projeto:projetos_crm!projeto_id(nome)").eq("empresa_crm_id", company.id).order("updated_at", { ascending: false }),
    ]).then(([contactsResult, followupsResult, negotiationsResult, registrationsResult]) => {
      if (!active) return;
      setContacts((contactsResult.data ?? []) as Contact[]);
      setFollowups((followupsResult.data ?? []) as Followup[]);
      setNegotiations((negotiationsResult.data ?? []) as unknown as Negotiation[]);
      setRegistrations((registrationsResult.data ?? []) as unknown as Registration[]);
      setLoading(false);
    });

    return () => { active = false; };
  }, [company.id, supabase]);

  const tabs = [
    { id: "relationship" as const, label: "Relacionamento", Icon: Users, count: contacts.length },
    { id: "negotiations" as const, label: "Negociações", Icon: BriefcaseBusiness, count: negotiations.length },
    { id: "inscricoes" as const, label: "Inscrições", Icon: FileStack, count: registrations.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center veu" onMouseDown={onClose}>
      <aside
        aria-label={`Painel da empresa ${company.nome}`}
        className="folha-desce flex max-h-[96dvh] w-full max-w-[40rem] flex-col overflow-hidden rounded-b-[var(--raio-folha)] bg-[#F7F7F5] shadow-[var(--folha-sombra)]"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="border-b border-black/[.07] bg-white px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <CompanyLogo nome={company.nome} domain={company.domain_key} site={company.site} size={44} className="shrink-0 rounded border border-black/[.06]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.0625rem] font-semibold tracking-[-.02em] text-[#282525]">{company.nome}</p>
              <p className="mt-1 truncate text-[0.6875rem] text-black/40">{company.setor || "Setor não informado"}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar painel" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/65">
              <X size={15} />
            </button>
          </div>
          <Link href={`/empresas-crm/${company.id}`} className="mt-4 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[#7259B5] hover:underline">
            Abrir perfil completo <ArrowUpRight size={11} />
          </Link>
        </header>

        <nav aria-label="Contextos da empresa" className="grid grid-cols-3 border-b border-black/[.07] bg-white px-3 sm:px-4">
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative flex min-w-0 items-center justify-center gap-1.5 px-2 py-3.5 text-[0.65625rem] font-semibold transition ${tab === item.id ? "text-[#7259B5]" : "text-black/40 hover:text-black/65"}`}
            >
              <item.Icon size={12} />
              <span className="truncate">{item.label}</span>
              {item.count > 0 && <span className="text-[0.5625rem] tabular-nums opacity-70">{item.count}</span>}
              {tab === item.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#7259B5]" />}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded border border-black/[.05] bg-white" />)}</div>
          ) : tab === "relationship" ? (
            <div className="space-y-4">
              <PanelSection title="Próximos contatos" count={followups.length}>
                {followups.length ? followups.map(item => (
                  <div key={item.id} className="flex items-start gap-3 border-t border-black/[.06] py-3 first:border-0 first:pt-0 last:pb-0">
                    <CalendarClock size={13} className="mt-0.5 shrink-0 text-[#B07A14]" />
                    <div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-black/70">{item.titulo}</p><p className="mt-1 text-[0.625rem] text-black/35">{fmtDate(item.previsto_para)}</p></div>
                  </div>
                )) : <Empty copy="Nenhum follow-up pendente." />}
              </PanelSection>

              <PanelSection title="Contatos mapeados" count={contacts.length}>
                {contacts.length ? contacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-3 border-t border-black/[.06] py-3 first:border-0 first:pt-0 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black/[.045] text-[0.75rem] font-semibold text-black/45">{contact.nome.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-black/70">{contact.nome}</p><p className="mt-0.5 truncate text-[0.625rem] text-black/35">{contact.cargo || "Cargo não informado"}</p></div>
                    {contact.email && <a href={`mailto:${contact.email}`} aria-label={`Enviar e-mail para ${contact.nome}`} className="rounded p-1.5 text-black/25 hover:bg-black/[.04] hover:text-[#7259B5]"><Mail size={13} /></a>}
                    {contact.telefone && <a href={`tel:${contact.telefone}`} aria-label={`Ligar para ${contact.nome}`} className="rounded p-1.5 text-black/25 hover:bg-black/[.04] hover:text-[#7259B5]"><Phone size={13} /></a>}
                  </div>
                )) : <Empty copy="Nenhum contato vinculado." />}
              </PanelSection>
            </div>
          ) : tab === "negotiations" ? (
            <PanelSection title="Negociações da empresa" count={negotiations.length}>
              {negotiations.length ? negotiations.map(item => (
                <Link key={item.id} href={`/captacoes/${item.id}`} className="group block border-t border-black/[.06] py-3.5 first:border-0 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[0.75rem] font-semibold text-black/75 group-hover:text-[#7259B5]">{item.titulo || "Negociação sem título"}</p><p className="mt-1 truncate text-[0.625rem] text-black/35">{item.projeto?.nome || "Sem projeto"}{item.proxima_prospeccao ? ` · próximo contato ${fmtDate(item.proxima_prospeccao)}` : ""}</p></div><StatusPill status={item.status} /></div>
                  {item.valor_solicitado != null && <p title={formatarValorCompleto(item.valor_solicitado)} className="mt-2 text-[0.6875rem] font-semibold tabular-nums text-black/55">{formatarValorCurto(item.valor_solicitado)}</p>}
                </Link>
              )) : <Empty copy="Nenhuma negociação vinculada." />}
            </PanelSection>
          ) : (
            <PanelSection title="Inscrições da empresa" count={registrations.length}>
              {registrations.length ? registrations.map(item => (
                <Link key={item.id} href={`/editais-inscritos/${item.id}`} className="group block border-t border-black/[.06] py-3.5 first:border-0 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[0.75rem] font-semibold text-black/75 group-hover:text-[#7259B5]">{item.projeto?.nome || "Sem projeto"}</p>{item.data_fechamento && <p className="mt-1 truncate text-[0.625rem] text-black/35">encerra {fmtDate(item.data_fechamento)}</p>}</div><StatusPill status={item.status} /></div>
                  {item.valor != null && <p title={formatarValorCompleto(item.valor)} className="mt-2 text-[0.6875rem] font-semibold tabular-nums text-black/55">{formatarValorCurto(item.valor)}</p>}
                </Link>
              )) : <Empty copy="Nenhuma inscrição vinculada." />}
            </PanelSection>
          )}
        </div>
      </aside>
    </div>
  );
}

function PanelSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded border border-black/[.08] bg-white p-4">
      <header className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[0.6875rem] font-semibold text-black/50">{title}</h2><span className="text-[0.625rem] tabular-nums text-black/25">{count}</span></header>
      {children}
    </section>
  );
}

function Empty({ copy }: { copy: string }) {
  return <p className="py-8 text-center text-[0.6875rem] text-black/30">{copy}</p>;
}
