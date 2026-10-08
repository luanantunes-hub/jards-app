"use client";

// Regimes (P6.3): o catálogo de regras de cada lei, com a versão publicada,
// as propostas da IA que esperam revisão e o rascunho da versão seguinte.
// A revisão e a publicação ficam em /admin/regimes/[codigo].

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Versao = {
  id: string;
  codigo: string;
  nome: string;
  versao: number;
  status: "rascunho" | "publicado" | "obsoleto";
  area: string;
  norma_referencia: string;
  vigente_desde: string | null;
  publicado_em: string | null;
  exige_segunda_aprovacao: boolean;
  aprovacoes: { usuario: string; em: string }[];
};

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const AMBAR = "#B07A14";
const AREA: Record<string, string> = { cultura: "Cultura", esporte: "Esporte", audiovisual: "Audiovisual", saude: "Saúde", outro: "Outro" };

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function Etiqueta({ texto, cor = "rgba(13,13,13,.6)" }: { texto: string; cor?: string }) {
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor.startsWith("#") ? `${cor}47` : "rgba(13,13,13,.12)", color: cor }}>
      {texto}
    </span>
  );
}

export default function AdminRegimesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [propostas, setPropostas] = useState<Record<string, number>>({});
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
      (supabase as any).from("prestacao_regimes")
        .select("id, codigo, nome, versao, status, area, norma_referencia, vigente_desde, publicado_em, exige_segunda_aprovacao, aprovacoes")
        .neq("codigo", "generico").order("nome").order("versao", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
      (supabase as any).from("prestacao_regime_propostas").select("regime_codigo").in("status", ["nova", "em_revisao"]),
    ]).then(([v, p]) => {
      if (!ativo) return;
      if (v.error) { setErro("Não foi possível carregar os regimes."); return; }
      setVersoes(v.data as Versao[]);
      const contagem: Record<string, number> = {};
      for (const linha of (p.data ?? []) as { regime_codigo: string }[]) contagem[linha.regime_codigo] = (contagem[linha.regime_codigo] ?? 0) + 1;
      setPropostas(contagem);
    });
    return () => { ativo = false; };
  }, [supabase]);

  const regimes = useMemo(() => {
    const porCodigo = new Map<string, { publicado: Versao | null; rascunho: Versao | null; versoes: number }>();
    for (const v of versoes ?? []) {
      const atual = porCodigo.get(v.codigo) ?? { publicado: null, rascunho: null, versoes: 0 };
      atual.versoes += 1;
      if (v.status === "publicado") atual.publicado = v;
      if (v.status === "rascunho") atual.rascunho = v;
      porCodigo.set(v.codigo, atual);
    }
    return [...porCodigo.entries()].filter(([, r]) => r.publicado).map(([codigo, r]) => ({ codigo, ...r }));
  }, [versoes]);

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-8 md:px-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#0D0D0D]">Regimes</h1>
        <p className="mt-0.5 max-w-[48rem] text-sm text-black/45">
          As regras de prestação de contas de cada lei, que o módulo usa nas checagens, nos prazos e no envio. Uma versão nova nasce de uma proposta da IA ou de uma mudança feita à mão, passa no schema do regime e é publicada sem deploy; mudança em regra que bloqueia o envio pede duas pessoas da equipe.
        </p>
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}

      {!versoes && !erro ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : regimes.length === 0 ? (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <Scale size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mt-2 text-[0.75rem] text-black/55">Nenhum regime publicado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[.06] rounded border bg-white" style={BORDA}>
          {regimes.map(({ codigo, publicado, rascunho, versoes: total }) => {
            const p = publicado!;
            const pendentes = propostas[codigo] ?? 0;
            return (
              <li key={codigo}>
                <Link href={`/admin/regimes/${codigo}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[0.8125rem] font-medium text-[#0D0D0D]">{p.nome}</span>
                      <Etiqueta texto={AREA[p.area] ?? p.area} />
                      {pendentes > 0 && <Etiqueta texto={pendentes === 1 ? "1 proposta para revisar" : `${pendentes} propostas para revisar`} cor={AMBAR} />}
                      {rascunho && (
                        <Etiqueta cor={AMBAR} texto={rascunho.exige_segunda_aprovacao && rascunho.aprovacoes.length === 1
                          ? `Versão ${rascunho.versao} aguarda a segunda aprovação` : `Rascunho da versão ${rascunho.versao}`} />
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.6875rem] text-black/45">
                      {[
                        `versão ${p.versao} publicada${p.publicado_em ? ` em ${dataBr(p.publicado_em)}` : ""}`,
                        p.vigente_desde ? `vigente desde ${dataBr(p.vigente_desde)}` : null,
                        total > 1 ? `${total} versões` : null,
                        p.norma_referencia,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-black/25" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
