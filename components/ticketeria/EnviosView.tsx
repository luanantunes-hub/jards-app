"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { MAX_ASSUNTO, MAX_MENSAGEM, acaoDoEnvio, enderecoDeCompraDoEnvio, type CanalDoEnvio, type PessoaDoWhatsapp, type Segmento } from "@/lib/ticketeria/envios";
import { porcentagem } from "@/lib/ticketeria/eventos-de-email";
import { whatsappEmTexto } from "@/lib/ticketeria/publico";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { AREA, Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// Os envios do Público (a tela do produtor): a lista com o resultado em vendas e a folha de um novo envio. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const SECUNDARIO = "rounded-xl border bg-white px-3.5 py-2.5 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const FINAL = "rounded-xl acao-principal px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

export type EnvioParaLista = { id: string; assunto: string; canal: string; quando: string; destinatarios: number; enviados: number; falhas: number; abertos?: number; cliques?: number; devolvidos?: number; situacao: string; ingressos: number; vendido_centavos: number };
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
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Envio</th><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Enviados</th><th className={`${CABECALHO} text-right`}>Abriram</th><th className={`${CABECALHO} text-right`}>Clicaram</th><th className={`${CABECALHO} text-right`}>Ingressos vendidos</th><th className={`${CABECALHO} text-right`}>Vendido</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {envios.map(e => (
              <tr key={e.id}>
                <td className={CELULA}><p>{e.assunto}</p><p className="text-[0.6875rem] text-black/45">{dia(e.quando)}</p></td>
                <td className={`${CELULA} whitespace-nowrap`}>{e.canal === "whatsapp" ? "WhatsApp" : "E-mail"}</td>
                <td className={`${CELULA} text-right tabular-nums`}>{e.canal === "whatsapp" ? `${e.enviados.toLocaleString("pt-BR")} de ${e.destinatarios.toLocaleString("pt-BR")}` : e.enviados.toLocaleString("pt-BR")}{e.canal === "whatsapp" && e.enviados < e.destinatarios && <button type="button" onClick={() => onContinuar?.(e.id)} className="mt-0.5 block w-full rounded-xl text-right text-[0.6875rem] text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Continuar</button>}{e.falhas > 0 && <span className="block text-[0.6875rem] text-[#B23B3B]">{e.falhas.toLocaleString("pt-BR")} não saíram</span>}{(e.devolvidos ?? 0) > 0 && <span className="block text-[0.6875rem] text-[#B23B3B]">{(e.devolvidos ?? 0).toLocaleString("pt-BR")} {e.devolvidos === 1 ? "voltou" : "voltaram"}</span>}{e.situacao === "enviando" && e.canal !== "whatsapp" && <span className="block text-[0.6875rem] text-black/45">enviando…</span>}</td>
                <td className={`${CELULA} text-right tabular-nums`}><Taxa canal={e.canal} parte={e.abertos ?? 0} total={e.enviados} /></td>
                <td className={`${CELULA} text-right tabular-nums`}><Taxa canal={e.canal} parte={e.cliques ?? 0} total={e.enviados} /></td>
                <td className={`${CELULA} text-right tabular-nums ${e.ingressos === 0 ? "text-black/30" : ""}`}>{e.ingressos.toLocaleString("pt-BR")}</td>
                <td className={`${CELULA} text-right tabular-nums ${e.vendido_centavos === 0 ? "text-black/30" : ""}`}>{formatarMoeda(e.vendido_centavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export type DadosDoNovoEnvio = { canal: CanalDoEnvio; assunto: string; mensagem: string; sessao_id: string; segmento: string };

/** A folha de um novo envio: para quem, a sessão, o assunto e a mensagem; o teste para você e o envio, que pede uma confirmação com o número de pessoas. */
export function NovoEnvioSheet({ segmentos, segmentosWhatsapp = [], canalInicial = "email", sessoes, ligado, origem, erro, aviso, trabalhando, onTeste, onEnviar, onClose }: {
  segmentos: Segmento[]; segmentosWhatsapp?: Segmento[]; canalInicial?: CanalDoEnvio; sessoes: SessaoParaEscolher[]; ligado: boolean; origem: string; erro?: string | null; aviso?: string | null; trabalhando?: boolean;
  onTeste?: (d: DadosDoNovoEnvio) => void; onEnviar?: (d: DadosDoNovoEnvio) => void; onClose: () => void;
}) {
  const [canal, setCanal] = useState<CanalDoEnvio>(canalInicial);
  const lista = canal === "whatsapp" ? segmentosWhatsapp : segmentos;
  const [segmento, setSegmento] = useState((canalInicial === "whatsapp" ? segmentosWhatsapp : segmentos)[0]?.id ?? "");
  const [sessao, setSessao] = useState(sessoes[0]?.id ?? "");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("Oi, {nome}!\n\n");
  const [confirmando, setConfirmando] = useState(false);
  const total = lista.find(s => s.id === segmento)?.total ?? 0;
  const whatsapp = canal === "whatsapp";
  const dados: DadosDoNovoEnvio = { canal, assunto, mensagem, sessao_id: sessao, segmento };
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
        {!ligado && !whatsapp && <Aviso texto="O envio de e-mail ainda não está ligado. Fale com o suporte do Jards." />}
        {erro && <Aviso texto={erro} />}
        {aviso && <p role="status" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}
        <div><span className={ROTULO}>Para quem</span>{lista.length === 0 ? <p className="text-[0.8125rem] text-black/45">{whatsapp ? "Ninguém aceitou novidades e informou o WhatsApp ainda." : "Ninguém aceitou receber novidades ainda."}</p> : <Dropdown ariaLabel="Para quem" value={segmento} onChange={setSegmento} options={lista.map(s => ({ value: s.id, label: `${s.rotulo} (${s.total.toLocaleString("pt-BR")})` }))} disabled={trabalhando || confirmando} />}</div>
        <div><span className={ROTULO}>Sessão que você quer vender</span>{sessoes.length === 0 ? <p className="text-[0.8125rem] text-black/45">Nenhuma sessão à venda.</p> : <Dropdown ariaLabel="Sessão" value={sessao} onChange={setSessao} options={sessoes.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))} disabled={trabalhando || confirmando} />}</div>
        <div><label className={ROTULO} htmlFor="envio-assunto">{whatsapp ? "Nome do envio" : "Assunto"}</label><input id="envio-assunto" className={CAMPO} value={assunto} onChange={e => setAssunto(e.target.value)} maxLength={MAX_ASSUNTO} disabled={trabalhando || confirmando} /></div>
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
