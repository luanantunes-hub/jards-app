"use client";

import { useEffect, useState } from "react";
import { DIAS_DEPOIS, fraseDoEfeito, fraseDoPico, type PicoSemExplicacao } from "@/lib/ticketeria/imprensa";
import type { ImprensaDaLoja } from "@/lib/ticketeria/imprensa-servidor";

// A imprensa na aba Ações e gasto (lib/ticketeria/imprensa.ts): o aviso de venda que subiu sem anúncio a mais ("saiu algo na imprensa?") e cada crítica ou matéria com o que as vendas
// mostraram, mais o peso de cada veículo na casa. Os dados vêm de GET /api/ticketeria/lojas/{id}/imprensa (só quem edita a Ticketeria).

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";

/** A imprensa da loja; null enquanto carrega ou quando não dá para ler (a aba segue sem ela). */
export function useImprensa(lojaId: string | null, versao = 0): ImprensaDaLoja | null {
  const [dados, setDados] = useState<{ chave: string; imprensa: ImprensaDaLoja } | null>(null);
  const chave = `${lojaId}|${versao}`;
  useEffect(() => {
    if (!lojaId) return;
    let ativo = true;
    void fetch(`/api/ticketeria/lojas/${lojaId}/imprensa`)
      .then(r => (r.ok ? (r.json() as Promise<ImprensaDaLoja>) : null))
      .then(i => { if (ativo && i) setDados({ chave, imprensa: i }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [lojaId, chave]);
  return dados?.chave === chave ? dados.imprensa : null;
}

/** As vendas subiram sem anúncio a mais: saiu algo na imprensa? */
export function PicoSemExplicacaoAviso({ pico, onRegistrar, onDescartar }: { pico: PicoSemExplicacao; onRegistrar: () => void; onDescartar: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-[0.875rem] text-[#282525]">As vendas subiram sem anúncio a mais</p>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-black/55">{fraseDoPico(pico)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button type="button" onClick={onDescartar} className="text-[0.78rem] text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Não foi imprensa</button>
        <button type="button" onClick={onRegistrar} className="inline-flex h-10 items-center rounded-xl bg-[#7259B5] px-4 text-[0.78rem] font-normal text-white transition hover:bg-[#634CA3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Sim, registrar</button>
      </div>
    </div>
  );
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** As críticas e matérias marcadas, com o que as vendas mostraram em cada uma, e o peso de cada veículo na casa. Nada aparece sem marcação. */
export function ImprensaDaLojaView({ imprensa, onAbrir }: { imprensa: ImprensaDaLoja; onAbrir?: (id: string) => void }) {
  if (imprensa.marcacoes.length === 0) return null;
  const medidos = imprensa.veiculos.filter(v => v.media !== null);
  return (
    <section aria-labelledby="imprensa-da-loja" className="space-y-2">
      <h3 id="imprensa-da-loja" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Imprensa</h3>
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Veículo e assunto</th><th className={CABECALHO}>Saiu em</th><th className={CABECALHO}>Evento</th><th className={CABECALHO}>O que as vendas mostraram</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {imprensa.marcacoes.map(m => (
              <tr key={m.id} className={onAbrir ? "cursor-pointer hover:bg-black/[.02]" : undefined} onClick={onAbrir ? () => onAbrir(m.id) : undefined}>
                <td className={CELULA}>{m.veiculo}{m.assunto && <span className="text-black/45"> · {m.assunto}</span>}</td>
                <td className={`${CELULA} tabular-nums`}>{diaMes(m.dia)}</td>
                <td className={CELULA}>{m.evento ?? <span className="text-black/45">Da casa toda</span>}</td>
                <td className="px-4 py-3">
                  {m.efeito.tipo === "efeito"
                    ? <span className="inline-flex rounded-xl border px-2.5 py-0.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{fraseDoEfeito(m.efeito)}</span>
                    : <span className="text-[0.75rem] text-black/45">{fraseDoEfeito(m.efeito)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/45">
        O efeito de cada marcação vem das vendas daquele evento: os {DIAS_DEPOIS} dias depois de sair, comparados com o que ele vinha vendendo, sem a mudança de anúncio.
        {medidos.length > 0 && <> Por veículo, na sua casa: {medidos.map((v, i) => <span key={v.veiculo}>{i > 0 && "; "}<span className="text-[#282525]">{v.veiculo}</span>, {v.vezes === 1 ? "1 vez" : `${v.vezes} vezes`}, {v.media && v.media > 0 ? `em média cerca de ${v.media} a mais` : "sem diferença nas vendas"}</span>)}.</>}
        {" "}Nada aqui vem de uma lista de veículos importantes: o peso é o que o seu público mostrou.
      </p>
    </section>
  );
}

// ─── O monitoramento da imprensa (lib/ticketeria/imprensa-monitor.ts): o que o Jards achou e os veículos que ele acompanha ─

export type VeiculoAcompanhado = { id: string; nome: string; site: string; origem: string; situacao: "aguardando" | "lendo" | "sem_rss" | "bloqueado" | "erro"; noticias: number; achados: number };
export type AchadoDaImprensa = { id: string; veiculo: string; titulo: string; link: string; dia: string; evento: string; motivo: string };

/** Uma leitura de rota da imprensa (veículos ou achados); null enquanto carrega ou quando não dá para ler. */
export function useDaImprensa<T>(lojaId: string | null, caminho: "veiculos" | "achados", versao = 0): T | null {
  const [dados, setDados] = useState<{ chave: string; valor: T } | null>(null);
  const chave = `${lojaId}|${caminho}|${versao}`;
  useEffect(() => {
    if (!lojaId) return;
    let ativo = true;
    void fetch(`/api/ticketeria/lojas/${lojaId}/imprensa/${caminho}`)
      .then(r => (r.ok ? (r.json() as Promise<T>) : null))
      .then(v => { if (ativo && v) setDados({ chave, valor: v }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [lojaId, caminho, chave]);
  return dados?.chave === chave ? dados.valor : null;
}

const quando = (dia: string, hoje: string): string => {
  const d = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86400000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : diaMes(dia);
};

/** O que a leitura achou: os dúbios esperam confirmação; os claros já entraram, com "Desfazer". Nada aparece sem achado. */
export function AchadosDaImprensaView({ aConfirmar, registrados, hoje, ocupado, onDecidir }: { aConfirmar: AchadoDaImprensa[]; registrados: AchadoDaImprensa[]; hoje: string; ocupado?: string | null; onDecidir: (id: string, acao: "confirmar" | "descartar" | "desfazer") => void }) {
  if (aConfirmar.length === 0 && registrados.length === 0) return null;
  const linha = (a: AchadoDaImprensa, acoes: React.ReactNode) => (
    <tr key={a.id}>
      <td className={CELULA}><span>{a.veiculo}</span><a href={a.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 block text-[0.75rem] text-black/45 hover:text-[#7259B5] hover:underline">“{a.titulo}”</a></td>
      <td className={`${CELULA} whitespace-nowrap`}>{a.evento}</td>
      <td className={`${CELULA} whitespace-nowrap`}>{quando(a.dia, hoje)}<span className="mt-0.5 block text-[0.6875rem] text-black/40">{a.motivo}</span></td>
      <td className="whitespace-nowrap px-4 py-3 text-right">{acoes}</td>
    </tr>
  );
  const texto = "text-[0.75rem] text-black/40 transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40";
  return (
    <section aria-labelledby="achados-da-imprensa" className="space-y-2">
      <h3 id="achados-da-imprensa" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Encontramos na imprensa</h3>
      {aConfirmar.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <table className="w-full min-w-[44rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Precisa da sua confirmação</th><th className={CABECALHO}>Evento</th><th className={CABECALHO}>Quando</th><th className={CABECALHO} /></tr></thead>
            <tbody className="divide-y divide-black/[.08]">{aConfirmar.map(a => linha(a, <>
              <button type="button" disabled={ocupado === a.id} onClick={() => onDecidir(a.id, "descartar")} className={`mr-3.5 ${texto}`}>Não é sobre o evento</button>
              <button type="button" disabled={ocupado === a.id} onClick={() => onDecidir(a.id, "confirmar")} className="inline-flex h-8 items-center rounded-xl bg-[#7259B5] px-3 text-[0.75rem] font-normal text-white transition hover:bg-[#634CA3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">É, registrar</button>
            </>))}</tbody>
          </table>
        </div>
      )}
      {registrados.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <table className="w-full min-w-[44rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Registrado sozinho</th><th className={CABECALHO}>Evento</th><th className={CABECALHO}>Quando</th><th className={CABECALHO} /></tr></thead>
            <tbody className="divide-y divide-black/[.08]">{registrados.map(a => linha(a, <>
              <span className="mr-3 inline-flex rounded-xl border px-2 py-0.5 text-[0.625rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>registrado sozinho</span>
              <button type="button" disabled={ocupado === a.id} onClick={() => onDecidir(a.id, "desfazer")} className={texto}>Desfazer</button>
            </>))}</tbody>
          </table>
        </div>
      )}
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/45">Entra sozinho quando a notícia cita o nome do evento e também o nome do espaço ou do artista, enquanto o evento está à venda. Quando só aparece o nome do evento, o Jards pergunta. O que entrar vira uma marcação de imprensa como as outras, medida pelas vendas dos dias seguintes.</p>
    </section>
  );
}

const ROTULO_DA_SITUACAO: Record<VeiculoAcompanhado["situacao"], { texto: string; cor: string; borda: string }> = {
  lendo: { texto: "lendo", cor: "#2E8932", borda: "#2E893259" }, aguardando: { texto: "ainda não lido", cor: "rgba(13,13,13,.5)", borda: BORDA },
  bloqueado: { texto: "o site bloqueia a leitura automática", cor: "#B07A14", borda: "rgba(176,122,20,.4)" }, sem_rss: { texto: "não achamos o RSS deste site", cor: "rgba(13,13,13,.5)", borda: BORDA },
  erro: { texto: "não deu para ler na última vez", cor: "#B07A14", borda: "rgba(176,122,20,.4)" },
};

/** Os veículos que o Jards acompanha para a casa: colar um site para acompanhar, a situação de cada um e "parar de acompanhar". As sugestões são os veículos marcados à mão. */
export function VeiculosAcompanhadosView({ veiculos, sugestoes, onAcompanhar, onParar }: {
  veiculos: VeiculoAcompanhado[]; sugestoes: { nome: string; vezes: number }[];
  /** Devolve a mensagem de erro, ou null se acompanhou. */ onAcompanhar: (site: string) => Promise<string | null>; onParar: (id: string) => void;
}) {
  const [site, setSite] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function acompanhar() {
    setSalvando(true); setErro(null);
    const e = await onAcompanhar(site);
    setSalvando(false);
    if (e) setErro(e); else setSite("");
  }
  return (
    <section aria-labelledby="veiculos-acompanhados" className="space-y-2">
      <h3 id="veiculos-acompanhados" className="text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Veículos que o Jards acompanha</h3>
      <form className="flex flex-wrap items-center gap-2.5" onSubmit={e => { e.preventDefault(); void acompanhar(); }}>
        <input aria-label="Endereço do site" value={site} onChange={e => setSite(e.target.value)} maxLength={300} disabled={salvando} placeholder="Cole o endereço do site (ex.: portaldacidade.com.br)"
          className="h-10 min-w-0 flex-1 basis-72 rounded-xl border bg-white px-3.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]" style={{ borderColor: BORDA }} />
        <button type="submit" disabled={salvando || site.trim() === ""} className="inline-flex h-10 items-center rounded-xl bg-[#2E8932] px-4 text-[0.78rem] font-normal text-white transition hover:bg-[#277A2B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">{salvando ? "Procurando o RSS…" : "Acompanhar"}</button>
      </form>
      {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B]">{erro}</p>}
      {sugestoes.length > 0 && <p className="text-[0.75rem] text-black/50">Você marcou à mão: {sugestoes.map((s, i) => <span key={s.nome}>{i > 0 && ", "}<span className="text-[#282525]">{s.nome}</span> ({s.vezes === 1 ? "1 vez" : `${s.vezes} vezes`})</span>)}. Cole o site para o Jards acompanhar.</p>}
      {veiculos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <table className="w-full min-w-[40rem] border-collapse">
            <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Veículo</th><th className={CABECALHO}>Situação</th><th className={`${CABECALHO} text-right`}>Nos últimos 30 dias</th><th className={CABECALHO} /></tr></thead>
            <tbody className="divide-y divide-black/[.08]">
              {veiculos.map(v => {
                const s = ROTULO_DA_SITUACAO[v.situacao];
                const bloqueio = v.situacao === "bloqueado" || v.situacao === "sem_rss";
                return (
                  <tr key={v.id}>
                    <td className={CELULA}>{v.nome}<span className="mt-0.5 block text-[0.6875rem] text-black/40">{v.origem === "padrao" ? "já vem na lista" : "você acrescentou"}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex rounded-xl border px-2 py-0.5 text-[0.6875rem]" style={{ color: s.cor, borderColor: s.borda }}>{s.texto}{v.situacao === "lendo" && v.noticias > 0 ? ` · ${v.noticias} notícias na última leitura` : ""}</span></td>
                    <td className={`${CELULA} text-right text-black/50`}>{bloqueio ? "registre à mão" : v.achados === 0 ? "—" : v.achados === 1 ? "1 achado" : `${v.achados} achados`}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => onParar(v.id)} className="text-[0.75rem] text-black/40 transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Parar de acompanhar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/45">Três vezes por dia o Jards lê as notícias desses veículos e procura o nome dos seus eventos à venda. Nas matérias abertas, procura no texto inteiro; nas fechadas (assinatura), só no título e no resumo. Nada é copiado: o Jards guarda o título, o link e a data, e respeita o que cada site permite à leitura automática. TV, rádio e impresso sem site continuam pelo registro à mão.</p>
    </section>
  );
}
