"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Layers, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CotaPatrocinio } from "@/lib/supabase/types";
import { formatCotaValor } from "@/lib/cotas";
import { PropostaOperacionalModal } from "@/components/projects/PropostaOperacionalModal";

const STATUS_META: Record<CotaPatrocinio["status"], { label: string; color: string }> = {
  disponivel: { label: "Disponível", color: "#2D72B0" },
  reservada: { label: "Reservada", color: "#B07A14" },
  vendida: { label: "Vendida", color: "#2E8932" },
};

export function CotasReferenceTab({
  projetoId,
  projetoNome,
  empresaNome,
  organizationId,
  parentField,
  parentId,
  captacaoId,
  onPropostaCriada,
}: {
  projetoId: string | null;
  projetoNome?: string;
  empresaNome?: string;
  organizationId?: string | null;
  parentField?: "captacao_id" | "edital_user_id";
  parentId?: string;
  captacaoId?: string;
  onPropostaCriada?: () => void;
}) {
  const supabase = createClient();
  const [cotas, setCotas] = useState<CotaPatrocinio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovaProposta, setShowNovaProposta] = useState(false);
  const podeCriarProposta = Boolean(projetoId && projetoNome && empresaNome && parentField && parentId);

  useEffect(() => {
    if (!projetoId) return;
    let active = true;
    (supabase as any).from("cotas_patrocinio").select("*").eq("projeto_id", projetoId).order("ordem").then(({ data }: any) => {
      if (active) { setCotas(data ?? []); setLoading(false); }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  if (!projetoId) {
    return (
      <div className="rounded border bg-white px-5 py-12 text-center text-sm text-black/35" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        Esta negociação precisa estar associada a um projeto para ver as cotas de patrocínio.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Cotas do projeto</h2>
        </div>
        <div className="flex items-center gap-3">
          {podeCriarProposta && (
            <button onClick={() => setShowNovaProposta(true)} className="flex items-center gap-1.5 rounded border border-black/15 bg-white px-3 py-1.5 text-[0.6875rem] font-semibold text-black/70 transition hover:bg-black/[.04]">
              <Plus size={11} /> Nova proposta
            </button>
          )}
          <Link href={`/projetos/${projetoId}`} className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-black/70 hover:underline">
            Editar <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded border bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.08)" }} />)}
        </div>
      ) : cotas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-12 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <Layers size={22} className="mx-auto text-black/15" />
          <p className="mt-3 text-sm font-medium text-black/35">Nenhuma cota cadastrada ainda</p>
          <Link href={`/projetos/${projetoId}`} className="mt-3 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[#7259B5] hover:underline">
            Criar cota no projeto <ExternalLink size={10} />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {cotas.map(cota => {
            const vinculada = captacaoId && cota.captacao_id === captacaoId;
            return (
              <div key={cota.id} className="rounded border bg-white p-4" style={{ borderColor: vinculada ? "#7259B540" : "rgba(13,13,13,.08)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.8125rem] font-semibold text-black/75">{cota.nome}</p>
                      <span
                        className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium"
                        style={{ borderColor: STATUS_META[cota.status].color + "47", color: STATUS_META[cota.status].color }}
                      >
                        {STATUS_META[cota.status].label}
                      </span>
                      {vinculada && (
                        <span className="rounded border border-[#7259B5]/30 bg-white px-2 py-0.5 text-[0.625rem] font-medium text-[#7259B5]">
                          Vinculada a esta negociação
                        </span>
                      )}
                    </div>
                    {cota.modelo === "produto" && cota.produto_nome && <p className="mt-1 text-[0.6875rem] text-black/55">Produto: {cota.produto_nome}</p>}
                    <p className="mt-1 text-[0.625rem] text-black/35">{cota.unidades_ilimitadas ? `Ilimitada · ${cota.unidades_vendidas} vendida(s)` : `${Math.max(0, cota.unidades - cota.unidades_vendidas)} disponível(is) de ${cota.unidades}`}</p>
                    {cota.contrapartidas.length > 0 && (
                      <p className="mt-2 text-[0.6875rem] leading-relaxed text-black/40">{cota.contrapartidas.join(" · ")}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[0.8125rem] font-semibold text-black/65">{formatCotaValor(cota)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNovaProposta && podeCriarProposta && (
        <PropostaOperacionalModal
          projetoId={projetoId!}
          projetoNome={projetoNome!}
          proposta={null}
          cotas={cotas}
          captacoes={[]}
          inscricoes={[]}
          fixedCase={{
            kind: parentField === "captacao_id" ? "negociacao" : "edital",
            id: parentId!,
            titulo: projetoNome!,
            complemento: empresaNome!,
          }}
          onClose={() => setShowNovaProposta(false)}
          onSaved={() => onPropostaCriada?.()}
        />
      )}
    </div>
  );
}
