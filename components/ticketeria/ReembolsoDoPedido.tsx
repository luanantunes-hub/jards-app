"use client";

import { useRef, useState } from "react";
import { BOTAO, BOTAO_SECUNDARIO, Moldura } from "@/components/ticketeria/CompraView";
import { textoDaConfirmacao, type ResultadoDaConfirmacao } from "@/lib/ticketeria/pagamento/reembolso-pagina";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

// O reembolso pedido pela página do pedido: o botão "Pedir reembolso" (que manda o link ao e-mail da compra) e a página de confirmação aberta por esse link. Sem login.

const DIALOGO = "m-auto w-[calc(100%-2rem)] max-w-[28rem] rounded-xl border-0 bg-white p-0 text-[#282525] shadow-xl backdrop:bg-black/40";

/** O botão da página do pedido. Abre uma janela que explica o que acontece, manda o link e confirma o envio. NÃO estorna nada. */
export function PedirReembolso({ pedido, codigo, emailMascarado }: { pedido: string; codigo: string; emailMascarado: string }) {
  const janela = useRef<HTMLDialogElement>(null);
  const [estado, setEstado] = useState<"pergunta" | "enviando" | "enviado">("pergunta");
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState(emailMascarado);
  const [validoAte, setValidoAte] = useState<string | null>(null);

  async function enviar() {
    setEstado("enviando"); setErro(null);
    try {
      const r = await fetch(`/api/ticketeria/pedido/${pedido}/reembolso`, { method: "POST", cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { email?: string; valido_ate?: string; mensagem?: string };
      if (r.ok) { setEnviadoPara(d.email ?? emailMascarado); setValidoAte(d.valido_ate ?? null); setEstado("enviado"); return; }
      setErro(d.mensagem ?? "Não foi possível pedir o reembolso agora. Tente de novo em instantes.");
    } catch { setErro("Sem conexão. Tente de novo."); }
    setEstado("pergunta");
  }
  function abrir() { setEstado("pergunta"); setErro(null); janela.current?.showModal(); }

  return (
    <>
      <button type="button" className={BOTAO_SECUNDARIO} onClick={abrir}>Pedir reembolso</button>
      <dialog ref={janela} className={DIALOGO} aria-labelledby="reembolso-titulo" onClick={e => { if (e.target === janela.current && estado !== "enviando") janela.current?.close(); }}>
        <div className="px-5 py-5">
          {estado !== "enviado" ? (
            <>
              <h2 id="reembolso-titulo" className="text-[1.25rem] font-medium tracking-[-.02em]">Pedir reembolso do pedido {codigo}</h2>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-black/70">Vamos enviar um link de confirmação para <strong className="font-medium text-[#282525]">{emailMascarado}</strong>, o e-mail da compra.</p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/70">O reembolso só sai quando você abrir o link e confirmar. Ao confirmar, devolvemos o valor total pelo mesmo meio com que você pagou e os ingressos deste pedido deixam de valer.</p>
              {erro && <p role="alert" className="mt-3 text-[0.8125rem] text-[#B23B3B]">{erro}</p>}
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" className={BOTAO} onClick={enviar} disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Enviar o link ao meu e-mail"}</button>
                <button type="button" className="min-h-11 rounded-xl text-[0.875rem] text-black/55 hover:text-black/75" onClick={() => janela.current?.close()} disabled={estado === "enviando"}>Voltar</button>
              </div>
            </>
          ) : (
            <>
              <h2 id="reembolso-titulo" className="text-[1.25rem] font-medium tracking-[-.02em]">Enviamos o link</h2>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-black/70">Olhe a caixa de entrada de <strong className="font-medium text-[#282525]">{enviadoPara}</strong> (e a pasta de spam). Abra o link e toque em “Confirmar reembolso”.</p>
              {validoAte && <p className="mt-2 text-[0.8125rem] text-black/55">O link vale até {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(validoAte)).replace(", ", " às ")} e só pode ser usado uma vez. Até você confirmar, nada acontece com o pedido.</p>}
              <div className="mt-5"><button type="button" className={BOTAO} onClick={() => janela.current?.close()}>Fechar</button></div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

/** A página aberta pelo link do e-mail: mostra o pedido e o valor e só estorna quando a pessoa toca em "Confirmar reembolso". */
export function ConfirmarReembolso({ site, pedido, codigoDoLink, codigo, totalCentavos, valeAte }: { site: { titulo: string; cor?: string }; pedido: string; codigoDoLink: string; codigo: string; totalCentavos: number; valeAte: string }) {
  const [estado, setEstado] = useState<"pergunta" | "enviando" | "feito">("pergunta");
  const [resultado, setResultado] = useState<ResultadoDaConfirmacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setEstado("enviando"); setErro(null);
    try {
      const r = await fetch(`/api/ticketeria/pedido/${pedido}/reembolso/confirmar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo: codigoDoLink }), cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { resultado?: ResultadoDaConfirmacao; mensagem?: string };
      if (d.resultado) { setResultado(d.resultado); setEstado("feito"); return; }
      setErro(d.mensagem ?? "Não foi possível confirmar agora. Tente de novo em instantes.");
    } catch { setErro("Sem conexão. Tente de novo."); }
    setEstado("pergunta");
  }

  if (estado === "feito" && resultado) {
    const t = textoDaConfirmacao(resultado);
    return (
      <Moldura titulo={site.titulo} cor={site.cor}>
        <span className="inline-flex rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal uppercase tracking-[.08em]" style={{ borderColor: t.ok ? "#2E893247" : "#B07A1447", color: t.ok ? "#2E8932" : "#B07A14" }}>{t.ok ? "Concluído" : "Atenção"}</span>
        <h1 className="mt-2 text-[1.5rem] font-medium tracking-[-.025em]">{t.titulo}</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">{t.texto}</p>
        <p className="mt-4 text-[0.75rem] text-black/50">Pedido {codigo}.</p>
      </Moldura>
    );
  }
  return (
    <Moldura titulo={site.titulo} cor={site.cor}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Confirmar o reembolso</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">Você pediu o reembolso do pedido {codigo}. Ao confirmar, devolvemos o valor pelo mesmo meio com que você pagou e os ingressos deste pedido deixam de valer.</p>
      <p className="mt-5 text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/50">Valor a devolver</p>
      <p className="text-[2rem] font-medium tabular-nums tracking-[-.03em]">{formatarMoeda(totalCentavos)}</p>
      {erro && <p role="alert" className="mt-3 text-[0.8125rem] text-[#B23B3B]">{erro}</p>}
      <button type="button" className={`${BOTAO} mt-5`} onClick={confirmar} disabled={estado === "enviando"}>{estado === "enviando" ? "Confirmando…" : "Confirmar reembolso"}</button>
      <a href={`/pedido/${pedido}`} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-[0.875rem] text-black/55 hover:text-black/75">Não quero, voltar ao pedido</a>
      <p className="mt-4 text-[0.75rem] leading-relaxed text-black/50">Este link vale até {valeAte} e só pode ser usado uma vez. Não é possível desfazer depois de confirmar.</p>
    </Moldura>
  );
}
