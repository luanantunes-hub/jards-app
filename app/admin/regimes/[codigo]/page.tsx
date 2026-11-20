"use client";

// Um regime (P6.3): as propostas da IA para revisar, o rascunho da versão
// seguinte com as aprovações, as versões e os parâmetros publicados. Toda
// escrita passa por /api/admin/regimes/[codigo].

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { regimeAchatado } from "@/supabase/functions/_shared/proposta-regime";
import { BORDA, CAMPO, Etiqueta, dataBr } from "./comum";
import { RascunhoDoRegime, type Rascunho } from "./RascunhoDoRegime";
import { RevisaoDaProposta, type PropostaParaRevisar } from "./RevisaoDaProposta";

type Versao = {
  id: string;
  versao: number;
  status: "rascunho" | "publicado" | "obsoleto";
  nome: string;
  norma_referencia: string;
  vigente_desde: string | null;
  publicado_em: string | null;
};

const STATUS: Record<Versao["status"], { texto: string; cor: string }> = {
  publicado: { texto: "Publicada", cor: "#2E8932" },
  rascunho: { texto: "Rascunho", cor: "#B07A14" },
  obsoleto: { texto: "Anterior", cor: "#6B6B6B" },
};

function ParametrosPublicados({ parametros }: { parametros: Record<string, unknown> }) {
  const [busca, setBusca] = useState("");
  const linhas = useMemo(() => regimeAchatado(parametros).split("\n"), [parametros]);
  const termo = busca.trim().toLowerCase();
  const achadas = termo ? linhas.filter(l => l.toLowerCase().includes(termo)) : linhas;
  return (
    <details className="rounded border bg-white px-5 py-3" style={BORDA}>
      <summary className="cursor-pointer rounded text-[0.75rem] text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        Parâmetros da versão publicada ({linhas.length} linhas)
      </summary>
      <label className="mt-3 block max-w-[28rem]">
        <span className="sr-only">Buscar nos parâmetros</span>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar: prazo, teto, tarifa, art. 69…" className={CAMPO} />
      </label>
      <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded bg-black/[.03] px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-black/70">
        {achadas.slice(0, 400).join("\n") || "Nada encontrado."}
        {achadas.length > 400 ? `\n… e mais ${achadas.length - 400} linhas` : ""}
      </pre>
    </details>
  );
}

export default function AdminRegimePage() {
  const { codigo } = useParams<{ codigo: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [publicado, setPublicado] = useState<{ versao: number; parametros: Record<string, unknown> } | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [propostas, setPropostas] = useState<PropostaParaRevisar[]>([]);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [geracao, setGeracao] = useState(0);

  const buscar = useCallback(async () => {
    const [lista, detalhes, props, sessao] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
      (supabase as any).from("prestacao_regimes").select("id, versao, status, nome, norma_referencia, vigente_desde, publicado_em")
        .eq("codigo", codigo).order("versao", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
      (supabase as any).from("prestacao_regimes")
        .select("id, versao, status, parametros, aprovacoes, exige_segunda_aprovacao, regras_de_bloqueio, notas, vigente_desde")
        .eq("codigo", codigo).in("status", ["publicado", "rascunho"]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
      (supabase as any).from("prestacao_regime_propostas")
        .select("id, classificacao, resumo, mudancas, vigencia_proposta, transicao, prestacoes_afetadas, created_at, documento:normas_documentos(titulo, url, tipo_ato, publicado_em)")
        .eq("regime_codigo", codigo).in("status", ["nova", "em_revisao"]).order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    return { lista, detalhes, props, usuario: sessao.data.user?.id ?? null };
  }, [supabase, codigo]);

  const aplicar = useCallback(({ lista, detalhes, props, usuario }: Awaited<ReturnType<typeof buscar>>) => {
    if (lista.error || detalhes.error) { setErro("Não foi possível carregar o regime."); return; }
    setVersoes(lista.data as Versao[]);
    const linhas = (detalhes.data ?? []) as (Rascunho & { status: string })[];
    const pub = linhas.find(l => l.status === "publicado");
    setPublicado(pub ? { versao: pub.versao, parametros: pub.parametros } : null);
    setRascunho(linhas.find(l => l.status === "rascunho") ?? null);
    setPropostas((props.data ?? []) as PropostaParaRevisar[]);
    setUsuarioId(usuario);
    setGeracao(g => g + 1);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  async function feito(mensagem: string) {
    setAviso(mensagem);
    setErro("");
    aplicar(await buscar());
  }

  const atual = versoes?.find(v => v.status === "publicado");

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-8 md:px-6">
      <Link href="/admin/regimes" className="inline-flex items-center gap-1 rounded text-[0.75rem] text-black/45 hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ChevronLeft size={13} aria-hidden /> Regimes
      </Link>

      {!versoes && !erro ? (
        <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-28 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : !atual || !publicado ? (
        <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>
          {erro || "Regime sem versão publicada."}
        </p>
      ) : (
        <>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#282525]">{atual.nome}</h1>
            <p className="mt-0.5 text-sm text-black/45">
              {[`${codigo}`, `versão ${atual.versao} publicada${atual.publicado_em ? ` em ${dataBr(atual.publicado_em)}` : ""}`,
                atual.vigente_desde ? `vigente desde ${dataBr(atual.vigente_desde)}` : null, atual.norma_referencia].filter(Boolean).join(" · ")}
            </p>
          </div>

          {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}
          {aviso && <p role="status" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893240" }}>{aviso}</p>}

          {propostas.length > 0 && (
            <section className="space-y-2" aria-labelledby="titulo-propostas">
              <h2 id="titulo-propostas" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">
                Propostas para revisar ({propostas.length})
              </h2>
              {propostas.map(p => (
                <RevisaoDaProposta key={`${p.id}:${geracao}`} codigo={codigo} proposta={p}
                  regimeBase={rascunho?.parametros ?? publicado.parametros} temRascunho={!!rascunho} onFeito={feito} />
              ))}
            </section>
          )}

          <RascunhoDoRegime key={geracao} codigo={codigo} rascunho={rascunho} publicado={publicado} usuarioId={usuarioId} onFeito={feito} />

          <section className="rounded border bg-white" style={BORDA} aria-labelledby="titulo-versoes">
            <h2 id="titulo-versoes" className="border-b px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40" style={{ borderColor: "rgba(13,13,13,.06)" }}>Versões</h2>
            <ul className="divide-y divide-black/[.06]">
              {(versoes ?? []).map(v => (
                <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-[0.75rem]">
                  <span className="w-[5rem] tabular-nums text-black/75">Versão {v.versao}</span>
                  <Etiqueta texto={STATUS[v.status].texto} cor={STATUS[v.status].cor} />
                  <span className="text-black/55">
                    {[v.vigente_desde ? `vigente desde ${dataBr(v.vigente_desde)}` : null, v.publicado_em ? `publicada em ${dataBr(v.publicado_em)}` : null].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <ParametrosPublicados parametros={publicado.parametros} />
        </>
      )}
    </div>
  );
}
