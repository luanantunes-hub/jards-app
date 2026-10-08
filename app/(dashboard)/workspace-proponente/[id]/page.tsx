"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- RPC experimental ainda não consta nos tipos gerados */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Zap, FileText, Check, TrendingUp, Building2, FileStack } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import StatusBadge from "@/components/ui/StatusBadge";
import { useEtiquetas, type Etiqueta } from "@/contexts/EtiquetasContext";
import { KanbanBoard, KanbanColumn, KanbanCard, KanbanEmpty } from "@/components/kanban/KanbanPrimitives";
import { ProjetoSolicitacoes } from "@/components/proponentes/ProjetoSolicitacoes";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { BarraCaptacao, ICONE_CAPTACAO, Indicador } from "@/components/ui/IndicadoresFinanceiros";

type NegociacaoRow = { id: string; titulo: string | null; status: string; valorSolicitado: number | null; empresaNome: string; updatedAt: string };
type InscricaoRow = { id: string; empresaNome: string; status: string; valor: number | null; dataSubmissao: string | null; updatedAt: string };
type ResultadoRow = { id: string; valorCaptado: number | null; valorExecutado: number | null; dataResultado: string | null };

type ProjetoDetalhe = {
  id: string; nome: string; descricao: string | null;
  fase: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  statusComercial: string | null; valorAlvo: number | null; valorGarantido: number;
  identidadeTipo: "padrao" | "icone" | "emoji" | "logo"; identidadeValor: string | null;
  identidadeLogoUrl: string | null; identidadeCor: string | null;
  proponenteNome: string;
  negociacoes: NegociacaoRow[]; inscricoes: InscricaoRow[]; resultados: ResultadoRow[];
};

const FASES: Record<string, { label: string; color: string; Icon: typeof Calendar }> = {
  planejamento: { label: "Planejamento", color: "#888888", Icon: Calendar },
  captacao:     { label: "Captação",     color: "#7259B5", Icon: TrendingUp },
  execucao:     { label: "Execução",     color: "#2D72B0", Icon: Zap },
  prestacao:    { label: "Prestação",    color: "#B07A14", Icon: FileText },
  concluido:    { label: "Concluído",    color: "#2E8932", Icon: Check },
};

const STATUS_CAP: Record<string, { label: string; color: string }> = {
  prospeccao:       { label: "Prospecção",  color: "rgba(13,13,13,.40)" },
  primeiro_contato: { label: "1º Contato",  color: "#7259B5" },
  proposta_enviada: { label: "Proposta",    color: "#2D72B0" },
  em_negociacao:    { label: "Negociação",  color: "#B07A14" },
  aprovado:         { label: "Aprovado",    color: "#2E8932" },
  recusado:         { label: "Recusado",    color: "#D94E4E" },
  renovacao:        { label: "Renovação",   color: "#2D72B0" },
};

const STATUS_INSC: Record<string, { label: string; color: string }> = {
  rascunho:   { label: "Rascunho",   color: "rgba(13,13,13,.40)" },
  inscrito:   { label: "Inscrito",   color: "#2D72B0" },
  habilitado: { label: "Habilitado", color: "#2D72B0" },
  aprovado:   { label: "Aprovado",   color: "#2E8932" },
  reprovado:  { label: "Reprovado",  color: "#D94E4E" },
  aguardando: { label: "Aguardando", color: "#B07A14" },
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function FunilKanbanLeitura<T extends { id: string; status: string }>({ etapas, itens, renderCard }: {
  etapas: Etiqueta[];
  itens: T[];
  renderCard: (item: T) => React.ReactNode;
}) {
  if (etapas.length === 0) return null;
  return (
    <KanbanBoard>
      {etapas.map(etapa => {
        const emEtapa = itens.filter(item => item.status === etapa.key);
        return (
          <KanbanColumn key={etapa.key} label={etapa.label} count={emEtapa.length} accent={etapa.cor} iconName={etapa.icone}>
            {emEtapa.length === 0 ? <KanbanEmpty label="Nenhuma oportunidade." /> : emEtapa.map(item => (
              <KanbanCard key={item.id}>{renderCard(item)}</KanbanCard>
            ))}
          </KanbanColumn>
        );
      })}
    </KanbanBoard>
  );
}

export default function WorkspaceProponenteProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { etiquetas, etiquetasInscricao } = useEtiquetas();
  const etiquetasCaptacao = Object.fromEntries(etiquetas.map(etiqueta => [etiqueta.key, etiqueta]));
  const etiquetasEdital = Object.fromEntries(etiquetasInscricao.map(etiqueta => [etiqueta.key, etiqueta]));

  const [projeto, setProjeto] = useState<ProjetoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (supabase as any).rpc("fn_proponente_projeto_detalhe", { p_projeto_id: id }).then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
      if (error) { setErro(error.message); setLoading(false); return; }
      setProjeto(data as unknown as ProjetoDetalhe);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <DetailPageSkeleton sidebar={false} />;

  if (!projeto) {
    return <DetailNotFound title="Projeto não encontrado" description={erro ?? undefined} backHref="/workspace-proponente" backLabel="Meus projetos" />;
  }

  const captadoAprovado = projeto.negociacoes.filter(c => c.status === "aprovado").reduce((s, c) => s + (c.valorSolicitado ?? 0), 0);
  const captadoTotal = projeto.negociacoes.filter(c => c.status !== "recusado").reduce((s, c) => s + (c.valorSolicitado ?? 0), 0);
  const ultimoResultado = projeto.resultados[0] ?? null;
  const valorCaptadoDisplay = ultimoResultado?.valorCaptado != null ? ultimoResultado.valorCaptado : captadoAprovado;
  const faseMeta = FASES[projeto.fase] ?? FASES.planejamento;
  const faltante = Math.max(0, (projeto.valorAlvo ?? 0) - valorCaptadoDisplay - projeto.valorGarantido);
  const progress = projeto.valorAlvo ? Math.min(100, Math.round(((valorCaptadoDisplay + projeto.valorGarantido) / projeto.valorAlvo) * 100)) : 0;
  const confirmado = valorCaptadoDisplay + projeto.valorGarantido;
  const negociacao = Math.max(0, captadoTotal - captadoAprovado);

  return (
    <div className="min-h-full">
      <div className="border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <Link href="/workspace-proponente" className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65">
            <ArrowLeft size={14} /> Meus projetos
          </Link>
          <div className="flex min-w-0 items-center gap-4">
            <ProjectIdentity nome={projeto.nome} tipo={projeto.identidadeTipo} valor={projeto.identidadeValor} logoUrl={projeto.identidadeLogoUrl} cor={projeto.identidadeCor} size="md" />
            <div className="min-w-0">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: faseMeta.color + "47", color: faseMeta.color, background: "white" }}>
                <faseMeta.Icon size={10} />{faseMeta.label}
              </span>
              <h1 className="max-w-4xl text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[2.375rem]">{projeto.nome}</h1>
              <p className="mt-2 text-[0.875rem] text-black/50">{projeto.proponenteNome}</p>
              {projeto.descricao && <p className="mt-3 max-w-3xl text-[0.9375rem] leading-6 text-black/45">{projeto.descricao}</p>}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-pagina px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-10">
        <div className="space-y-6">
          {/* Hero financeiro */}
          <div className="rounded border bg-white p-6 sm:p-7" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <p className="text-[0.6875rem] font-medium text-black/40 mb-2">Captado do objetivo</p>
            <p className="text-[3.25rem] font-semibold tracking-[-.045em] tabular-nums leading-none text-black/80">
              {progress}<span className="text-[1.875rem] text-black/35 ml-1">%</span>
            </p>
            {projeto.valorAlvo && <p className="mt-2 text-[0.75rem] tabular-nums text-black/35" title={formatarValorCompleto(projeto.valorAlvo)}>de {formatarValorCurto(projeto.valorAlvo)}</p>}

            <BarraCaptacao confirmado={confirmado} negociacao={negociacao} meta={projeto.valorAlvo} className="mt-5 h-2" />
            <dl className="mt-6 grid grid-cols-3 gap-3 border-t pt-5 sm:gap-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <Indicador icone={ICONE_CAPTACAO.confirmado} rotulo="Confirmado" valor={confirmado} />
              <Indicador icone={ICONE_CAPTACAO.negociacao} rotulo="Em negociação" valor={negociacao} />
              {projeto.valorAlvo && faltante === 0 ? (
                <Indicador icone={ICONE_CAPTACAO.falta} rotulo="Falta captar" valor={0} texto="Meta atingida" corTexto="#2E8932" />
              ) : (
                <Indicador icone={ICONE_CAPTACAO.falta} rotulo="Falta captar" valor={projeto.valorAlvo ? faltante : null} />
              )}
            </dl>
          </div>

          {/* Negociações */}
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">
              <Building2 size={12} /> Negociações
            </h2>
            {projeto.negociacoes.length === 0 ? (
              <div className="rounded border p-5 text-center" style={{ borderColor: "rgba(13,13,13,.10)", borderStyle: "dashed" }}>
                <p className="text-[0.75rem] text-black/30">Nenhuma negociação registrada ainda.</p>
              </div>
            ) : (
              <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <FunilKanbanLeitura etapas={etiquetas} itens={projeto.negociacoes} renderCard={neg => {
                  const etiqueta = etiquetasCaptacao[neg.status];
                  const st = etiqueta ? { label: etiqueta.label, color: etiqueta.cor, iconName: etiqueta.icone } : { ...(STATUS_CAP[neg.status] ?? { label: neg.status, color: "#888888" }), iconName: undefined };
                  return (
                    <div>
                      <p className="truncate text-[0.78125rem] font-semibold text-black/80">{neg.titulo ?? neg.empresaNome}</p>
                      <p className="mt-0.5 truncate text-[0.6875rem] text-black/45">{neg.empresaNome}</p>
                      <div className="mt-2.5 flex items-center justify-between border-t border-black/[.06] pt-2">
                        <StatusBadge status={neg.status} label={st.label} bg={st.color} iconName={st.iconName} size="sm" />
                        <span className="text-[0.75rem] font-semibold tabular-nums text-black/50" title={neg.valorSolicitado != null ? formatarValorCompleto(neg.valorSolicitado) : undefined}>{formatarValorCurto(neg.valorSolicitado)}</span>
                      </div>
                    </div>
                  );
                }} />
              </div>
            )}
          </section>

          {/* Inscrições */}
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">
              <FileStack size={12} /> Inscrições
            </h2>
            {projeto.inscricoes.length === 0 ? (
              <div className="rounded border p-5 text-center" style={{ borderColor: "rgba(13,13,13,.10)", borderStyle: "dashed" }}>
                <p className="text-[0.75rem] text-black/30">Nenhum edital inscrito ainda.</p>
              </div>
            ) : (
              <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <FunilKanbanLeitura etapas={etiquetasInscricao} itens={projeto.inscricoes} renderCard={insc => {
                  const etiqueta = etiquetasEdital[insc.status];
                  const st = etiqueta ? { label: etiqueta.label, color: etiqueta.cor, iconName: etiqueta.icone } : { ...(STATUS_INSC[insc.status] ?? { label: insc.status, color: "#888888" }), iconName: undefined };
                  return (
                    <div>
                      <p className="truncate text-[0.78125rem] font-semibold text-black/80">{insc.empresaNome}</p>
                      {insc.dataSubmissao && <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-black/45"><Calendar size={9} /> {fmtDate(insc.dataSubmissao)}</p>}
                      <div className="mt-2.5 border-t border-black/[.06] pt-2">
                        <StatusBadge status={insc.status} label={st.label} bg={st.color} iconName={st.iconName} size="sm" />
                      </div>
                    </div>
                  );
                }} />
              </div>
            )}
          </section>

          {/* Solicitações */}
          <ProjetoSolicitacoes projetoId={id} isOrganizacao={false} proponenteNome={projeto.proponenteNome} />
        </div>
      </main>
    </div>
  );
}
