"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- RPC experimental ainda não consta nos tipos gerados */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, FolderOpen, TrendingUp, Zap, FileText, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import { PrestacoesDoProponente } from "@/components/prestacao/proponente/PrestacoesDoProponente";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { BarraCaptacao } from "@/components/ui/IndicadoresFinanceiros";

type ProjetoResumo = {
  id: string;
  nome: string;
  fase: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  statusComercial: string | null;
  valorAlvo: number | null;
  valorGarantido: number;
  identidadeTipo: "padrao" | "icone" | "emoji" | "logo";
  identidadeValor: string | null;
  identidadeLogoUrl: string | null;
  identidadeCor: string | null;
  proponenteId: string;
  proponenteNome: string;
  negociacoesCount: number;
  inscricoesCount: number;
  createdAt: string;
};

const FASES: Record<string, { label: string; color: string; Icon: typeof Calendar }> = {
  planejamento: { label: "Planejamento", color: "#888888", Icon: Calendar },
  captacao:     { label: "Captação",     color: "#7259B5", Icon: TrendingUp },
  execucao:     { label: "Execução",     color: "#2D72B0", Icon: Zap },
  prestacao:    { label: "Prestação",    color: "#B07A14", Icon: FileText },
  concluido:    { label: "Concluído",    color: "#2E8932", Icon: Check },
};

export default function WorkspaceProponenteListPage() {
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("fn_proponente_meus_projetos").then(({ data, error }) => {
      if (error) { setErro(error.message); setLoading(false); return; }
      const rows = ((data ?? []) as any[]).map(p => ({
        id: p.id, nome: p.nome, fase: p.fase, statusComercial: p.statusComercial,
        valorAlvo: p.valorAlvo, valorGarantido: p.valorGarantido ?? 0,
        identidadeTipo: p.identidadeTipo ?? "padrao", identidadeValor: p.identidadeValor,
        identidadeLogoUrl: p.identidadeLogoUrl, identidadeCor: p.identidadeCor,
        proponenteId: p.proponenteId, proponenteNome: p.proponenteNome,
        negociacoesCount: p.negociacoesCount ?? 0, inscricoesCount: p.inscricoesCount ?? 0,
        createdAt: p.createdAt,
      })) as ProjetoResumo[];
      setProjetos(rows);
      setLoading(false);
    });
  }, []);

  const proponentesUnicos = new Set(projetos.map(p => p.proponenteId)).size;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-pagina px-4 pt-8 sm:px-6 lg:px-10">
        <div className="h-8 w-64 bg-black/8 rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-black/8 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-8 sm:px-6 lg:px-10 lg:pt-10">
          <h1 className="text-[1.75rem] font-semibold leading-[1.04] tracking-[-.04em] text-[#0D0D0D] sm:text-[2rem]">Meus projetos</h1>
          <p className="mt-2 text-[0.875rem] text-black/45">
            {proponentesUnicos > 1 ? `Projetos de ${proponentesUnicos} proponentes vinculados a você.` : "Acompanhe o andamento das negociações e inscrições de cada projeto."}
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-pagina px-4 py-8 sm:px-6 lg:px-10">
        {erro && <p role="alert" className="mb-4 text-[0.75rem] font-medium text-[#D94E4E]">{erro}</p>}
        <PrestacoesDoProponente />

        {projetos.length === 0 ? (
          <div className="rounded border px-6 py-14 text-center" style={{ borderColor: "rgba(13,13,13,.10)", borderStyle: "dashed" }}>
            <FolderOpen size={22} className="mx-auto text-black/15" />
            <p className="mt-3 text-[0.8125rem] font-medium text-black/40">Nenhum projeto vinculado ainda.</p>
            <p className="mt-1 text-[0.75rem] text-black/30">Assim que um projeto seu for cadastrado, ele aparece aqui.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projetos.map(projeto => {
              const faseMeta = FASES[projeto.fase] ?? FASES.planejamento;
              const progress = projeto.valorAlvo ? Math.min(100, Math.round((projeto.valorGarantido / projeto.valorAlvo) * 100)) : 0;
              return (
                <Link
                  key={projeto.id}
                  href={`/workspace-proponente/${projeto.id}`}
                  className="group rounded border bg-white p-5 transition hover:bg-black/[.015] active:scale-[.995]"
                  style={{ borderColor: "rgba(13,13,13,.08)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <ProjectIdentity nome={projeto.nome} tipo={projeto.identidadeTipo} valor={projeto.identidadeValor} logoUrl={projeto.identidadeLogoUrl} cor={projeto.identidadeCor} size="sm" />
                    <span className="flex shrink-0 items-center gap-1 rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: faseMeta.color + "47", color: faseMeta.color }}>
                      <faseMeta.Icon size={10} />{faseMeta.label}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-[0.875rem] font-semibold text-black/80 group-hover:text-black">{projeto.nome}</p>
                  {proponentesUnicos > 1 && <p className="mt-0.5 truncate text-[0.6875rem] text-black/35">{projeto.proponenteNome}</p>}

                  {projeto.valorAlvo ? (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[0.6875rem] tabular-nums text-black/40"><span title={formatarValorCompleto(projeto.valorGarantido)}>{formatarValorCurto(projeto.valorGarantido)}</span> de <span title={formatarValorCompleto(projeto.valorAlvo)}>{formatarValorCurto(projeto.valorAlvo)}</span></span>
                        <span className="text-[0.6875rem] font-medium tabular-nums text-black/50">{progress}%</span>
                      </div>
                      <BarraCaptacao confirmado={projeto.valorGarantido} meta={projeto.valorAlvo} className="h-1.5" />
                    </div>
                  ) : <div className="mt-4 h-1.5" />}

                  <div className="mt-4 flex items-center gap-3 border-t pt-3 text-[0.6875rem] text-black/35" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    <span>{projeto.negociacoesCount} negociaç{projeto.negociacoesCount === 1 ? "ão" : "ões"}</span>
                    <span>·</span>
                    <span>{projeto.inscricoesCount} inscriç{projeto.inscricoesCount === 1 ? "ão" : "ões"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
