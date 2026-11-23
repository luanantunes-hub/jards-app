"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { MAX_ASSUNTO, MAX_MENSAGEM, acaoDoEnvio, enderecoDeCompraDoEnvio, type CanalDoEnvio, type PessoaDoWhatsapp, type Segmento } from "@/lib/ticketeria/envios";
import { porcentagem } from "@/lib/ticketeria/eventos-de-email";
import { whatsappEmTexto } from "@/lib/ticketeria/publico";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { AREA, Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";
import { SeloDePrecisao } from "@/components/ticketeria/PainelView";
import type { EfeitoDoEnvio } from "@/lib/ticketeria/envios-controle";
import type { ParaQuemFunciona } from "@/lib/ticketeria/envios-controle-servidor";

// Os envios do Público (a tela do produtor): a lista com o resultado em vendas e a folha de um novo envio. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
// `relative`: o texto `sr-only` do cabeçalho (posicionado de forma absoluta) fica dentro da célula; solto, contava como parte da página e criava um segundo scroll, com espaço em branco, em listas compridas.
const CABECALHO = "relative px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const SECUNDARIO = "rounded-xl border bg-white px-3.5 py-2.5 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const FINAL = "rounded-xl acao-principal px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

export type EnvioParaLista = { /** O que o envio trouxe a mais (grupo de comparação) e os ingressos de quem recebeu em 90 dias (lib/ticketeria/envios-controle.ts). */ efeito?: EfeitoDoEnvio | null; de_quem_recebeu?: number | null; id: string; assunto: string; canal: string; quando: string; destinatarios: number; enviados: number; falhas: number; abertos?: number; cliques?: number; devolvidos?: number; situacao: string; ingressos: number; vendido_centavos: number };
export type SessaoParaEscolher = { id: string; evento: string; quando: string };

const dia = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(",", " às"); } catch { return iso; } };

/** Abriram ou clicaram: a porcentagem dos enviados e, embaixo, quantas pessoas. No WhatsApp não há como saber (traço). */
function Taxa({ canal, parte, total }: { canal: string; parte: number; total: number }) {
  const p = canal === "whatsapp" ? null : porcentagem(parte, total);
  if (p === null) return <span className="text-black/30">—</span>;
  return <>{p}%<span className="block text-[0.6875rem] text-black/45">{parte.toLocaleString("pt-BR")}</span></>;
}

/** Os envios feitos, do mais novo ao mais antigo, com o que cada um vendeu. */
export function EnviosDaLoja({ envios, onContinuar }: { envios: EnvioParaLista[]; onContinuar?: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
      {envios.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <Send size={28} className="mb-3 text-black/15" aria-hidden="true" />
          <p className="text-[0.875rem] font-medium text-black/55">Nenhum envio ainda</p>
        </div>
      ) : (
        <table className="w-full min-w-[52rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Envio</th><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Enviados</th><th className={`${CABECALHO} text-right`}>Abriram</th><th className={`${CABECALHO} text-right`}>Clicaram</th><th className={`${CABECALHO} text-right`}>Ingressos de quem recebeu</th><th className={`${CABECALHO} text-right`}>Trouxe a mais</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {envios.map(e => (
              <tr key={e.id}>
                <td className={CELULA}><p>{e.assunto}</p><p className="text-[0.6875rem] text-black/45">{dia(e.quando)}</p></td>
                <td className={`${CELULA} whitespace-nowrap`}>{e.canal === "whatsapp" ? "WhatsApp" : "E-mail"}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{e.canal === "whatsapp" || e.situacao === "enviando" ? `${e.enviados.toLocaleString("pt-BR")} de ${e.destinatarios.toLocaleString("pt-BR")}` : e.enviados.toLocaleString("pt-BR")}{e.canal === "whatsapp" && e.enviados < e.destinatarios && <button type="button" onClick={() => onContinuar?.(e.id)} className="mt-0.5 block w-full rounded-xl text-right text-[0.6875rem] text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Continuar</button>}{e.falhas > 0 && <span className="block text-[0.6875rem] text-[#B23B3B]">{e.falhas.toLocaleString("pt-BR")} não saíram</span>}{(e.devolvidos ?? 0) > 0 && <span className="block text-[0.6875rem] text-[#B23B3B]">{(e.devolvidos ?? 0).toLocaleString("pt-BR")} {e.devolvidos === 1 ? "voltou" : "voltaram"}</span>}{e.situacao === "enviando" && e.canal !== "whatsapp" && <span className="block text-[0.6875rem] text-black/45">enviando…</span>}</td>
                <td className={`${CELULA} text-right tabular-nums`}><Taxa canal={e.canal} parte={e.abertos ?? 0} total={e.enviados} /></td>
                <td className={`${CELULA} text-right tabular-nums`}><Taxa canal={e.canal} parte={e.cliques ?? 0} total={e.enviados} /></td>
                <td className={`${CELULA} text-right tabular-nums`}>{(e.de_quem_recebeu ?? e.ingressos).toLocaleString("pt-BR")}{e.vendido_centavos > 0 && <span className="block text-[0.6875rem] text-black/45">{formatarMoeda(e.vendido_centavos)} pelo link</span>}</td>
                <td className={`${CELULA} text-right`}><TrouxeAMais efeito={e.efeito ?? null} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const sinal = (n: number) => (n > 0 ? `+${n.toLocaleString("pt-BR")}` : n.toLocaleString("pt-BR"));
/** "+21 ingressos, entre +9 e +33", "não deu para ver diferença", "medindo: faltam 87 dias" ou um traço (envio sem grupo de comparação). */
function TrouxeAMais({ efeito }: { efeito: EfeitoDoEnvio | null }) {
  if (!efeito || efeito.tipo === "sem_comparacao") return <span className="text-black/30">—</span>;
  if (efeito.tipo === "medindo") return <span className="text-[0.75rem] text-black/45">medindo: {efeito.faltam === 1 ? "falta 1 dia" : `faltam ${efeito.faltam} dias`}</span>;
  if (efeito.tipo === "sem_diferenca") return <span className="text-[0.75rem] text-black/45">não deu para ver diferença</span>;
  return <><span className="tabular-nums text-[#2E8932]">{sinal(efeito.ingressos)} {Math.abs(efeito.ingressos) === 1 ? "ingresso" : "ingressos"}</span><span className="block text-[0.6875rem] tabular-nums text-black/45">entre {sinal(efeito.baixo)} e {sinal(efeito.alto)}</span></>;
}

const umaCasa = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
/** Para quem o e-mail funciona na casa: somando os envios medidos, os ingressos a mais a cada 100 e-mails por tipo de público, e a conta de "só para quem comprou no último ano". */
export function ParaQuemFuncionaView({ dados }: { dados: ParaQuemFunciona | null }) {
  if (!dados) return <p className="rounded-xl border bg-white px-4 py-3 text-[0.75rem] leading-relaxed text-black/50" style={{ borderColor: BORDA }}>Cada envio por e-mail separa 10% das pessoas, sorteadas, que não recebem. Noventa dias depois do primeiro envio assim, aparece aqui para quem o e-mail funciona na sua casa.</p>;
  const maior = Math.max(0.1, ...dados.tipos.map(t => t.porCem));
  return (
    <section aria-labelledby="para-quem-funciona" className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
          <div><p id="para-quem-funciona" className="text-[0.875rem] text-[#282525]">Para quem o e-mail funciona na sua casa</p><p className="mt-0.5 text-[0.75rem] text-black/45">Somando {dados.envios === 1 ? "o envio" : `os ${dados.envios} envios`} com grupo de comparação e 90 dias medidos: os ingressos que o e-mail trouxe a mais, a cada 100 e-mails, por há quanto tempo a pessoa comprou pela última vez.</p></div>
          <SeloDePrecisao selo={dados.envios >= 5 ? "razoavel" : "impreciso"} />
        </div>
        <ul className="divide-y divide-black/[.08] border-t" style={{ borderColor: BORDA }}>
          {dados.tipos.map(t => (
            <li key={t.tipo} className="grid grid-cols-[minmax(10rem,16rem)_1fr_auto] items-center gap-4 px-4 py-2.5">
              <span className="text-[0.8125rem] text-[#282525]">{t.rotulo}<span className="block text-[0.6875rem] text-black/45">{t.pessoas.toLocaleString("pt-BR")} {t.pessoas === 1 ? "pessoa" : "pessoas"}</span></span>
              <span className="h-2.5 rounded-full" style={{ width: `${Math.max(2, (Math.max(0, t.porCem) / maior) * 100)}%`, background: t.pesa ? "#7259B5" : "#D9D6DE" }} aria-hidden="true" />
              <span className="text-right text-[0.8125rem] tabular-nums text-[#282525]">{t.porCem > 0 ? `+${umaCasa(t.porCem)}` : umaCasa(t.porCem)}<span className="block text-[0.6875rem] text-black/45">{t.pesa ? "a cada 100 e-mails" : "não faz diferença"}</span></span>
            </li>
          ))}
        </ul>
      </div>
      {dados.soUltimoAno && <p className="rounded-xl border px-4 py-3 text-[0.78rem] leading-relaxed text-black/60" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}><span className="text-[#282525]">Se os envios tivessem ido só para quem comprou no último ano:</span> teriam trazido cerca de {Math.round(dados.soUltimoAno.parteDoEfeito * 100)}% dos ingressos a mais, com {Math.round(dados.soUltimoAno.menosEmails * 100)}% menos e-mails. A conta usa os próprios grupos de comparação, sem precisar de um teste novo.</p>}
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/45">“Trouxe a mais” compara quem recebeu com o grupo de comparação, que não recebeu, nos 90 dias seguintes, em qualquer canal de compra. Isto é da sua casa: em outra pode ser diferente, e muda com mais envios.</p>
    </section>
  );
}

/** O limite de e-mails de divulgação por pessoa em 7 dias, com o botão de mudar. */
export function LimitePorSemana({ limite, onMudar }: { limite: number; onMudar: (n: number) => void }) {
  return (
    <p className="text-[0.75rem] text-black/50">Limite: cada pessoa recebe no máximo
      <select aria-label="Limite de e-mails por semana" value={limite} onChange={e => onMudar(Number(e.target.value))} className="mx-1.5 rounded-lg border bg-white px-1.5 py-0.5 text-[0.75rem] text-[#282525]" style={{ borderColor: BORDA }}>
        {Array.from({ length: 14 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      {limite === 1 ? "e-mail" : "e-mails"} seus por semana. Quem já recebeu fica de fora do próximo envio.
    </p>
  );
}

export type PreviaDoEnvio = { segmento: number; enviar: number; comparacao: number; fora_pelo_limite: number; fora_pelas_preferencias: number; limite: number; sugestao: { ficam: number; total: number } | null };
export type DadosDoNovoEnvio = { canal: CanalDoEnvio; assunto: string; mensagem: string; sessao_id: string; segmento: string; comparacao: boolean; so_ultimo_ano: boolean };

/** A folha de um novo envio: para quem, a sessão, o assunto e a mensagem; o teste para você e o envio, que pede uma confirmação com o número de pessoas. */
export function NovoEnvioSheet({ segmentos, segmentosWhatsapp = [], canalInicial = "email", sessoes, ligado, motivoDoBloqueio, origem, erro, aviso, trabalhando, onTeste, onEnviar, onPrevia, onClose }: {
  segmentos: Segmento[]; segmentosWhatsapp?: Segmento[]; canalInicial?: CanalDoEnvio; sessoes: SessaoParaEscolher[]; ligado: boolean; /** Por que o e-mail não pode sair agora (assinatura, domínio…); sem isso, o texto padrão de "não está ligado". */ motivoDoBloqueio?: string | null; origem: string; erro?: string | null; aviso?: string | null; trabalhando?: boolean;
  onTeste?: (d: DadosDoNovoEnvio) => void; onEnviar?: (d: DadosDoNovoEnvio) => void; onClose: () => void;
  /** O que o envio por e-mail mandaria (grupo de comparação, limite, preferências, sugestão); sem isto, a folha usa o total do segmento. */ onPrevia?: (d: DadosDoNovoEnvio) => Promise<PreviaDoEnvio | null>;
}) {
  const [canal, setCanal] = useState<CanalDoEnvio>(canalInicial);
  const lista = canal === "whatsapp" ? segmentosWhatsapp : segmentos;
  const [segmento, setSegmento] = useState((canalInicial === "whatsapp" ? segmentosWhatsapp : segmentos)[0]?.id ?? "");
  const [sessao, setSessao] = useState(sessoes[0]?.id ?? "");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("Oi, {nome}!\n\n");
  const [confirmando, setConfirmando] = useState(false);
  const [comparacao, setComparacao] = useState(true);
  const [soUltimoAno, setSoUltimoAno] = useState(false);
  const [previa, setPrevia] = useState<{ chave: string; p: PreviaDoEnvio } | null>(null);
  const whatsapp = canal === "whatsapp";
  const dados: DadosDoNovoEnvio = { canal, assunto, mensagem, sessao_id: sessao, segmento, comparacao, so_ultimo_ano: soUltimoAno };
  // A prévia do e-mail: quantas pessoas recebem de fato (grupo de comparação, limite da semana, preferências) e a sugestão de para quem mandar.
  const chaveDaPrevia = `${segmento}|${sessao}|${comparacao}|${soUltimoAno}`;
  useEffect(() => {
    if (whatsapp || !onPrevia || !segmento || !sessao) return;
    let ativo = true;
    void onPrevia({ canal, assunto: "", mensagem: "", sessao_id: sessao, segmento, comparacao, so_ultimo_ano: soUltimoAno }).then(p => { if (ativo && p) setPrevia({ chave: chaveDaPrevia, p }); });
    return () => { ativo = false; };
  }, [whatsapp, onPrevia, segmento, sessao, comparacao, soUltimoAno, canal, chaveDaPrevia]);
  const p = !whatsapp && previa?.chave === chaveDaPrevia ? previa.p : null;
  const total = p ? p.enviar : lista.find(s => s.id === segmento)?.total ?? 0;
  const funciona = whatsapp || ligado;
  const pronto = funciona && total > 0 && sessao !== "" && assunto.trim() !== "" && mensagem.trim() !== "";
  const link = sessao !== "" && assunto.trim() !== "" ? enderecoDeCompraDoEnvio(origem, sessao, acaoDoEnvio(assunto, new Date(), canal), canal) : null;
  function mudarCanal(novo: CanalDoEnvio) {
    setCanal(novo);
    setSegmento((novo === "whatsapp" ? segmentosWhatsapp : segmentos)[0]?.id ?? "");
  }
  return (
    <TopSheet titulo="Novo envio" onClose={onClose} largura="40rem" footer={fechar => whatsapp ? (
      <>
        <button type="button" onClick={fechar} disabled={trabalhando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => onEnviar?.(dados)} disabled={trabalhando || !pronto} className={FINAL}>{trabalhando ? "Preparando…" : total > 0 ? `Preparar envio para ${total.toLocaleString("pt-BR")} ${total === 1 ? "pessoa" : "pessoas"}` : "Preparar envio"}</button>
      </>
    ) : confirmando ? (
      <>
        <button type="button" onClick={() => setConfirmando(false)} disabled={trabalhando} className={CANCELAR}>Voltar</button>
        <button type="button" onClick={() => onEnviar?.(dados)} disabled={trabalhando} className={FINAL}>{trabalhando ? "Enviando…" : `Confirmar o envio para ${total.toLocaleString("pt-BR")} ${total === 1 ? "pessoa" : "pessoas"}`}</button>
      </>
    ) : (
      <>
        <button type="button" onClick={fechar} disabled={trabalhando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => onTeste?.(dados)} disabled={trabalhando || !ligado || sessao === "" || assunto.trim() === "" || mensagem.trim() === ""} className={SECUNDARIO} style={{ borderColor: BORDA }}>Enviar teste para mim</button>
        <button type="button" onClick={() => setConfirmando(true)} disabled={trabalhando || !pronto} className={FINAL}>{total > 0 ? `Enviar para ${total.toLocaleString("pt-BR")} ${total === 1 ? "pessoa" : "pessoas"}` : "Enviar"}</button>
      </>
    )}>
      <div className="space-y-4">
        <div>
          <span className={ROTULO}>Canal</span>
          <div className="flex gap-2" role="group" aria-label="Canal do envio">
            {([["email", "E-mail"], ["whatsapp", "WhatsApp"]] as const).map(([id, rotulo]) => (
              <button key={id} type="button" aria-pressed={canal === id} onClick={() => mudarCanal(id)} disabled={trabalhando || confirmando}
                className={`rounded-xl border px-3 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${canal === id ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.04]"}`}
                style={canal === id ? undefined : { borderColor: BORDA }}>{rotulo}</button>
            ))}
          </div>
        </div>
        {!ligado && !whatsapp && <Aviso texto={motivoDoBloqueio ?? "O envio de e-mail ainda não está ligado. Fale com o suporte do Jards."} />}
        {erro && <Aviso texto={erro} />}
        {aviso && <p role="status" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}
        <div><span className={ROTULO}>Para quem</span>{lista.length === 0 ? <p className="text-[0.8125rem] text-black/45">{whatsapp ? "Ninguém aceitou novidades e informou o WhatsApp ainda." : "Ninguém aceitou receber novidades ainda."}</p> : <Dropdown ariaLabel="Para quem" value={segmento} onChange={setSegmento} options={lista.map(s => ({ value: s.id, label: `${s.rotulo} (${s.total.toLocaleString("pt-BR")})` }))} disabled={trabalhando || confirmando} />}</div>
        {!whatsapp && p && <BlocosDoControle p={p} soUltimoAno={soUltimoAno} comparacao={comparacao} desligado={!!trabalhando || confirmando} onSoUltimoAno={setSoUltimoAno} onComparacao={setComparacao} />}
        <div><span className={ROTULO}>Sessão que você quer vender</span>{sessoes.length === 0 ? <p className="text-[0.8125rem] text-black/45">Nenhuma sessão à venda.</p> : <Dropdown ariaLabel="Sessão" value={sessao} onChange={setSessao} options={sessoes.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))} disabled={trabalhando || confirmando} />}</div>
        <div><label className={ROTULO} htmlFor="envio-assunto">{whatsapp ? "Nome do envio" : "Assunto"}</label><input id="envio-assunto" className={CAMPO} value={assunto} onChange={e => setAssunto(e.target.value)} maxLength={MAX_ASSUNTO} disabled={trabalhando || confirmando} />
          {!whatsapp && <p className="mt-1.5 text-[0.75rem] text-black/45">{/\{nome\}/i.test(assunto) ? "O {nome} vira o primeiro nome de cada pessoa." : <>Com o nome da pessoa no assunto, mais gente abre e menos gente sai da lista. <button type="button" onClick={() => setAssunto(a => `{nome}, ${a.charAt(0).toLowerCase()}${a.slice(1)}`.trim())} disabled={trabalhando || confirmando} className="text-[#7259B5] hover:underline">Pôr o nome no assunto</button></>}</p>}</div>
        <div><label className={ROTULO} htmlFor="envio-mensagem">Mensagem</label><textarea id="envio-mensagem" className={`${AREA} min-h-[9rem]`} value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={MAX_MENSAGEM} disabled={trabalhando || confirmando} /><p className="mt-1.5 text-[0.75rem] text-black/45">{"{nome}"} vira o primeiro nome da pessoa.</p></div>
        {link && <p className="break-all rounded-xl bg-[#F6F5F8] px-3.5 py-2.5 text-[0.6875rem] leading-relaxed text-black/55">{link}</p>}
      </div>
    </TopSheet>
  );
}

/** A lista de um envio por WhatsApp: cada pessoa com o botão que abre a conversa (a mensagem já escrita, o link de compra marcado e o link para sair da lista); ao abrir, ela fica "enviada". */
export function ListaDoWhatsAppSheet({ assunto, pessoas, erro, onAbrir, onClose }: { assunto: string; pessoas: PessoaDoWhatsapp[]; erro?: string | null; onAbrir?: (p: PessoaDoWhatsapp) => void; onClose: () => void }) {
  const enviadas = pessoas.filter(p => p.enviada).length;
  return (
    <TopSheet titulo="Envio por WhatsApp" etiqueta={assunto} onClose={onClose} largura="40rem" footer={fechar => <button type="button" onClick={fechar} className={SECUNDARIO} style={{ borderColor: BORDA }}>Fechar</button>}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <p className="text-[0.75rem] text-black/55">{enviadas.toLocaleString("pt-BR")} de {pessoas.length.toLocaleString("pt-BR")} {pessoas.length === 1 ? "enviada" : "enviadas"}</p>
        {pessoas.length === 0 ? <p className="text-[0.8125rem] text-black/45">Ninguém na lista: quem saiu da lista depois de o envio ser preparado não aparece mais.</p> : (
          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
            <ul className="divide-y divide-black/[.08]">
              {pessoas.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0"><p className="truncate text-[0.8125rem] text-[#282525]">{p.nome}</p><p className="text-[0.6875rem] tabular-nums text-black/45">{whatsappEmTexto(p.whatsapp)}</p></div>
                  {p.enviada
                    ? <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: "#2E893247", color: "#2E8932" }}>ENVIADA</span>
                    : <button type="button" onClick={() => onAbrir?.(p)} className={SECUNDARIO} style={{ borderColor: BORDA }}>Abrir no WhatsApp</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TopSheet>
  );
}

/** No novo envio por e-mail: a sugestão "mandar só para quem comprou no último ano", o grupo de comparação (desligável) e quem fica de fora pelo limite e pelas preferências. */
function BlocosDoControle({ p, soUltimoAno, comparacao, desligado, onSoUltimoAno, onComparacao }: { p: PreviaDoEnvio; soUltimoAno: boolean; comparacao: boolean; desligado: boolean; onSoUltimoAno: (v: boolean) => void; onComparacao: (v: boolean) => void }) {
  const bloco = "rounded-xl border px-3.5 py-3 text-[0.75rem] leading-relaxed text-black/60";
  const roxo = { borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" };
  const fora = p.fora_pelo_limite + p.fora_pelas_preferencias;
  return (
    <div className="space-y-2.5">
      {p.sugestao && !soUltimoAno && (
        <div className={`${bloco} flex flex-wrap items-center justify-between gap-3`} style={roxo}>
          <span className="min-w-0 flex-1 basis-64"><span className="text-[#282525]">Na sua casa, o e-mail faz diferença para quem comprou no último ano.</span> Destas {p.sugestao.total.toLocaleString("pt-BR")} pessoas, {p.sugestao.ficam.toLocaleString("pt-BR")} compraram no último ano; as outras quase não respondem a e-mail.</span>
          <button type="button" disabled={desligado} onClick={() => onSoUltimoAno(true)} className="inline-flex h-9 shrink-0 items-center rounded-xl bg-[#7259B5] px-3.5 text-[0.75rem] font-normal text-white transition hover:bg-[#634CA3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">Mandar só para elas</button>
        </div>
      )}
      {soUltimoAno && <p className={bloco} style={roxo}><span className="text-[#282525]">Só quem comprou no último ano.</span> <button type="button" disabled={desligado} onClick={() => onSoUltimoAno(false)} className="text-[#7259B5] hover:underline">Voltar para todos</button></p>}
      {comparacao && p.comparacao > 0
        ? <p className={bloco} style={roxo}><span className="text-[#282525]">Grupo de comparação: {p.comparacao.toLocaleString("pt-BR")} {p.comparacao === 1 ? "pessoa não recebe" : "pessoas não recebem"} este e-mail.</span> O Jards sorteia quem fica de fora e, nos 90 dias seguintes, compara quanto os dois grupos compraram. Assim você sabe o que o e-mail trouxe a mais, e não só quem abriu. <button type="button" disabled={desligado} onClick={() => onComparacao(false)} className="text-[#7259B5] hover:underline">Desligar neste envio</button></p>
        : <p className={bloco} style={{ borderColor: BORDA }}>{comparacao ? "Envio pequeno: sem grupo de comparação (precisa de 50 pessoas ou mais)." : <>Sem grupo de comparação neste envio: ele não vai dizer o que trouxe a mais. <button type="button" disabled={desligado} onClick={() => onComparacao(true)} className="text-[#7259B5] hover:underline">Ligar de novo</button></>}</p>}
      {fora > 0 && <p className={bloco} style={{ borderColor: BORDA }}><span className="text-[#282525]">{fora.toLocaleString("pt-BR")} {fora === 1 ? "pessoa fica" : "pessoas ficam"} de fora</span>{p.fora_pelo_limite > 0 ? ` (${p.fora_pelo_limite.toLocaleString("pt-BR")} já receberam ${p.limite} e-mails seus nesta semana)` : ""}{p.fora_pelas_preferencias > 0 ? `${p.fora_pelo_limite > 0 ? " e" : ""} (${p.fora_pelas_preferencias.toLocaleString("pt-BR")} pelo que escolheram na central de preferências)` : ""}. Vai para {p.enviar.toLocaleString("pt-BR")} {p.enviar === 1 ? "pessoa" : "pessoas"}{p.comparacao > 0 ? `, mais ${p.comparacao.toLocaleString("pt-BR")} do grupo de comparação` : ""}.</p>}
    </div>
  );
}
