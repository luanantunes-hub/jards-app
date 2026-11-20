"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelaAbrindoPagamento, TelaAviso, TelaDados, TelaEscolherIngressos, TelaPagarPix } from "@/components/ticketeria/CompraView";
import { lerCorpoDaCompra } from "@/lib/ticketeria/pagamento/compra";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "@/lib/ticketeria/termos-de-compra";
import { mascararDocumento } from "@/lib/ticketeria/recebimentos";
import { totalNasFaixas, type VitrineDaSessao } from "@/lib/ticketeria/vitrine";

// A compra de uma sessão, no navegador de quem compra: escolher, dados, Pix. Liga as telas de CompraView às rotas públicas (/api/ticketeria/compra).
// O Pix gerado fica na sessão do navegador (sessionStorage) para a página recarregada não perder a reserva.

/** O pedido em andamento: Pix (o código copia e cola) ou cartão (o endereço da página segura de pagamento). */
type PedidoComPix = { pedido_id: string; codigo: string; total_centavos: number; reservado_ate: string; pix_copia_e_cola?: string; url_de_pagamento?: string };
type Passo = "escolher" | "dados" | "pix" | "cartao" | "expirou";

const chaveDaSessao = (sessao: string) => `ticketeria-compra-${sessao}`;
const guardar = (sessao: string, pedido: PedidoComPix | null) => { try { if (pedido) sessionStorage.setItem(chaveDaSessao(sessao), JSON.stringify(pedido)); else sessionStorage.removeItem(chaveDaSessao(sessao)); } catch { /* sem armazenamento: segue sem */ } };
const lembrado = (sessao: string): PedidoComPix | null => {
  try {
    const bruto = sessionStorage.getItem(chaveDaSessao(sessao));
    const p = bruto ? (JSON.parse(bruto) as PedidoComPix) : null;
    return p && typeof p.pedido_id === "string" && (typeof p.pix_copia_e_cola === "string" || typeof p.url_de_pagamento === "string") && Date.parse(p.reservado_ate) > Date.now() ? p : null;
  } catch { return null; }
};

const horaDe = (iso: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
function faltam(iso: string, agora: number): string {
  const s = Math.max(0, Math.ceil((Date.parse(iso) - agora) / 1000));
  const m = Math.floor(s / 60);
  return m >= 1 ? `${m} ${m === 1 ? "minuto" : "minutos"}` : `${s} segundos`;
}

export function CompraDaSessao({ vitrine }: { vitrine: VitrineDaSessao }) {
  const { sessao_id: sessao, site, evento, ingressos, parcelas_max: parcelasMax } = vitrine;
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>("escolher");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [valores, setValores] = useState({ nome: "", email: "", documento: "" });
  const [aceito, setAceito] = useState(false);
  const [meio, setMeio] = useState<"pix" | "cartao">("pix");
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [pedido, setPedido] = useState<PedidoComPix | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  // Recarregou no meio do Pix: volta a ele (o servidor não sabe do armazenamento do navegador, então só dá para ler depois de montar).
  useEffect(() => {
    queueMicrotask(() => {
      const salvo = lembrado(sessao);
      if (salvo) { setPedido(salvo); setPasso(salvo.url_de_pagamento ? "cartao" : "pix"); }
    });
  }, [sessao]);

  // Em Pix: o relógio e a pergunta "já pagou?" a cada 4 segundos. Pago: a página dos ingressos. Vencido: o aviso.
  useEffect(() => {
    if ((passo !== "pix" && passo !== "cartao") || !pedido) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const pergunta = setInterval(async () => {
      try {
        const r = await fetch(`/api/ticketeria/compra/${pedido.pedido_id}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { situacao?: string };
        if (d.situacao === "pago") { guardar(sessao, null); router.push(`/pedido/${pedido.pedido_id}`); }
        else if (d.situacao === "expirada" || d.situacao === "cancelada") { guardar(sessao, null); setPasso("expirou"); }
      } catch { /* sem rede por um instante: pergunta de novo */ }
    }, 4000);
    return () => { clearInterval(relogio); clearInterval(pergunta); };
  }, [passo, pedido, sessao, router]);

  const linhas = ingressos.flatMap(i => {
    const q = quantidades[i.id] ?? 0;
    return q > 0 ? [{ nome: i.nome, quantidade: q, total_centavos: totalNasFaixas(i.faixas, q) ?? 0 }] : [];
  });
  const total = linhas.reduce((soma, l) => soma + l.total_centavos, 0);

  const gerarPix = useCallback(async () => {
    setErro(null);
    if (!aceito) { setErro("Aceite os Termos de compra para continuar."); return; }
    const leitura = lerCorpoDaCompra({ sessao_id: sessao, itens: Object.entries(quantidades).filter(([, q]) => q > 0).map(([ingresso_id, quantidade]) => ({ ingresso_id, quantidade })), ...valores, termos: VERSAO_DOS_TERMOS_DE_COMPRA, meio, parcelas: meio === "cartao" ? parcelas : 1 });
    if (!leitura.ok) { setErro(`Confira: ${leitura.problemas.join(", ")}.`); return; }
    setTrabalhando(true);
    try {
      const r = await fetch("/api/ticketeria/compra", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(leitura.corpo) });
      const d = (await r.json().catch(() => ({}))) as Partial<PedidoComPix> & { situacao?: string; mensagem?: string; problemas?: string[]; error?: string };
      if (r.status === 201 && d.situacao === "pago" && d.pedido_id) { router.push(`/pedido/${d.pedido_id}`); return; }
      if (r.status === 201 && d.situacao === "aguardando_pagamento" && d.pedido_id && d.reservado_ate && d.codigo && typeof d.total_centavos === "number" && (d.pix_copia_e_cola || d.url_de_pagamento)) {
        const novo: PedidoComPix = { pedido_id: d.pedido_id, codigo: d.codigo, total_centavos: d.total_centavos, reservado_ate: d.reservado_ate, pix_copia_e_cola: d.pix_copia_e_cola, url_de_pagamento: d.url_de_pagamento };
        guardar(sessao, novo); setPedido(novo); setAgora(Date.now());
        if (d.url_de_pagamento && /^https:\/\//.test(d.url_de_pagamento)) {
          // Cartão: a pessoa paga na página segura do provedor. A tela de espera aparece um instante antes de sair, e fica para quando ela voltar.
          setPasso("cartao");
          setTimeout(() => { window.location.assign(d.url_de_pagamento as string); }, 900);
        } else setPasso("pix");
        return;
      }
      setErro(d.error === "dados_invalidos" && d.problemas ? `Confira: ${d.problemas.join(", ")}.` : d.mensagem ?? (r.status === 429 ? "Muitas tentativas. Espere um instante." : "Não foi possível concluir agora. Tente de novo."));
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }, [sessao, quantidades, valores, aceito, meio, parcelas, router]);

  const copiar = useCallback(async () => {
    if (!pedido?.pix_copia_e_cola) return;
    try { await navigator.clipboard.writeText(pedido.pix_copia_e_cola); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { setErro("Não foi possível copiar. Selecione o código e copie."); }
  }, [pedido]);

  if (passo === "expirou") {
    return <TelaAviso site={site} titulo="O tempo para pagar acabou" texto="A reserva dos seus lugares venceu e eles voltaram para a venda. Se você já pagou o Pix, os ingressos chegam por e-mail em instantes. Se não, escolha de novo." acao={{ rotulo: "Escolher os ingressos de novo", onClick: () => { setPedido(null); setPasso("escolher"); } }} />;
  }
  if (passo === "cartao" && pedido?.url_de_pagamento) {
    return <TelaAbrindoPagamento site={site} evento={evento} resumo={{ linhas, total_centavos: pedido.total_centavos }} endereco={pedido.url_de_pagamento} enderecoDoPedido={`/pedido/${pedido.pedido_id}`} />;
  }
  if (passo === "pix" && pedido?.pix_copia_e_cola) {
    return <TelaPagarPix site={site} evento={evento} pedido={{ codigo: pedido.codigo, total_centavos: pedido.total_centavos, pix_copia_e_cola: pedido.pix_copia_e_cola, reservado_ate: horaDe(pedido.reservado_ate), restante: faltam(pedido.reservado_ate, agora) }} onCopiar={() => void copiar()} copiado={copiado} />;
  }
  if (passo === "dados") {
    return <TelaDados site={site} evento={evento} resumo={{ linhas, total_centavos: total }} valores={valores} erro={erro} trabalhando={trabalhando} aceito={aceito} onAceitar={setAceito} meio={meio} onMeio={setMeio} parcelasMax={parcelasMax} parcelas={parcelas} onParcelas={setParcelas}
      onMudar={(campo, valor) => setValores(v => ({ ...v, [campo]: campo === "documento" ? mascararDocumento(valor) : valor }))}
      onVoltar={() => { setErro(null); setPasso("escolher"); }} onGerarPix={() => void gerarPix()} />;
  }
  if (ingressos.length === 0) return <TelaAviso site={site} titulo="Ainda não há ingressos à venda" texto="Volte em breve." />;
  return <TelaEscolherIngressos site={site} evento={evento} ingressos={ingressos} quantidades={quantidades}
    onMudar={(id, novo) => setQuantidades(q => ({ ...q, [id]: Math.max(0, novo) }))} onContinuar={() => { setErro(null); setPasso("dados"); }} />;
}
