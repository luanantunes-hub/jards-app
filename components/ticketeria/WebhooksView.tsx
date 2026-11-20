"use client";

import { useEffect, useId, useState } from "react";
import { Check } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { EVENTOS_DO_WEBHOOK, MAX_WEBHOOKS_POR_LOJA, ROTULO_DO_EVENTO, type EventoDoWebhook } from "@/lib/ticketeria/webhooks-eventos";
import { AVISO_DO_SEGREDO, AVISO_DOS_DADOS_DO_COMPRADOR, enderecoCurto, eventosEmTexto, frasesDoErroDeRota, lerEntregasDaLista, linhaDoAviso, type EntregaDaLista, type WebhookDaLista } from "@/lib/ticketeria/webhooks-tela";

// Os avisos para outros sistemas (webhooks), na página Integrações: a lista de endereços, a folha de novo/editar (com o segredo mostrado uma vez) e a dos últimos avisos.
// Desenhos aprovados pelo dono em 20/11/2026.

const LINK = "rounded-xl text-[0.8125rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const LINK_PEQUENO = "rounded-xl text-[0.75rem] text-black/55 underline-offset-2 transition hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const PERIGO = "rounded-xl text-[0.8125rem] text-[#B23B3B] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const COR_DO_RESULTADO = { verde: "text-[#2E8932]", ambar: "text-[#B07A14]", vermelho: "text-[#B23B3B]", cinza: "text-black/50" } as const;

function Etiqueta({ cor, texto }: { cor: string; texto: string }) {
  return <span className="shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

export function CartaoDosWebhooks({ webhooks, podeEditar = false, aviso = null, onNovo, onTestar, onAvisos, onEditar }: {
  webhooks: WebhookDaLista[]; podeEditar?: boolean; aviso?: string | null; onNovo?: () => void; onTestar?: (id: string) => void; onAvisos?: (id: string) => void; onEditar?: (id: string) => void;
}) {
  return (
    <section aria-label="Avisos para outros sistemas" className="mt-4 rounded-xl border border-black/[.1] bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.9375rem] font-normal text-[#282525]">Avisos para outros sistemas</h2>
          <p className="mt-1 max-w-xl text-[0.8125rem] text-black/60">O Jards avisa o endereço que você cadastrar quando algo acontece na loja: ERP, CRM, e-mail marketing, Zapier ou Make.</p>
        </div>
        {podeEditar && onNovo && webhooks.length < MAX_WEBHOOKS_POR_LOJA && <button type="button" onClick={onNovo} className={`shrink-0 ${LINK}`}>Novo endereço</button>}
      </div>
      {aviso && <p role="status" className="mt-3 rounded-xl border border-black/[.1] bg-white px-3 py-2 text-[0.75rem] text-black/70">{aviso}</p>}
      {webhooks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {webhooks.map(w => (
            <li key={w.id} className="rounded-xl border border-black/[.1] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-all text-[0.8125rem] text-[#282525]" title={w.url}>{enderecoCurto(w.url)}</span>
                {w.ativo ? <Etiqueta cor="#2E8932" texto="LIGADO" /> : <Etiqueta cor="#B07A14" texto="DESLIGADO" />}
              </div>
              <p className="mt-1 text-[0.75rem] text-black/55">{eventosEmTexto(w.eventos)}</p>
              {podeEditar && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button type="button" onClick={() => onTestar?.(w.id)} className={LINK_PEQUENO}>Testar</button>
                  <button type="button" onClick={() => onAvisos?.(w.id)} className={LINK_PEQUENO}>Últimos avisos</button>
                  <button type="button" onClick={() => onEditar?.(w.id)} className={LINK_PEQUENO}>Editar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.6875rem] text-black/40">Até {MAX_WEBHOOKS_POR_LOJA} endereços. Cada aviso vai assinado: a referência técnica explica como conferir.</p>
    </section>
  );
}

/** O segredo, mostrado uma vez, com o botão de copiar. */
function Segredo({ segredo, titulo }: { segredo: string; titulo: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "erro">("parado");
  async function copiar() {
    try { await navigator.clipboard.writeText(segredo); setEstado("copiado"); setTimeout(() => setEstado("parado"), 3000); } catch { setEstado("erro"); }
  }
  return (
    <div className="space-y-2">
      <p className="text-[0.9375rem] text-[#282525]">{titulo}</p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-black/[.1] px-3 py-2">
        <span className="break-all font-mono text-[0.6875rem] text-[#282525]">{segredo}</span>
        <button type="button" onClick={() => void copiar()} className={`inline-flex shrink-0 items-center gap-1.5 ${LINK}`} aria-live="polite">
          {estado === "copiado" && <Check size={12} aria-hidden="true" className="text-[#2E8932]" />}
          {estado === "erro" ? "Não foi possível copiar" : estado === "copiado" ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-[0.75rem] text-black/55">{AVISO_DO_SEGREDO}</p>
    </div>
  );
}

/** A folha de novo endereço e de editar. `webhook` nulo = novo. Depois de criar (ou de gerar outro segredo), mostra o segredo e o botão vira só "Fechar". */
export function WebhookSheet({ lojaId, webhook, onClose, onSaved }: { lojaId: string; webhook: WebhookDaLista | null; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const [url, setUrl] = useState(webhook?.url ?? "https://");
  const [eventos, setEventos] = useState<EventoDoWebhook[]>(webhook?.eventos ?? ["pedido.pago"]);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [segredo, setSegredo] = useState<{ valor: string; titulo: string } | null>(null);
  const [apagando, setApagando] = useState(false);
  const rota = `/api/ticketeria/lojas/${lojaId}/webhooks`;

  async function chamar(caminho: string, metodo: string, corpo?: object): Promise<{ ok: boolean; dados: unknown } | null> {
    setTrabalhando(true);
    setErro(null);
    try {
      const resposta = await fetch(caminho, { method: metodo, headers: { "content-type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
      const dados = await resposta.json().catch(() => ({}));
      setTrabalhando(false);
      if (!resposta.ok) { setErro(frasesDoErroDeRota(resposta.status, dados)); return null; }
      return { ok: true, dados };
    } catch {
      setTrabalhando(false);
      setErro("Sem conexão. Tente de novo.");
      return null;
    }
  }

  async function salvar(fechar: () => void) {
    if (eventos.length === 0) { setErro("Escolha ao menos um dos acontecimentos."); return; }
    if (!webhook) {
      const r = await chamar(rota, "POST", { url, eventos });
      if (!r) return;
      const s = (r.dados as { segredo?: unknown }).segredo;
      onSaved();
      if (typeof s === "string") setSegredo({ valor: s, titulo: "Guarde o segredo" }); else fechar();
      return;
    }
    const r = await chamar(`${rota}/${webhook.id}`, "PATCH", { url, eventos });
    if (!r) return;
    onSaved();
    fechar();
  }

  async function ligarOuDesligar() {
    if (!webhook) return;
    const r = await chamar(`${rota}/${webhook.id}`, "PATCH", { ativo: !webhook.ativo });
    if (!r) return;
    onSaved();
    onClose();
  }

  async function girar() {
    if (!webhook) return;
    const r = await chamar(`${rota}/${webhook.id}/girar`, "POST");
    if (!r) return;
    const s = (r.dados as { segredo?: unknown }).segredo;
    if (typeof s === "string") setSegredo({ valor: s, titulo: "Novo segredo" });
  }

  async function apagar() {
    if (!webhook) return;
    const r = await chamar(`${rota}/${webhook.id}`, "DELETE");
    if (!r) return;
    onSaved();
    onClose();
  }

  const alternar = (e: EventoDoWebhook) => setEventos(atuais => (atuais.includes(e) ? atuais.filter(x => x !== e) : [...atuais, e]));

  return (
    <TopSheet
      titulo={segredo ? segredo.titulo : webhook ? "Editar" : "Novo endereço"}
      onClose={onClose}
      footer={fechar => segredo
        ? <button type="button" onClick={fechar} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/55 transition hover:text-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Fechar</button>
        : <Rodape fechar={fechar} salvando={trabalhando} rotulo="Salvar" onSalvar={() => void salvar(fechar)} />}
    >
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {segredo ? <Segredo segredo={segredo.valor} titulo={segredo.titulo === "Novo segredo" ? "O segredo antigo deixou de valer" : "Ele aparece só desta vez"} /> : (
          <>
            <div><label className={ROTULO} htmlFor={`${id}-url`}>Endereço (https)</label><input id={`${id}-url`} inputMode="url" autoCapitalize="none" spellCheck={false} className={CAMPO} value={url} onChange={e => setUrl(e.target.value)} disabled={trabalhando} /></div>
            <fieldset>
              <legend className={ROTULO}>O que ele recebe</legend>
              <div className="space-y-1.5">
                {EVENTOS_DO_WEBHOOK.map(e => (
                  <label key={e} className="flex items-center gap-2 text-[0.8125rem] text-[#282525]">
                    <input type="checkbox" checked={eventos.includes(e)} onChange={() => alternar(e)} disabled={trabalhando} className="h-3.5 w-3.5 accent-[#1C0E33]" />
                    {ROTULO_DO_EVENTO[e]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[0.75rem] text-black/55">{AVISO_DOS_DADOS_DO_COMPRADOR}</p>
            {webhook && (
              <div className="flex flex-col items-start gap-1.5 border-t border-black/[.08] pt-3">
                <button type="button" disabled={trabalhando} onClick={() => void ligarOuDesligar()} className={LINK}>{webhook.ativo ? "Desligar este endereço" : "Ligar este endereço"}</button>
                <button type="button" disabled={trabalhando} onClick={() => void girar()} className={LINK}>Gerar outro segredo</button>
                {apagando
                  ? <button type="button" disabled={trabalhando} onClick={() => void apagar()} className={PERIGO}>Apagar de vez (não dá para desfazer)</button>
                  : <button type="button" disabled={trabalhando} onClick={() => setApagando(true)} className={PERIGO}>Apagar este endereço</button>}
              </div>
            )}
          </>
        )}
      </div>
    </TopSheet>
  );
}

/** A folha dos últimos avisos de um endereço. */
export function AvisosSheet({ lojaId, webhook, onClose }: { lojaId: string; webhook: WebhookDaLista; onClose: () => void }) {
  const [estado, setEstado] = useState<{ entregas: EntregaDaLista[] } | "erro" | null>(null);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/ticketeria/lojas/${lojaId}/webhooks/${webhook.id}/entregas`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const dados = await r.json();
        if (ativo) setEstado({ entregas: lerEntregasDaLista(dados) });
      } catch {
        if (ativo) setEstado("erro");
      }
    })();
    return () => { ativo = false; };
  }, [lojaId, webhook.id]);
  return (
    <TopSheet titulo="Últimos avisos" onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className="rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/55 transition hover:text-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Fechar</button>}>
      <div className="space-y-3">
        <p className="break-all text-[0.75rem] text-black/55">{webhook.url}</p>
        {estado === null && <p className="text-[0.8125rem] text-black/55">Carregando…</p>}
        {estado === "erro" && <Aviso texto="Não foi possível carregar os avisos. Tente de novo." />}
        {estado && estado !== "erro" && (estado.entregas.length === 0
          ? <p className="text-[0.8125rem] text-black/55">Nenhum aviso ainda. Use Testar para mandar um.</p>
          : (
            <ul className="space-y-1.5">
              {estado.entregas.map(e => {
                const l = linhaDoAviso(e);
                return (
                  <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-black/[.1] px-3 py-2 text-[0.75rem]">
                    <span className="text-[#282525]">{l.titulo}</span>
                    <span className={`text-right ${COR_DO_RESULTADO[l.cor]}`}>{l.resultado}</span>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>
    </TopSheet>
  );
}
