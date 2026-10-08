"use client";

// Vigia do Diário Oficial (P1.10): os atos que a coleta diária guardou para
// conferir, as últimas coletas e a coleta de um dia escolhido. Conferir é
// dizer se o ato afeta um regime do módulo; na fase 6, o agente normativo lê
// os que afetam e propõe a nova versão do regime.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Documento = {
  id: string;
  publicado_em: string;
  edicao: string | null;
  orgao: string;
  tipo_ato: string | null;
  titulo: string | null;
  ementa: string | null;
  texto: string;
  url: string | null;
  motivos: string[];
  situacao: "novo" | "conferido" | "descartado";
  nota: string | null;
  conferido_em: string | null;
};
type Execucao = {
  id: string;
  referencia: string;
  situacao: "rodando" | "ok" | "sem_edicao" | "falhou";
  lidos: number;
  rotina: number;
  relevantes: number;
  novos: number;
  detalhe: string | null;
  iniciada_em: string;
};

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ABAS: { id: Documento["situacao"]; rotulo: string }[] = [
  { id: "novo", rotulo: "Para conferir" },
  { id: "conferido", rotulo: "Afetam um regime" },
  { id: "descartado", rotulo: "Descartados" },
];
const SITUACAO_DA_COLETA: Record<Execucao["situacao"], { texto: string; cor: string }> = {
  ok: { texto: "Lida", cor: "#2E8932" },
  sem_edicao: { texto: "Sem Diário", cor: "#6B6B6B" },
  falhou: { texto: "Falhou", cor: "#B23B3B" },
  rodando: { texto: "Lendo", cor: "#2D72B0" },
};

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const horaBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hojeEmBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
/** Os dois primeiros níveis do órgão: "Ministério da Cultura/Gabinete do Ministro". */
const orgaoCurto = (orgao: string) => orgao.split("/").slice(0, 2).join(" / ");

function Etiqueta({ texto, cor = "rgba(13,13,13,.6)" }: { texto: string; cor?: string }) {
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor.startsWith("#") ? `${cor}47` : "rgba(13,13,13,.12)", color: cor }}>
      {texto}
    </span>
  );
}

function CartaoDoAto({ d, ocupado, onDecidir }: { d: Documento; ocupado: boolean; onDecidir: (situacao: Documento["situacao"], nota: string) => void }) {
  const [nota, setNota] = useState(d.nota ?? "");
  const botao = "h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
  return (
    <li className="rounded border bg-white px-5 py-4" style={BORDA}>
      <p className="text-[0.6875rem] text-black/45">
        {[d.tipo_ato, orgaoCurto(d.orgao), `${dataBr(d.publicado_em)}${d.edicao === "DO1E" ? ", edição extra" : ""}`].filter(Boolean).join(" · ")}
      </p>
      <h2 className="mt-1 text-[0.875rem] font-semibold text-[#0D0D0D]">{d.titulo || "Ato sem título"}</h2>
      {d.ementa && <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/70">{d.ementa}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {d.motivos.map(m => <Etiqueta key={m} texto={m} />)}
        {d.url && (
          <a href={d.url} target="_blank" rel="noreferrer"
            className="ml-1 inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/50 underline decoration-black/20 underline-offset-2 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Abrir no Diário Oficial <ExternalLink size={11} aria-hidden />
          </a>
        )}
      </div>
      <details className="mt-2 group">
        <summary className="cursor-pointer rounded text-[0.6875rem] text-black/50 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Ler o texto</summary>
        <p className="mt-2 max-h-[20rem] overflow-y-auto whitespace-pre-line rounded bg-black/[.03] px-3 py-2 text-[0.75rem] leading-relaxed text-black/70">
          {d.texto.length > 6000 ? `${d.texto.slice(0, 6000)}…` : d.texto}
        </p>
      </details>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Nota sobre o ato</span>
          <input value={nota} onChange={e => setNota(e.target.value)} maxLength={1000} placeholder="Nota (opcional): o que muda e em qual regime"
            className="h-9 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        {d.situacao === "novo" ? (
          <>
            <button type="button" disabled={ocupado} onClick={() => onDecidir("conferido", nota)} className={botao}>Afeta um regime</button>
            <button type="button" disabled={ocupado} onClick={() => onDecidir("descartado", nota)} className={botao}>Não afeta</button>
          </>
        ) : (
          <>
            {d.conferido_em && <span className="text-[0.6875rem] text-black/40">Conferido em {horaBr(d.conferido_em)}</span>}
            <button type="button" disabled={ocupado} onClick={() => onDecidir(d.situacao, nota)} className={botao}>Salvar a nota</button>
            <button type="button" disabled={ocupado} onClick={() => onDecidir("novo", nota)} className={botao}>Voltar para conferir</button>
          </>
        )}
      </div>
    </li>
  );
}

export default function AdminNormasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [aba, setAba] = useState<Documento["situacao"]>("novo");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [dia, setDia] = useState(hojeEmBrasilia);

  const buscar = useCallback(async () => {
    const [docs, execs] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("normas_documentos").select("id, publicado_em, edicao, orgao, tipo_ato, titulo, ementa, texto, url, motivos, situacao, nota, conferido_em")
        .order("publicado_em", { ascending: false }).order("created_at", { ascending: false }).limit(300),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("agente_execucoes").select("id, referencia, situacao, lidos, rotina, relevantes, novos, detalhe, iniciada_em")
        .eq("agente", "vigia_dou").order("iniciada_em", { ascending: false }).limit(10),
    ]);
    return { docs, execs };
  }, [supabase]);

  const aplicar = useCallback(({ docs, execs }: Awaited<ReturnType<typeof buscar>>) => {
    if (docs.error || execs.error) { setErro("Não foi possível carregar os atos."); return; }
    setDocumentos(docs.data as Documento[]);
    setExecucoes(execs.data as Execucao[]);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  async function decidir(d: Documento, situacao: Documento["situacao"], nota: string) {
    setOcupado(d.id);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_normas_documento_conferir", { p_documento_id: d.id, p_situacao: situacao, p_nota: nota });
    setOcupado(null);
    if (error) { setErro("Não foi possível salvar a conferência."); return; }
    aplicar(await buscar());
  }

  async function coletar() {
    setOcupado("coleta");
    setErro("");
    setAviso("");
    const { data, error } = await supabase.functions.invoke("agente-normativo", { body: { data: dia } });
    setOcupado(null);
    const r = data as { situacao?: string; lidos?: number; relevantes?: number; novos?: number; detalhe?: string } | null;
    if (error && !r?.situacao) setErro("Não foi possível coletar o Diário agora.");
    else if (r?.situacao === "falhou") setErro(`A coleta falhou: ${r.detalhe ?? "sem detalhe"}.`);
    else if (r?.situacao === "sem_edicao") setAviso(`Sem Diário Oficial da seção 1 em ${dataBr(dia)}.`);
    else if (r) setAviso(`${dataBr(dia)}: ${r.lidos} atos lidos, ${r.relevantes} na triagem, ${r.novos} ${r.novos === 1 ? "novo" : "novos"}.`);
    aplicar(await buscar());
  }

  const contagem = useMemo(() => Object.fromEntries(ABAS.map(a => [a.id, (documentos ?? []).filter(d => d.situacao === a.id).length])), [documentos]);
  const daAba = (documentos ?? []).filter(d => d.situacao === aba);

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#0D0D0D]">Vigia do Diário Oficial</h1>
          <p className="mt-0.5 max-w-[48rem] text-sm text-black/45">
            Todo dia às 8h, a seção 1 do Diário Oficial da União é lida no INLABS. Ficam aqui os atos que citam as normas dos regimes (Lei Rouanet, Lei de Incentivo ao Esporte, ANCINE, PRONON e PRONAS/PCD) ou que vêm do Ministério da Cultura, da ANCINE e do Ministério do Esporte tratando de prestação de contas ou de incentivo. Aprovações de projeto, nomeações e outros atos de rotina ficam de fora.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label>
            <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Dia do Diário</span>
            <input type="date" value={dia} max={hojeEmBrasilia()} onChange={e => setDia(e.target.value)}
              className="h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] tabular-nums text-black outline-none focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
          </label>
          <button type="button" onClick={coletar} disabled={!!ocupado || !dia}
            className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw size={13} className={ocupado === "coleta" ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
            {ocupado === "coleta" ? "Lendo o Diário…" : "Coletar"}
          </button>
        </div>
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}
      {aviso && <p role="status" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893240" }}>{aviso}</p>}

      <section className="rounded border bg-white" style={BORDA} aria-labelledby="titulo-coletas">
        <h2 id="titulo-coletas" className="border-b px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40" style={{ borderColor: "rgba(13,13,13,.06)" }}>Últimas coletas</h2>
        {execucoes.length === 0 ? (
          <p className="px-5 py-4 text-[0.75rem] text-black/45">Nenhuma coleta ainda. A primeira roda amanhã às 8h, ou agora pelo botão Coletar.</p>
        ) : (
          <ul className="divide-y divide-black/[.06]">
            {execucoes.map(e => {
              const s = SITUACAO_DA_COLETA[e.situacao];
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-[0.75rem]">
                  <span className="w-[5.5rem] tabular-nums text-black/75">{dataBr(e.referencia)}</span>
                  <Etiqueta texto={s.texto} cor={s.cor} />
                  {e.situacao === "ok" && (
                    <span className="tabular-nums text-black/55">
                      {e.lidos} atos lidos · {e.rotina} de rotina · {e.relevantes} na triagem · {e.novos} {e.novos === 1 ? "novo" : "novos"}
                    </span>
                  )}
                  {e.situacao !== "ok" && e.detalhe && <span className="text-black/50">{e.detalhe}</span>}
                  <span className="ml-auto text-[0.6875rem] text-black/35">{horaBr(e.iniciada_em)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Situação dos atos">
        {ABAS.map(a => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className="h-9 rounded border bg-white px-3 text-[0.75rem] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            style={aba === a.id ? { borderColor: "#7259B5", color: "#7259B5" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.6)" }}>
            {a.rotulo} ({contagem[a.id] ?? 0})
          </button>
        ))}
      </div>

      {!documentos && !erro ? (
        <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-36 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : daAba.length === 0 ? (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <ScrollText size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">
            {aba === "novo" ? "Nenhum ato para conferir. Os atos novos aparecem aqui depois da coleta diária, e o aviso chega pelas notificações." : "Nenhum ato nesta situação."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {daAba.map(d => <CartaoDoAto key={`${d.id}:${d.situacao}`} d={d} ocupado={!!ocupado} onDecidir={(s, n) => decidir(d, s, n)} />)}
        </ul>
      )}
    </div>
  );
}
