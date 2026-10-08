"use client";

// Vigia normativo (P1.10, P6.1 e P6.2): os atos do Diário Oficial e as
// mudanças nas páginas e arquivos dos órgãos que as coletas guardaram para
// conferir, as últimas coletas e as fontes vigiadas. Conferir é dizer se o ato
// ou a mudança afeta um regime do módulo, e quais; aí a IA lê o documento e
// propõe a nova versão de cada regime, com o trecho da norma conferido.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, RefreshCw, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { chaveDoArquivo, type ArquivoLigado } from "@/supabase/functions/_shared/vigia-paginas";
import { DiferencaDasVersoes } from "./DiferencaDasVersoes";
import { ConjuntoDeTeste } from "./ConjuntoDeTeste";
import { FontesVigiadas } from "./FontesVigiadas";
import { PropostasDoDocumento, type Proposta } from "./PropostasDoDocumento";

type Documento = {
  id: string;
  fonte_id: string | null;
  regimes: string[];
  publicado_em: string;
  edicao: string | null;
  orgao: string;
  tipo_ato: string | null;
  titulo: string | null;
  ementa: string | null;
  url: string | null;
  motivos: string[];
  situacao: "novo" | "conferido" | "descartado";
  nota: string | null;
  conferido_em: string | null;
  arquivo: string | null;
  arquivos: ArquivoLigado[];
  anterior_id: string | null;
  atualizado_na_fonte: string | null;
};
type Execucao = {
  id: string;
  agente: "vigia_dou" | "vigia_paginas" | "leitor_normas" | "avaliador_normas";
  referencia: string;
  situacao: "rodando" | "ok" | "sem_edicao" | "falhou";
  lidos: number;
  rotina: number;
  relevantes: number;
  novos: number;
  detalhe: string | null;
  iniciada_em: string;
};
type Aba = Documento["situacao"] | "fontes" | "teste";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "novo", rotulo: "Para conferir" },
  { id: "conferido", rotulo: "Afetam um regime" },
  { id: "descartado", rotulo: "Descartados" },
  { id: "fontes", rotulo: "Fontes vigiadas" },
  { id: "teste", rotulo: "Conjunto de teste" },
];
const NOME_DO_AGENTE: Record<Execucao["agente"], string> = {
  vigia_dou: "Diário Oficial", vigia_paginas: "Páginas", leitor_normas: "Leitura pela IA", avaliador_normas: "Conjunto de teste",
};
const SITUACAO_DA_COLETA: Record<Execucao["situacao"], { texto: string; cor: string }> = {
  ok: { texto: "Lida", cor: "#2E8932" },
  sem_edicao: { texto: "Sem Diário", cor: "#6B6B6B" },
  falhou: { texto: "Falhou", cor: "#B23B3B" },
  rodando: { texto: "Lendo", cor: "#2D72B0" },
};
const CAMPOS_DO_DOCUMENTO = "id, fonte_id, regimes, publicado_em, edicao, orgao, tipo_ato, titulo, ementa, url, motivos, situacao, nota, conferido_em, arquivo, arquivos, anterior_id, atualizado_na_fonte";
const CAMPOS_DA_PROPOSTA = "id, documento_id, regime_codigo, classificacao, resumo, mudancas, descartadas, checagens_novas, regime_proposto, vigencia_proposta, transicao, prestacoes_afetadas, organizacoes_afetadas, status, created_at";

type RegimeDoCatalogo = { codigo: string; nome: string };

// Ato do Diário: o regime sugerido pelos motivos da triagem e pelo órgão.
const SUGESTOES: [RegExp, string][] = [
  [/rouanet|8\.313|cultura/i, "rouanet_in29_2026"],
  [/esporte|11\.438|lc 222|12\.861/i, "lie_p10_2026"],
  [/ancine|audiovisual|2\.228|8\.685/i, "ancine_in159_2021"],
  [/pronon|pronas|lxxxvi|12\.715|saúde/i, "pronon_pronas_lxxxvi_a_2025"],
];

function regimesSugeridos(d: Documento, regimesDaFonte: Record<string, string[]>): string[] {
  if (d.regimes.length) return d.regimes;
  if (d.fonte_id && regimesDaFonte[d.fonte_id]?.length) return regimesDaFonte[d.fonte_id];
  const texto = [...d.motivos, d.orgao, d.titulo ?? "", d.ementa ?? ""].join(" ");
  return SUGESTOES.filter(([padrao]) => padrao.test(texto)).map(([, codigo]) => codigo);
}

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const horaBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hojeEmBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
/** Os dois primeiros níveis do órgão: "Ministério da Cultura/Gabinete do Ministro". */
const orgaoCurto = (orgao: string) => orgao.split("/").slice(0, 2).join(" / ");
const ehVersaoDePagina = (d: Pick<Documento, "tipo_ato">) => d.tipo_ato === "Página" || d.tipo_ato === "Arquivo";
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Etiqueta({ texto, cor = "rgba(13,13,13,.6)" }: { texto: string; cor?: string }) {
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor.startsWith("#") ? `${cor}47` : "rgba(13,13,13,.12)", color: cor }}>
      {texto}
    </span>
  );
}

const LINK = "inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/50 underline decoration-black/20 underline-offset-2 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]";

/** Texto do ato, ou a mudança da página em relação à versão anterior, lidos só quando abertos. */
function Leitura({ d }: { d: Documento }) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [textos, setTextos] = useState<{ agora: string; antes: string | null; arquivosAntes: ArquivoLigado[] } | null>(null);
  const [erro, setErro] = useState(false);
  const pagina = ehVersaoDePagina(d);

  useEffect(() => {
    if (!aberto || textos) return;
    let ativo = true;
    const ids = [d.id, d.anterior_id].filter(Boolean) as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
    (supabase as any).from("normas_documentos").select("id, texto, arquivos").in("id", ids)
      .then(({ data, error }: { data: { id: string; texto: string; arquivos: ArquivoLigado[] }[] | null; error: unknown }) => {
        if (!ativo) return;
        if (error || !data) { setErro(true); return; }
        const agora = data.find(x => x.id === d.id);
        const antes = d.anterior_id ? data.find(x => x.id === d.anterior_id) : undefined;
        setTextos({ agora: agora?.texto ?? "", antes: antes?.texto ?? null, arquivosAntes: antes?.arquivos ?? [] });
      });
    return () => { ativo = false; };
  }, [aberto, textos, d.id, d.anterior_id, supabase]);

  const novos = useMemo(() => {
    if (!textos || !pagina) return [];
    const antes = new Set(textos.arquivosAntes.map(a => chaveDoArquivo(a.url)));
    return d.arquivos.filter(a => !antes.has(chaveDoArquivo(a.url)));
  }, [textos, pagina, d.arquivos]);

  return (
    <details className="mt-2" onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer rounded text-[0.6875rem] text-black/50 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        {pagina ? "Ver a mudança" : "Ler o texto"}
      </summary>
      <div className="mt-2 max-h-[32rem] overflow-y-auto rounded border px-3 py-2" style={BORDA}>
        {erro ? (
          <p className="text-[0.75rem] text-[#B23B3B]">Não foi possível carregar o texto.</p>
        ) : !textos ? (
          <div className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
        ) : pagina ? (
          <div className="space-y-3">
            {textos.antes === null
              ? <p className="whitespace-pre-line text-[0.75rem] leading-relaxed text-black/70">{textos.agora.length > 8000 ? `${textos.agora.slice(0, 8000)}…` : textos.agora}</p>
              : <DiferencaDasVersoes antes={textos.antes} agora={textos.agora} />}
            {novos.length > 0 && (
              <div className="border-t pt-2" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Arquivos novos na página</p>
                <ul className="mt-1 space-y-0.5">
                  {novos.map(a => (
                    <li key={a.url}><a href={a.url} target="_blank" rel="noreferrer" className={LINK}>{a.nome} <ExternalLink size={11} aria-hidden /></a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-line text-[0.75rem] leading-relaxed text-black/70">{textos.agora.length > 6000 ? `${textos.agora.slice(0, 6000)}…` : textos.agora}</p>
        )}
      </div>
    </details>
  );
}

function CartaoDoAto({ d, ocupado, onDecidir, onCopia, regimes, sugeridos, propostas, regimesAtuais, lendo, onLer }: {
  d: Documento;
  ocupado: boolean;
  onDecidir: (situacao: Documento["situacao"], nota: string, regimes?: string[]) => void;
  onCopia: (caminho: string) => void;
  regimes: RegimeDoCatalogo[];
  sugeridos: string[];
  propostas: Proposta[];
  regimesAtuais: Record<string, unknown>;
  lendo: boolean;
  onLer: () => void;
}) {
  const [nota, setNota] = useState(d.nota ?? "");
  const [escolhendo, setEscolhendo] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>(sugeridos);
  const pagina = ehVersaoDePagina(d);
  const nomes = useMemo(() => Object.fromEntries(regimes.map(r => [r.codigo, r.nome])), [regimes]);
  const botao = "h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
  const cabecalho = pagina
    ? [d.tipo_ato, d.orgao, `coletada em ${dataBr(d.publicado_em)}`, d.atualizado_na_fonte && /^\d{2}\/\d{2}\/\d{4}/.test(d.atualizado_na_fonte) ? `a página diz atualizada em ${d.atualizado_na_fonte.slice(0, 10)}` : null]
    : [d.tipo_ato, orgaoCurto(d.orgao), `${dataBr(d.publicado_em)}${d.edicao === "DO1E" ? ", edição extra" : ""}`];
  return (
    <li className="rounded border bg-white px-5 py-4" style={BORDA}>
      <p className="text-[0.6875rem] text-black/45">{cabecalho.filter(Boolean).join(" · ")}</p>
      <h2 className="mt-1 text-[0.875rem] font-semibold text-[#0D0D0D]">{d.titulo || "Ato sem título"}</h2>
      {d.ementa && (
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/70">
          {pagina && <span className="text-black/45">Primeiro trecho que mudou: </span>}
          {pagina ? `“${d.ementa}”` : d.ementa}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {d.motivos.map(m => <Etiqueta key={m} texto={m} />)}
        {d.url && (
          <a href={d.url} target="_blank" rel="noreferrer" className={`ml-1 ${LINK}`}>
            {pagina ? "Abrir no site do órgão" : "Abrir no Diário Oficial"} <ExternalLink size={11} aria-hidden />
          </a>
        )}
        {d.arquivo && (
          <button type="button" onClick={() => onCopia(d.arquivo!)} className={`ml-1 ${LINK}`}>
            Cópia guardada <Download size={11} aria-hidden />
          </button>
        )}
      </div>
      {d.situacao === "conferido" && d.regimes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.6875rem] text-black/45">Afeta:</span>
          {d.regimes.map(c => <Etiqueta key={c} texto={nomes[c] ?? c} />)}
        </div>
      )}
      <Leitura d={d} />
      {d.situacao === "conferido" && (
        <PropostasDoDocumento propostas={propostas} nomes={nomes} regimesAtuais={regimesAtuais} lendo={lendo} onLer={onLer} />
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Nota sobre o ato</span>
          <input value={nota} onChange={e => setNota(e.target.value)} maxLength={1000} placeholder="Nota (opcional): o que muda e em qual regime"
            className="h-9 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        {d.situacao === "novo" ? (
          <>
            <button type="button" disabled={ocupado} aria-expanded={escolhendo} onClick={() => setEscolhendo(e => !e)} className={botao}>Afeta um regime</button>
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
      {escolhendo && d.situacao === "novo" && (
        <fieldset className="mt-3 rounded border px-4 py-3" style={BORDA}>
          <legend className="px-1 text-[0.6875rem] text-black/55">Quais regimes {pagina ? "a mudança" : "o ato"} afeta? A IA lê e propõe a nova versão de cada um.</legend>
          <div className="flex flex-wrap gap-1.5">
            {regimes.map(regime => {
              const marcado = escolhidos.includes(regime.codigo);
              return (
                <button key={regime.codigo} type="button" aria-pressed={marcado}
                  onClick={() => setEscolhidos(atual => marcado ? atual.filter(c => c !== regime.codigo) : [...atual, regime.codigo])}
                  className="min-h-9 rounded border bg-white px-2.5 py-1 text-left text-[0.6875rem] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                  style={marcado ? { borderColor: "#7259B5", color: "#7259B5" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.6)" }}>
                  {regime.nome}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setEscolhendo(false)}
              className="h-9 rounded px-3 text-[0.75rem] text-black/55 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
            <button type="button" disabled={ocupado || escolhidos.length === 0}
              onClick={() => { setEscolhendo(false); onDecidir("conferido", nota, escolhidos); }}
              className="h-9 rounded bg-[#2E8932] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-50">
              Confirmar e propor mudanças
            </button>
          </div>
        </fieldset>
      )}
    </li>
  );
}

function ResumoDaColeta({ e }: { e: Execucao }) {
  if (e.situacao !== "ok" || e.agente === "avaliador_normas") return e.detalhe ? <span className="text-black/50">{e.detalhe}</span> : null;
  if (e.agente === "leitor_normas") {
    return (
      <span className="tabular-nums text-black/55">
        {plural(e.lidos, "regime lido", "regimes lidos")} · {plural(e.novos, "com mudança proposta", "com mudança proposta")}
        {e.detalhe ? <span className="text-black/45"> · {e.detalhe}</span> : null}
      </span>
    );
  }
  if (e.agente === "vigia_paginas") {
    return (
      <span className="tabular-nums text-black/55">
        {plural(e.lidos, "fonte lida", "fontes lidas")} · {e.rotina} sem mudança · {plural(e.novos, "mudança", "mudanças")}
        {e.relevantes > e.novos ? ` · ${plural(e.relevantes - e.novos, "referência", "referências")}` : ""}
        {e.detalhe ? <span className="text-black/45"> · {e.detalhe}</span> : null}
      </span>
    );
  }
  return (
    <span className="tabular-nums text-black/55">
      {e.lidos} atos lidos · {e.rotina} de rotina · {e.relevantes} na triagem · {e.novos} {e.novos === 1 ? "novo" : "novos"}
    </span>
  );
}

export default function AdminNormasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [fontes, setFontes] = useState(0);
  const [regimesDaFonte, setRegimesDaFonte] = useState<Record<string, string[]>>({});
  const [regimes, setRegimes] = useState<RegimeDoCatalogo[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [regimesAtuais, setRegimesAtuais] = useState<Record<string, unknown>>({});
  const [lendo, setLendo] = useState<Set<string>>(new Set());
  const [aba, setAba] = useState<Aba>("novo");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [dia, setDia] = useState(hojeEmBrasilia);

  const buscar = useCallback(async () => {
    const [docs, execs, fontesVigiadas, catalogo, props] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("normas_documentos").select(CAMPOS_DO_DOCUMENTO).neq("situacao", "referencia")
        .order("publicado_em", { ascending: false }).order("created_at", { ascending: false }).limit(300),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("agente_execucoes").select("id, agente, referencia, situacao, lidos, rotina, relevantes, novos, detalhe, iniciada_em")
        .order("iniciada_em", { ascending: false }).limit(12),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      (supabase as any).from("normas_fontes").select("id, regimes, ativa"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
      (supabase as any).from("prestacao_regimes").select("codigo, nome").eq("status", "publicado").neq("codigo", "generico").order("nome"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
      (supabase as any).from("prestacao_regime_propostas").select(CAMPOS_DA_PROPOSTA).neq("status", "substituida")
        .order("created_at", { ascending: false }).limit(200),
    ]);
    // Os parâmetros publicados só dos regimes com proposta, para dar nome aos caminhos.
    const codigos = [...new Set(((props.data ?? []) as Proposta[]).map(p => p.regime_codigo))];
    const atuais = codigos.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
      ? await (supabase as any).from("prestacao_regimes").select("codigo, parametros").eq("status", "publicado").in("codigo", codigos)
      : { data: [] };
    return { docs, execs, fontesVigiadas, catalogo, props, atuais };
  }, [supabase]);

  const aplicar = useCallback(({ docs, execs, fontesVigiadas, catalogo, props, atuais }: Awaited<ReturnType<typeof buscar>>) => {
    if (docs.error || execs.error) { setErro("Não foi possível carregar os atos."); return; }
    setDocumentos(docs.data as Documento[]);
    setExecucoes(execs.data as Execucao[]);
    const lista = (fontesVigiadas.data ?? []) as { id: string; regimes: string[]; ativa: boolean }[];
    setFontes(lista.filter(f => f.ativa).length);
    setRegimesDaFonte(Object.fromEntries(lista.map(f => [f.id, f.regimes ?? []])));
    setRegimes((catalogo.data ?? []) as RegimeDoCatalogo[]);
    setPropostas((props.data ?? []) as Proposta[]);
    setRegimesAtuais(Object.fromEntries(((atuais.data ?? []) as { codigo: string; parametros: unknown }[]).map(r => [r.codigo, r.parametros])));
  }, []);

  const recarregar = useCallback(async () => aplicar(await buscar()), [buscar, aplicar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  async function decidir(d: Documento, situacao: Documento["situacao"], nota: string, escolhidos?: string[]) {
    setOcupado(d.id);
    setErro("");
    setAviso("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_normas_documento_conferir", {
      p_documento_id: d.id, p_situacao: situacao, p_nota: nota, p_regimes: escolhidos ?? null,
    });
    setOcupado(null);
    if (error) {
      setErro(error.message?.includes("regimes_obrigatorios") ? "Escolha ao menos um regime que o documento afeta." : "Não foi possível salvar a conferência.");
      return;
    }
    await recarregar();
    // Confirmado que afeta regimes: a IA já começa a ler.
    if (situacao === "conferido" && escolhidos) {
      setAba("conferido");
      await ler(d);
    }
  }

  async function ler(d: Documento) {
    setLendo(atual => new Set(atual).add(d.id));
    setErro("");
    const { data, error } = await supabase.functions.invoke("agente-normativo", { body: { modo: "ler", documento_id: d.id } });
    setLendo(atual => { const novo = new Set(atual); novo.delete(d.id); return novo; });
    const r = data as { situacao?: string; detalhe?: string | null } | null;
    if (error && !r?.situacao) setErro("Não foi possível pedir a leitura à IA agora.");
    else if (r?.situacao === "falhou") setErro(`A leitura falhou: ${r.detalhe ?? "sem detalhe"}.`);
    else if (r?.detalhe) setAviso(`Leitura feita, com ressalvas: ${r.detalhe}.`);
    await recarregar();
  }

  async function abrirCopia(caminho: string) {
    const { data, error } = await supabase.storage.from("normas").createSignedUrl(caminho, 300);
    if (error || !data?.signedUrl) { setErro("Não foi possível abrir a cópia guardada."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
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
    await recarregar();
  }

  const contagem = useMemo(() => {
    const porSituacao: Record<string, number> = { fontes };
    for (const d of documentos ?? []) porSituacao[d.situacao] = (porSituacao[d.situacao] ?? 0) + 1;
    return porSituacao;
  }, [documentos, fontes]);
  const daAba = (documentos ?? []).filter(d => d.situacao === aba);

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#0D0D0D]">Vigia normativo</h1>
          <p className="mt-0.5 max-w-[48rem] text-sm text-black/45">
            Todo dia às 8h, a seção 1 do Diário Oficial da União é lida no INLABS: ficam os atos que citam as normas dos regimes ou que vêm do Ministério da Cultura, da ANCINE e do Ministério do Esporte tratando de prestação de contas ou de incentivo. Às 9h37, as leis compiladas, as normas consolidadas e as páginas de manuais e modelos dos órgãos são comparadas com a última versão guardada.
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
            {ocupado === "coleta" ? "Lendo o Diário…" : "Coletar o Diário"}
          </button>
        </div>
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}
      {aviso && <p role="status" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893240" }}>{aviso}</p>}

      <section className="rounded border bg-white" style={BORDA} aria-labelledby="titulo-coletas">
        <h2 id="titulo-coletas" className="border-b px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40" style={{ borderColor: "rgba(13,13,13,.06)" }}>Últimas coletas</h2>
        {execucoes.length === 0 ? (
          <p className="px-5 py-4 text-[0.75rem] text-black/45">Nenhuma coleta ainda. A primeira roda amanhã às 8h, ou agora pelo botão Coletar o Diário.</p>
        ) : (
          <ul className="divide-y divide-black/[.06]">
            {execucoes.map(e => {
              const s = e.agente === "vigia_paginas" && e.situacao === "sem_edicao" ? SITUACAO_DA_COLETA.ok : SITUACAO_DA_COLETA[e.situacao];
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-[0.75rem]">
                  <span className="w-[5.5rem] tabular-nums text-black/75">{dataBr(e.referencia)}</span>
                  <span className="w-[7.5rem] text-black/55">{NOME_DO_AGENTE[e.agente] ?? "Diário Oficial"}</span>
                  <Etiqueta texto={s.texto} cor={s.cor} />
                  <ResumoDaColeta e={e} />
                  <span className="ml-auto text-[0.6875rem] text-black/35">{horaBr(e.iniciada_em)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex gap-2" role="tablist" aria-label="Atos, mudanças e fontes">
          {ABAS.map(a => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
              className="h-9 shrink-0 rounded border bg-white px-3 text-[0.75rem] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              style={aba === a.id ? { borderColor: "#7259B5", color: "#7259B5" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.6)" }}>
              {a.rotulo}{a.id === "teste" ? "" : ` (${contagem[a.id] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {aba === "fontes" ? (
        <FontesVigiadas onColetou={recarregar} />
      ) : aba === "teste" ? (
        <ConjuntoDeTeste />
      ) : !documentos && !erro ? (
        <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-36 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : daAba.length === 0 ? (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <ScrollText size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">
            {aba === "novo" ? "Nada para conferir. Os atos e as mudanças de página aparecem aqui depois das coletas, e o aviso chega pelas notificações." : "Nada nesta situação."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {daAba.map(d => (
            <CartaoDoAto key={`${d.id}:${d.situacao}`} d={d} ocupado={!!ocupado} onDecidir={(s, n, r) => decidir(d, s, n, r)} onCopia={abrirCopia}
              regimes={regimes} sugeridos={regimesSugeridos(d, regimesDaFonte)}
              propostas={propostas.filter(p => p.documento_id === d.id)} regimesAtuais={regimesAtuais}
              lendo={lendo.has(d.id)} onLer={() => ler(d)} />
          ))}
        </ul>
      )}
    </div>
  );
}
