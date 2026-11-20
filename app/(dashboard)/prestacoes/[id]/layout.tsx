"use client";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BookOpen, CalendarClock, CalendarDays, DollarSign, FileText, FolderOpen, Handshake, Landmark, LayoutGrid, ListChecks, Megaphone, Package, Scale, Send, Target, Ticket, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { DetailBackLink } from "@/components/ui/DetailPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import type { StatusPrestacao } from "@/lib/supabase/types";

type Cabecalho = {
  titulo: string;
  status: StatusPrestacao;
  prazo: string | null;
  captacao: { id: string; titulo: string | null } | null;
  projeto: { id: string; nome: string } | null;
};

type Aba = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type Grupo = { label: string; icon: LucideIcon; abas: Aba[] };

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PrestacaoLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [cabecalho, setCabecalho] = useState<Cabecalho | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient() as any)
      .from("prestacoes_contas")
      .select("titulo, status, prazo, captacao:captacao_id(id, titulo), projeto:projeto_id(id, nome)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: Cabecalho | null }) => { if (data) setCabecalho(data); });
  }, [id]);

  const base = `/prestacoes/${id}`;
  // Seis seções no lugar de quinze abas: financeiro, execução e envio agrupam
  // as telas que andam juntas; cada tela mantém o próprio endereço.
  const grupos: Grupo[] = [
    { label: "Visão geral", icon: LayoutGrid, abas: [{ href: base, label: "Visão geral", icon: LayoutGrid, exact: true }] },
    { label: "Financeiro", icon: Wallet, abas: [
      { href: `${base}/orcamento`, label: "Orçamento", icon: DollarSign },
      { href: `${base}/comprovantes`, label: "Comprovantes", icon: FileText },
      { href: `${base}/extrato`, label: "Extrato", icon: Landmark },
      { href: `${base}/conciliacao`, label: "Conciliação", icon: ArrowLeftRight },
    ] },
    { label: "Execução", icon: Wrench, abas: [
      { href: `${base}/objeto`, label: "Objeto", icon: Target },
      { href: `${base}/atividades`, label: "Atividades", icon: CalendarDays },
      { href: `${base}/beneficiarios`, label: "Beneficiários", icon: Users },
      { href: `${base}/distribuicao`, label: "Distribuição", icon: Ticket },
      { href: `${base}/bens`, label: "Bens", icon: Package },
      { href: `${base}/divulgacao`, label: "Divulgação", icon: Megaphone },
    ] },
    { label: "Pendências", icon: ListChecks, abas: [{ href: `${base}/pendencias`, label: "Pendências", icon: ListChecks }] },
    { label: "Relatório", icon: BookOpen, abas: [{ href: `${base}/relatorio`, label: "Relatório", icon: BookOpen }] },
    { label: "Envio", icon: Send, abas: [
      { href: `${base}/envio`, label: "Envio", icon: Send },
      { href: `${base}/pos-envio`, label: "Após o envio", icon: Scale },
    ] },
  ];

  const ativa = (aba: Aba) => aba.exact ? pathname === aba.href : pathname === aba.href || pathname.startsWith(`${aba.href}/`);
  const grupoAtivo = grupos.find(grupo => grupo.abas.some(ativa)) ?? grupos[0];

  // Com muitas abas, a linha rola: a aba ativa entra na vista.
  const abasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    abasRef.current?.querySelectorAll<HTMLElement>('[aria-current="page"]').forEach(el => el.scrollIntoView({ block: "nearest", inline: "nearest" }));
  }, [pathname]);

  const hoje = new Date().toISOString().slice(0, 10);
  const vencida = Boolean(cabecalho?.prazo && cabecalho.prazo.slice(0, 10) < hoje && cabecalho.status !== "aprovado" && cabecalho.status !== "arquivado");

  return (
    <div className="min-h-full bg-white">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-7 pt-6 md:px-8 lg:pt-8">
          <div className="mb-6"><DetailBackLink href="/prestacoes" label="Prestações" /></div>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="min-w-0 text-balance text-[1.75rem] font-semibold leading-[1.06] tracking-[-.04em] text-[#282525] sm:text-[2.125rem]">
                  {cabecalho?.titulo || "…"}
                </h1>
                {cabecalho?.status && <StatusBadge status={cabecalho.status} />}
              </div>
              {cabecalho && (cabecalho.projeto || cabecalho.captacao || cabecalho.prazo) && (
                <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem] text-black/50">
                  {cabecalho.projeto && (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <dt className="sr-only">Projeto</dt>
                      <FolderOpen size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />
                      <dd className="truncate"><Link href={`/projetos/${cabecalho.projeto.id}`} className="transition hover:text-[#282525]">{cabecalho.projeto.nome}</Link></dd>
                    </div>
                  )}
                  {cabecalho.captacao && (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <dt className="sr-only">Negociação</dt>
                      <Handshake size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />
                      <dd className="truncate"><Link href={`/captacoes/${cabecalho.captacao.id}`} className="transition hover:text-[#282525]">{cabecalho.captacao.titulo ?? "Negociação"}</Link></dd>
                    </div>
                  )}
                  {cabecalho.prazo && (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Prazo de envio</dt>
                      <CalendarClock size={13} strokeWidth={1.75} aria-hidden="true" className={`shrink-0 ${vencida ? "text-[#D94A4A]" : "text-black/40"}`} />
                      <dd className="tabular-nums">{vencida ? "Venceu em " : "Envio até "}{dataCurta(cabecalho.prazo)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
            {/* Ações da página atual (a visão geral desenha aqui o "Avançar status"). */}
            <div id="prestacao-acoes" className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end" />
          </div>
        </div>
      </header>

      {/* Seções e, quando a seção tem mais de uma tela, a navegação interna. */}
      <div ref={abasRef} className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <nav aria-label="Seções da prestação" className="mx-auto flex max-w-pagina items-center gap-1.5 overflow-x-auto px-4 py-3 md:px-8">
          {grupos.map(grupo => {
            const atual = grupo === grupoAtivo;
            const Icone = grupo.icon;
            return (
              <Link
                key={grupo.label}
                href={grupo.abas[0].href}
                aria-current={atual ? "page" : undefined}
                className={`flex h-11 shrink-0 items-center gap-2 rounded border bg-white px-4 text-[0.75rem] font-medium transition active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
                  atual ? "border-[#7259B5]/40 text-[#7259B5]" : "border-transparent text-black/40 hover:bg-black/[.04] hover:text-black/60"
                }`}
              >
                <Icone size={13} strokeWidth={1.8} aria-hidden="true" />
                {grupo.label}
              </Link>
            );
          })}
        </nav>
        {grupoAtivo.abas.length > 1 && (
          <nav aria-label={grupoAtivo.label} className="mx-auto flex max-w-pagina items-center gap-1 overflow-x-auto px-4 pb-3 md:px-8">
            {grupoAtivo.abas.map(aba => {
              const atual = ativa(aba);
              const Icone = aba.icon;
              return (
                <Link
                  key={aba.href}
                  href={aba.href}
                  aria-current={atual ? "page" : undefined}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
                    atual ? "bg-black/[.05] font-medium text-[#282525]" : "text-black/45 hover:bg-black/[.03] hover:text-black/70"
                  }`}
                >
                  <Icone size={12} strokeWidth={1.75} aria-hidden="true" />
                  {aba.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <div>{children}</div>
    </div>
  );
}
