"use client";

// Fontes vigiadas (P6.1): o Diário Oficial e as páginas e arquivos dos órgãos
// que a rotina diária confere pela frequência de cada um. O super admin inclui,
// edita, pausa e coleta uma fonte na hora. Fonte não se apaga: as versões
// guardadas iriam junto.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Pencil, Plus, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";

export type Fonte = {
  id: string;
  codigo: string;
  nome: string;
  tipo: "dou_inlabs" | "pagina" | "arquivo";
  url: string | null;
  ativa: boolean;
  configuracao: { recorte?: { de: string; ate?: string | null } } | null;
  orgao: string | null;
  area: string | null;
  regimes: string[];
  frequencia_dias: number;
  ultima_coleta_em: string | null;
  ultima_mudanca_em: string | null;
  ultimo_erro: string | null;
  falhas_seguidas: number;
};

type Regime = { codigo: string; nome: string };
type UltimaVersao = { fonte_id: string; arquivo: string | null; created_at: string };

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const ICONE = "flex h-9 w-9 items-center justify-center rounded text-black/45 transition hover:bg-black/[.04] hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40";

const TIPOS = [
  { value: "pagina", label: "Página" },
  { value: "arquivo", label: "Arquivo (PDF, Word, planilha)" },
];
const AREAS = [
  { value: "cultura", label: "Cultura" },
  { value: "esporte", label: "Esporte" },
  { value: "audiovisual", label: "Audiovisual" },
  { value: "saude", label: "Saúde" },
  { value: "outro", label: "Outra" },
];
const ROTULO_DO_TIPO: Record<Fonte["tipo"], string> = { dou_inlabs: "Diário Oficial", pagina: "Página", arquivo: "Arquivo" };

const ERROS: Record<string, string> = {
  nome_invalido: "Dê um nome de 3 a 200 caracteres.",
  url_invalida: "Informe o endereço completo, começando com https://.",
  url_repetida: "Esse endereço já é vigiado.",
  frequencia_invalida: "A frequência vai de 1 a 90 dias.",
  regime_inexistente: "Um dos regimes escolhidos não existe mais.",
  texto_longo: "Órgão e recorte aceitam até 200 caracteres.",
  sem_permissao: "Só o super admin cadastra fontes.",
};

const horaBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Etiqueta({ texto, cor = "rgba(13,13,13,.6)" }: { texto: string; cor?: string }) {
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: cor.startsWith("#") ? `${cor}47` : "rgba(13,13,13,.12)", color: cor }}>
      {texto}
    </span>
  );
}

type Rascunho = {
  nome: string;
  url: string;
  tipo: string;
  orgao: string;
  area: string;
  frequencia: string;
  regimes: string[];
  recorteDe: string;
  recorteAte: string;
  ativa: boolean;
};

function rascunhoDe(fonte: Fonte | null): Rascunho {
  return {
    nome: fonte?.nome ?? "",
    url: fonte?.url ?? "",
    tipo: fonte?.tipo === "arquivo" ? "arquivo" : "pagina",
    orgao: fonte?.orgao ?? "",
    area: fonte?.area ?? "",
    frequencia: String(fonte?.frequencia_dias ?? 7),
    regimes: fonte?.regimes ?? [],
    recorteDe: fonte?.configuracao?.recorte?.de ?? "",
    recorteAte: fonte?.configuracao?.recorte?.ate ?? "",
    ativa: fonte?.ativa ?? true,
  };
}

function FormularioDaFonte({ fonte, regimes, onFechar, onSalvo }: {
  fonte: Fonte | null;
  regimes: Regime[];
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(fonte));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const muda = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => setR(atual => ({ ...atual, [campo]: valor }));

  async function salvar() {
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_normas_fonte_salvar", {
      p_id: fonte?.id ?? null,
      p_dados: {
        nome: r.nome, url: r.url, tipo: r.tipo, orgao: r.orgao, area: r.area || null,
        frequencia_dias: Number(r.frequencia) || 0, regimes: r.regimes,
        recorte_de: r.recorteDe, recorte_ate: r.recorteAte, ativa: r.ativa,
      },
    });
    setSalvando(false);
    if (error) {
      const codigo = Object.keys(ERROS).find(c => error.message?.includes(c));
      setErro(codigo ? ERROS[codigo] : "Não foi possível salvar a fonte.");
      return;
    }
    onSalvo(fonte ? "Fonte salva." : "Fonte incluída. A primeira coleta, na rotina de amanhã ou pelo botão de coletar, fica como referência.");
  }

  return (
    <ModalPrestacao
      titulo={fonte ? "Editar fonte" : "Incluir fonte"}
      subtitulo="Página ou arquivo de um órgão que o vigia confere"
      onClose={onFechar}
      rodape={(
        <>
          <button type="button" onClick={onFechar} className="h-10 rounded px-3 text-[0.75rem] text-black/55 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando}
            className="h-10 rounded acao-salvar px-4 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Salvando…" : fonte ? "Salvar" : "Incluir fonte"}
          </button>
        </>
      )}
    >
      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className={ROTULO}>Nome</span>
          <input value={r.nome} onChange={e => muda("nome", e.target.value)} maxLength={200} placeholder="Ex.: Manual do proponente da Lei Rouanet" className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>Endereço</span>
          <input value={r.url} onChange={e => muda("url", e.target.value)} inputMode="url" placeholder="https://www.gov.br/…" className={CAMPO} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={ROTULO}>Tipo</span>
            <Dropdown value={r.tipo} onChange={v => muda("tipo", v)} options={TIPOS} ariaLabel="Tipo da fonte" />
          </div>
          <div>
            <span className={ROTULO}>Área</span>
            <Dropdown value={r.area} onChange={v => muda("area", v)} options={AREAS} ariaLabel="Área" placeholder="Escolha a área" />
          </div>
          <label className="block">
            <span className={ROTULO}>Órgão</span>
            <input value={r.orgao} onChange={e => muda("orgao", e.target.value)} maxLength={200} placeholder="Ex.: Ministério da Cultura" className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Conferir a cada (dias)</span>
            <input value={r.frequencia} onChange={e => muda("frequencia", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${CAMPO} tabular-nums`} />
          </label>
        </div>
        <fieldset>
          <legend className={ROTULO}>Regimes que a fonte sustenta</legend>
          <div className="flex flex-wrap gap-1.5">
            {regimes.map(regime => {
              const marcado = r.regimes.includes(regime.codigo);
              return (
                <button key={regime.codigo} type="button" aria-pressed={marcado}
                  onClick={() => muda("regimes", marcado ? r.regimes.filter(c => c !== regime.codigo) : [...r.regimes, regime.codigo])}
                  className="min-h-9 rounded border bg-white px-2.5 py-1 text-left text-[0.6875rem] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                  style={marcado ? { borderColor: "#7259B5", color: "#7259B5" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.6)" }}>
                  {regime.nome}
                </button>
              );
            })}
          </div>
        </fieldset>
        <details className="rounded border px-4 py-3" style={BORDA} open={!!(r.recorteDe || r.recorteAte)}>
          <summary className="cursor-pointer rounded text-[0.75rem] text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Mais detalhes</summary>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-black/45">
            Para páginas enormes em que só um trecho importa: a leitura começa na linha que começa com o primeiro texto e para antes da que começa com o segundo. Escreva como aparece na página, com as mesmas maiúsculas.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={ROTULO}>Começa na linha</span>
              <input value={r.recorteDe} onChange={e => muda("recorteDe", e.target.value)} maxLength={200} placeholder="Ex.: ANEXO LXXXVI" className={CAMPO} />
            </label>
            <label className="block">
              <span className={ROTULO}>Para antes da linha</span>
              <input value={r.recorteAte} onChange={e => muda("recorteAte", e.target.value)} maxLength={200} placeholder="Ex.: ANEXO LXXXVII" className={CAMPO} />
            </label>
          </div>
        </details>
        <label className="flex min-h-10 items-center gap-2 text-[0.75rem] text-black/70">
          <input type="checkbox" checked={r.ativa} onChange={e => muda("ativa", e.target.checked)} className="h-4 w-4 accent-[#7259B5]" />
          Vigiar esta fonte (desmarque para pausar)
        </label>
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

type ResultadoDaColeta = {
  situacao?: string;
  detalhe?: string | null;
  error?: string;
  resultados?: { situacao: string; motivos?: string[]; erro?: string }[];
};

function mensagemDaColeta(r: ResultadoDaColeta | null): { texto: string; erro: boolean } {
  const resultado = r?.resultados?.[0];
  if (!resultado) return { texto: "Não foi possível coletar a fonte agora.", erro: true };
  switch (resultado.situacao) {
    case "igual": return { texto: "Sem mudança desde a última coleta.", erro: false };
    case "referencia": return { texto: "Coleta guardada como referência. As próximas são comparadas com ela.", erro: false };
    case "repetida": return { texto: "A fonte voltou a uma versão já guardada.", erro: false };
    case "nova": return { texto: `Mudou: ${resultado.motivos?.join("; ")}. A mudança está em Para conferir.`, erro: false };
    default: return { texto: `A coleta falhou: ${resultado.erro ?? "sem detalhe"}.`, erro: true };
  }
}

export function FontesVigiadas({ onColetou }: { onColetou: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [fontes, setFontes] = useState<Fonte[] | null>(null);
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [versoes, setVersoes] = useState<Record<string, UltimaVersao>>({});
  const [editando, setEditando] = useState<Fonte | "nova" | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  const buscar = useCallback(async () => Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
    (supabase as any).from("normas_fontes").select("id, codigo, nome, tipo, url, ativa, configuracao, orgao, area, regimes, frequencia_dias, ultima_coleta_em, ultima_mudanca_em, ultimo_erro, falhas_seguidas").order("tipo").order("nome"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
    (supabase as any).from("prestacao_regimes").select("codigo, nome").eq("status", "publicado").neq("codigo", "generico").order("nome"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
    (supabase as any).from("normas_documentos").select("fonte_id, arquivo, created_at").in("tipo_ato", ["Página", "Arquivo"]).order("created_at", { ascending: false }).limit(500),
  ]), [supabase]);

  const aplicar = useCallback(([f, r, v]: Awaited<ReturnType<typeof buscar>>) => {
    if (f.error) { setMensagem({ texto: "Não foi possível carregar as fontes.", erro: true }); return; }
    setFontes(f.data as Fonte[]);
    setRegimes((r.data ?? []) as Regime[]);
    const ultimas: Record<string, UltimaVersao> = {};
    for (const versao of (v.data ?? []) as UltimaVersao[]) if (!ultimas[versao.fonte_id]) ultimas[versao.fonte_id] = versao;
    setVersoes(ultimas);
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [buscar, aplicar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  async function coletar(fonte: Fonte) {
    setOcupado(fonte.id);
    setMensagem(null);
    const { data } = await supabase.functions.invoke("agente-normativo", { body: { modo: "paginas", fonte_id: fonte.id } });
    setOcupado(null);
    setMensagem(mensagemDaColeta(data as ResultadoDaColeta | null));
    await carregar();
    onColetou();
  }

  async function abrirCopia(caminho: string) {
    const { data, error } = await supabase.storage.from("normas").createSignedUrl(caminho, 300);
    if (error || !data?.signedUrl) { setMensagem({ texto: "Não foi possível abrir a cópia guardada.", erro: true }); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function pausar(fonte: Fonte) {
    setOcupado(fonte.id);
    setMensagem(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_normas_fonte_salvar", { p_id: fonte.id, p_dados: { ativa: !fonte.ativa } });
    setOcupado(null);
    if (error) setMensagem({ texto: "Não foi possível mudar a fonte.", erro: true });
    await carregar();
  }

  const nomeDoRegime = (codigo: string) => regimes.find(r => r.codigo === codigo)?.nome ?? codigo;

  return (
    <section aria-labelledby="titulo-fontes" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="titulo-fontes" className="max-w-[44rem] text-[0.75rem] text-black/50">
          Todo dia às 9h37, as páginas e os arquivos vencidos pela frequência são baixados. Mudou o texto ou a lista de arquivos, a versão nova vai para Para conferir, com a diferença lado a lado.
        </p>
        <button type="button" onClick={() => setEditando("nova")}
          className="flex h-9 items-center gap-1.5 rounded bg-[#1C0E33] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
          <Plus size={14} aria-hidden /> Incluir fonte
        </button>
      </div>

      {mensagem && (
        <p role={mensagem.erro ? "alert" : "status"} className="rounded border bg-white px-4 py-2.5 text-[0.75rem]"
          style={mensagem.erro ? { borderColor: "#D94A4A40", color: "#B23B3B" } : { borderColor: "#2E893240", color: "#2E8932" }}>
          {mensagem.texto}
        </p>
      )}

      {!fontes ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : (
        <ul className="divide-y divide-black/[.06] rounded border bg-white" style={BORDA}>
          {fontes.map(fonte => {
            const pagina = fonte.tipo !== "dou_inlabs";
            const versao = versoes[fonte.id];
            return (
              <li key={fonte.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className={`text-[0.8125rem] font-medium ${fonte.ativa ? "text-[#282525]" : "text-black/45"}`}>{fonte.nome}</h3>
                    <Etiqueta texto={ROTULO_DO_TIPO[fonte.tipo]} />
                    {!fonte.ativa && <Etiqueta texto="Pausada" />}
                    {fonte.falhas_seguidas > 0 && (
                      <Etiqueta texto={fonte.falhas_seguidas === 1 ? "Falhou na última coleta" : `Sem resposta há ${fonte.falhas_seguidas} coletas`} cor="#B23B3B" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[0.6875rem] text-black/45">
                    {[
                      fonte.orgao,
                      pagina ? `a cada ${fonte.frequencia_dias} ${fonte.frequencia_dias === 1 ? "dia" : "dias"}` : "todo dia útil",
                      fonte.ultima_coleta_em ? `coletada em ${horaBr(fonte.ultima_coleta_em)}` : "ainda não coletada",
                      fonte.ultima_mudanca_em ? `mudou em ${horaBr(fonte.ultima_mudanca_em)}` : null,
                      fonte.configuracao?.recorte?.de ? `a partir de "${fonte.configuracao.recorte.de}"` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {fonte.ultimo_erro && <p className="mt-0.5 text-[0.6875rem] text-[#B23B3B]">{fonte.ultimo_erro}</p>}
                  {fonte.regimes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">{fonte.regimes.map(c => <Etiqueta key={c} texto={nomeDoRegime(c)} />)}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 sm:-mr-2">
                  {fonte.url && pagina && (
                    <a href={fonte.url} target="_blank" rel="noreferrer" className={ICONE} aria-label={`Abrir ${fonte.nome}`} title="Abrir no site do órgão">
                      <ExternalLink size={14} aria-hidden />
                    </a>
                  )}
                  {versao?.arquivo && (
                    <button type="button" onClick={() => abrirCopia(versao.arquivo!)} className={ICONE} aria-label={`Baixar a última cópia guardada de ${fonte.nome}`} title="Última cópia guardada">
                      <Download size={14} aria-hidden />
                    </button>
                  )}
                  {pagina && (
                    <button type="button" onClick={() => coletar(fonte)} disabled={!!ocupado} className={ICONE} aria-label={`Coletar ${fonte.nome} agora`} title="Coletar agora">
                      <RefreshCw size={14} className={ocupado === fonte.id ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
                    </button>
                  )}
                  {pagina ? (
                    <button type="button" onClick={() => setEditando(fonte)} className={ICONE} aria-label={`Editar ${fonte.nome}`} title="Editar">
                      <Pencil size={14} aria-hidden />
                    </button>
                  ) : (
                    <button type="button" onClick={() => pausar(fonte)} disabled={!!ocupado}
                      className="h-9 rounded px-3 text-[0.75rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40">
                      {fonte.ativa ? "Pausar" : "Retomar"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <FormularioDaFonte
          fonte={editando === "nova" ? null : editando}
          regimes={regimes}
          onFechar={() => setEditando(null)}
          onSalvo={texto => { setEditando(null); setMensagem({ texto, erro: false }); carregar(); }}
        />
      )}
    </section>
  );
}
