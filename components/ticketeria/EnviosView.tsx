"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { MAX_ASSUNTO, MAX_MENSAGEM, acaoDoEnvio, enderecoDeCompraDoEnvio, type Segmento } from "@/lib/ticketeria/envios";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { AREA, Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// Os envios do Público (a tela do produtor): a lista com o resultado em vendas e a folha de um novo envio. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const SECUNDARIO = "rounded-xl border bg-white px-3.5 py-2.5 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const FINAL = "rounded-xl acao-principal px-4 py-2.5 text-[0.75rem] font-normal text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

export type EnvioParaLista = { id: string; assunto: string; canal: string; quando: string; destinatarios: number; enviados: number; falhas: number; situacao: string; ingressos: number; vendido_centavos: number };
export type SessaoParaEscolher = { id: string; evento: string; quando: string };

const dia = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(",", " às"); } catch { return iso; } };

/** Os envios feitos, do mais novo ao mais antigo, com o que cada um vendeu. */
export function EnviosDaLoja({ envios }: { envios: EnvioParaLista[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
      {envios.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <Send size={28} className="mb-3 text-black/15" aria-hidden="true" />
          <p className="text-[0.875rem] font-medium text-black/55">Nenhum envio ainda</p>
        </div>
      ) : (
        <table className="w-full min-w-[46rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Envio</th><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Enviados</th><th className={`${CABECALHO} text-right`}>Ingressos vendidos</th><th className={`${CABECALHO} text-right`}>Vendido</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {envios.map(e => (
              <tr key={e.id}>
                <td className={CELULA}><p>{e.assunto}</p><p className="text-[0.6875rem] text-black/45">{dia(e.quando)}</p></td>
                <td className={CELULA}>E-mail</td>
                <td className={`${CELULA} text-right tabular-nums`}>{e.enviados.toLocaleString("pt-BR")}{e.falhas > 0 && <span className="block text-[0.6875rem] text-[#B23B3B]">{e.falhas.toLocaleString("pt-BR")} não saíram</span>}{e.situacao === "enviando" && <span className="block text-[0.6875rem] text-black/45">enviando…</span>}</td>
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

export type DadosDoNovoEnvio = { assunto: string; mensagem: string; sessao_id: string; segmento: string };

/** A folha de um novo envio: para quem, a sessão, o assunto e a mensagem; o teste para você e o envio, que pede uma confirmação com o número de pessoas. */
export function NovoEnvioSheet({ segmentos, sessoes, ligado, origem, erro, aviso, trabalhando, onTeste, onEnviar, onClose }: {
  segmentos: Segmento[]; sessoes: SessaoParaEscolher[]; ligado: boolean; origem: string; erro?: string | null; aviso?: string | null; trabalhando?: boolean;
  onTeste?: (d: DadosDoNovoEnvio) => void; onEnviar?: (d: DadosDoNovoEnvio) => void; onClose: () => void;
}) {
  const [segmento, setSegmento] = useState(segmentos[0]?.id ?? "");
  const [sessao, setSessao] = useState(sessoes[0]?.id ?? "");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("Oi, {nome}!\n\n");
  const [confirmando, setConfirmando] = useState(false);
  const total = segmentos.find(s => s.id === segmento)?.total ?? 0;
  const dados: DadosDoNovoEnvio = { assunto, mensagem, sessao_id: sessao, segmento };
  const pronto = ligado && total > 0 && sessao !== "" && assunto.trim() !== "" && mensagem.trim() !== "";
  const link = sessao !== "" && assunto.trim() !== "" ? enderecoDeCompraDoEnvio(origem, sessao, acaoDoEnvio(assunto)) : null;
  return (
    <TopSheet titulo="Novo envio" onClose={onClose} largura="40rem" footer={fechar => confirmando ? (
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
        {!ligado && <Aviso texto="O envio de e-mail ainda não está ligado. Fale com o suporte do Jards." />}
        {erro && <Aviso texto={erro} />}
        {aviso && <p role="status" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}
        <div><span className={ROTULO}>Para quem</span>{segmentos.length === 0 ? <p className="text-[0.8125rem] text-black/45">Ninguém aceitou receber novidades ainda.</p> : <Dropdown ariaLabel="Para quem" value={segmento} onChange={setSegmento} options={segmentos.map(s => ({ value: s.id, label: `${s.rotulo} (${s.total.toLocaleString("pt-BR")})` }))} disabled={trabalhando || confirmando} />}</div>
        <div><span className={ROTULO}>Sessão que você quer vender</span>{sessoes.length === 0 ? <p className="text-[0.8125rem] text-black/45">Nenhuma sessão à venda.</p> : <Dropdown ariaLabel="Sessão" value={sessao} onChange={setSessao} options={sessoes.map(s => ({ value: s.id, label: `${s.evento} · ${s.quando}` }))} disabled={trabalhando || confirmando} />}</div>
        <div><label className={ROTULO} htmlFor="envio-assunto">Assunto</label><input id="envio-assunto" className={CAMPO} value={assunto} onChange={e => setAssunto(e.target.value)} maxLength={MAX_ASSUNTO} disabled={trabalhando || confirmando} /></div>
        <div><label className={ROTULO} htmlFor="envio-mensagem">Mensagem</label><textarea id="envio-mensagem" className={`${AREA} min-h-[9rem]`} value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={MAX_MENSAGEM} disabled={trabalhando || confirmando} /><p className="mt-1.5 text-[0.75rem] text-black/45">{"{nome}"} vira o primeiro nome da pessoa.</p></div>
        {link && <p className="break-all rounded-xl bg-[#F6F5F8] px-3.5 py-2.5 text-[0.6875rem] leading-relaxed text-black/55">{link}</p>}
      </div>
    </TopSheet>
  );
}
