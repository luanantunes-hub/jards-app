"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelaAbrindoPagamento, TelaAviso, TelaDados, TelaEscolherIngressos, TelaPagarPix } from "@/components/ticketeria/CompraView";
import { TelaEscolherLugares } from "@/components/ticketeria/AssentosView";
import { TelaListaDeEspera, TelaNaListaDeEspera } from "@/components/ticketeria/ListaDeEsperaView";
import { lerCorpoDaEspera } from "@/lib/ticketeria/espera";
import { lerLayout } from "@/lib/ticketeria/mapa-layout";
import { alternarEscolha, comCorredor, comEscolhidos, lerMapaDaSessao, rotuloDoLugar, type LugarEscolhido, type MapaDaSessao } from "@/lib/ticketeria/mapa";
import { mascararWhatsapp } from "@/lib/ticketeria/novidades";
import { origemDaPagina } from "@/lib/ticketeria/origem";
import { lerCorpoDaCompra } from "@/lib/ticketeria/pagamento/compra";
import { codigoDoCupomValido, descontoEmTexto, descontoNasFaixas, normalizarCodigo, type CupomConferido } from "@/lib/ticketeria/cupom";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "@/lib/ticketeria/termos-de-compra";
import { mascararDocumento } from "@/lib/ticketeria/recebimentos";
import { disponivelNasFaixas, totalNasFaixas, type VitrineDaSessao } from "@/lib/ticketeria/vitrine";

// A compra de uma sessão, no navegador de quem compra: escolher, dados, Pix. Liga as telas de CompraView às rotas públicas (/api/ticketeria/compra).
// O Pix gerado fica na sessão do navegador (sessionStorage) para a página recarregada não perder a reserva.

/** O pedido em andamento: Pix (o código copia e cola) ou cartão (o endereço da página segura de pagamento). */
type PedidoComPix = { pedido_id: string; codigo: string; total_centavos: number; reservado_ate: string; pix_copia_e_cola?: string; url_de_pagamento?: string };
type Passo = "escolher" | "dados" | "pix" | "cartao" | "expirou" | "espera" | "na-lista" | "lugares";

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

/** Confere um código de cupom para a sessão no servidor: o cupom que vale, ou a frase do que deu errado. */
async function conferirCupomNoServidor(sessao: string, codigo: string): Promise<{ cupom: CupomConferido } | { erro: string }> {
  try {
    const r = await fetch("/api/ticketeria/compra/cupom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao_id: sessao, codigo }) });
    const d = (await r.json().catch(() => ({}))) as Partial<CupomConferido> & { mensagem?: string };
    if (r.status === 200 && typeof d.codigo === "string" && (d.tipo === "percentual" || d.tipo === "valor") && typeof d.valor === "number") return { cupom: { codigo: d.codigo, tipo: d.tipo, valor: d.valor, ingresso_id: d.ingresso_id ?? null } };
    return { erro: d.mensagem ?? (r.status === 429 ? "Muitas tentativas. Espere um instante." : "Não foi possível conferir o cupom agora. Tente de novo.") };
  } catch {
    return { erro: "Sem conexão. Tente de novo." };
  }
}

/** `cupomInicial`: o cupom que veio no link (`?cupom=`), já no formato do banco; a compra o confere ao abrir e o aplica sozinha. */
export function CompraDaSessao({ vitrine, cupomInicial = null }: { vitrine: VitrineDaSessao; cupomInicial?: string | null }) {
  const { sessao_id: sessao, site, evento, ingressos, parcelas_max: parcelasMax } = vitrine;
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>("escolher");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [valores, setValores] = useState({ nome: "", email: "", documento: "" });
  const [aceito, setAceito] = useState(false);
  // O aceite de novidades do produtor começa desmarcado; o WhatsApp é opcional e só vale com a caixa marcada.
  const [novidades, setNovidades] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [meio, setMeio] = useState<"pix" | "cartao">("pix");
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [pedido, setPedido] = useState<PedidoComPix | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  // O cupom: o código digitado, o que o servidor conferiu e o aviso quando não vale. O desconto mostrado é só a conta da tela; o valor de verdade o banco calcula ao reservar.
  const [cupom, setCupom] = useState<CupomConferido | null>(null);
  const [cupomAberto, setCupomAberto] = useState(false);
  const [codigoDoCupom, setCodigoDoCupom] = useState("");
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [aplicandoCupom, setAplicandoCupom] = useState(cupomInicial !== null);
  // A lista de espera de um ingresso esgotado: qual ingresso, quem entra, quantos ingressos quer e o erro.
  const [esperaIngresso, setEsperaIngresso] = useState<string | null>(null);
  const [esperaValores, setEsperaValores] = useState({ nome: "", email: "" });
  const [esperaQuantidade, setEsperaQuantidade] = useState(1);
  const [esperaErro, setEsperaErro] = useState<string | null>(null);
  const [entrandoNaEspera, setEntrandoNaEspera] = useState(false);
  // Os lugares escolhidos no mapa, por ingresso de setor numerado; o mapa aberto e a escolha em andamento.
  const [lugares, setLugares] = useState<Record<string, LugarEscolhido[]>>({});
  const [lugaresIngresso, setLugaresIngresso] = useState<string | null>(null);
  const [mapa, setMapa] = useState<MapaDaSessao | null>(null);
  const [mapaErro, setMapaErro] = useState<string | null>(null);
  const [carregandoMapa, setCarregandoMapa] = useState(false);
  const [escolhaAtual, setEscolhaAtual] = useState<LugarEscolhido[]>([]);
  const [mapaAmpliado, setMapaAmpliado] = useState(false);
  // A declaração de quem precisa de lugar de acessibilidade (art. 23-A): libera os lugares reservados do mapa e vai junto no pedido.
  const [acessibilidade, setAcessibilidade] = useState(false);
  const [avisoDaEscolha, setAvisoDaEscolha] = useState<string | null>(null);

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
  const bruto = linhas.reduce((soma, l) => soma + l.total_centavos, 0);
  const desconto = cupom ? Math.min(bruto, ingressos.reduce((soma, i) => soma + descontoNasFaixas(i.faixas, quantidades[i.id] ?? 0, cupom, i.id), 0)) : 0;
  const total = bruto - desconto;

  const gerarPix = useCallback(async () => {
    setErro(null);
    if (!aceito) { setErro("Aceite os Termos de compra para continuar."); return; }
    const leitura = lerCorpoDaCompra({ sessao_id: sessao, itens: Object.entries(quantidades).filter(([, q]) => q > 0).map(([ingresso_id, quantidade]) => ({ ingresso_id, quantidade })), ...valores, termos: VERSAO_DOS_TERMOS_DE_COMPRA, meio, parcelas: meio === "cartao" ? parcelas : 1, cupom: cupom?.codigo ?? null, novidades, whatsapp: novidades ? whatsapp : "",
      lugares: ingressos.filter(i => i.numerado && (quantidades[i.id] ?? 0) > 0).map(i => ({ ingresso_id: i.id, assentos: lugares[i.id] ?? [] })),
      acessibilidade,
      // De qual link de divulgação a pessoa veio (?canal=, ?acao=, utm_* e o site de onde chegou). Só rótulo, lido do endereço no momento da compra; nada fica guardado no navegador.
      origem: origemDaPagina(window.location.search, document.referrer, window.location.hostname) });
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
      if (d.error === "reserva_recusada" && /lugar/i.test(d.mensagem ?? "")) {
        // Alguém levou um dos lugares (ou o mapa mudou): a escolha dos lugares recomeça, o resto do pedido fica.
        setQuantidades(q => { const novo = { ...q }; for (const i of ingressos) if (i.numerado) novo[i.id] = 0; return novo; });
        setLugares({});
        setAvisoDaEscolha(d.mensagem ?? "Escolha os lugares de novo.");
        setPasso("escolher");
        return;
      }
      setErro(d.error === "dados_invalidos" && d.problemas ? `Confira: ${d.problemas.join(", ")}.` : d.mensagem ?? (r.status === 429 ? "Muitas tentativas. Espere um instante." : "Não foi possível concluir agora. Tente de novo."));
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }, [sessao, quantidades, valores, aceito, novidades, whatsapp, meio, parcelas, cupom, lugares, ingressos, acessibilidade, router]);

  const entrarNaEspera = useCallback(async () => {
    setEsperaErro(null);
    const leitura = lerCorpoDaEspera({ sessao_id: sessao, ingresso_id: esperaIngresso, ...esperaValores, quantidade: esperaQuantidade });
    if (!leitura.ok) { setEsperaErro(`Confira: ${leitura.problemas.join(", ")}.`); return; }
    setEntrandoNaEspera(true);
    try {
      const r = await fetch("/api/ticketeria/compra/espera", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(leitura.corpo) });
      const d = (await r.json().catch(() => ({}))) as { situacao?: string; mensagem?: string; problemas?: string[]; error?: string };
      if (r.status === 201) { setPasso("na-lista"); return; }
      setEsperaErro(d.error === "dados_invalidos" && d.problemas ? `Confira: ${d.problemas.join(", ")}.` : d.mensagem ?? (r.status === 429 ? "Muitas tentativas. Espere um instante." : "Não foi possível entrar na lista agora. Tente de novo."));
    } catch {
      setEsperaErro("Sem conexão. Tente de novo.");
    } finally {
      setEntrandoNaEspera(false);
    }
  }, [sessao, esperaIngresso, esperaValores, esperaQuantidade]);

  const carregarMapa = useCallback(async (ingressoId: string, manter: LugarEscolhido[], acessivel: boolean = acessibilidade) => {
    setMapaErro(null);
    setCarregandoMapa(true);
    try {
      const r = await fetch(`/api/ticketeria/compra/mapa?sessao=${encodeURIComponent(sessao)}&ingresso=${encodeURIComponent(ingressoId)}${acessivel ? "&acessivel=1" : ""}`, { cache: "no-store" });
      const lido = r.ok ? lerMapaDaSessao(await r.json().catch(() => null)) : null;
      if (!lido) { setMapaErro(r.status === 404 ? "Este ingresso não tem mapa de lugares agora." : "Não foi possível carregar o mapa. Tente de novo."); return; }
      setMapa(lido);
      // Só ficam escolhidos os lugares que ainda estão livres.
      setEscolhaAtual(manter.filter(l => lido.fileiras.some(f => f.nome === l.fileira && f.assentos.some(a => a.numero === l.numero && a.estado === "livre"))));
    } catch {
      setMapaErro("Sem conexão. Tente de novo.");
    } finally {
      setCarregandoMapa(false);
    }
  }, [sessao, acessibilidade]);

  const abrirMapa = (ingressoId: string) => {
    const antes = lugares[ingressoId] ?? [];
    setAvisoDaEscolha(null);
    setLugaresIngresso(ingressoId);
    setMapa(null);
    setEscolhaAtual(antes);
    setMapaAmpliado(false);
    setPasso("lugares");
    void carregarMapa(ingressoId, antes);
  };

  const aplicarCupom = useCallback(async () => {
    const codigo = normalizarCodigo(codigoDoCupom);
    if (!codigoDoCupomValido(codigo)) { setCupomErro("Esse cupom não existe ou não está mais valendo."); return; }
    setCupomErro(null);
    setAplicandoCupom(true);
    const r = await conferirCupomNoServidor(sessao, codigo);
    if ("cupom" in r) {
      setCupom(r.cupom);
      setCodigoDoCupom("");
      setCupomAberto(false);
    } else setCupomErro(r.erro);
    setAplicandoCupom(false);
  }, [codigoDoCupom, sessao]);

  // O cupom do link: confere ao abrir a página e aplica; se não vale, abre o campo com o código e a frase do motivo.
  useEffect(() => {
    if (!cupomInicial) return;
    let vivo = true;
    void conferirCupomNoServidor(sessao, cupomInicial).then(r => {
      if (!vivo) return;
      if ("cupom" in r) setCupom(r.cupom);
      else { setCodigoDoCupom(cupomInicial); setCupomAberto(true); setCupomErro(r.erro); }
      setAplicandoCupom(false);
    });
    return () => { vivo = false; };
  }, [cupomInicial, sessao]);

  const cupomParaMostrar = cupom ? { codigo: cupom.codigo, descricao: `${descontoEmTexto(cupom.tipo, cupom.valor)}${cupom.ingresso_id ? ` · só em ${ingressos.find(i => i.id === cupom.ingresso_id)?.nome ?? "um ingresso"}` : ""}`, desconto_centavos: desconto } : null;
  const resumoDoDesconto = cupom && desconto > 0 ? { codigo: cupom.codigo, centavos: desconto } : undefined;

  const copiar = useCallback(async () => {
    if (!pedido?.pix_copia_e_cola) return;
    try { await navigator.clipboard.writeText(pedido.pix_copia_e_cola); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { setErro("Não foi possível copiar. Selecione o código e copie."); }
  }, [pedido]);

  const ingressoDosLugares = ingressos.find(i => i.id === lugaresIngresso);
  if (passo === "lugares" && ingressoDosLugares) {
    const max = Math.min(ingressoDosLugares.limite, disponivelNasFaixas(ingressoDosLugares.faixas));
    return <TelaEscolherLugares site={site} evento={evento} ingresso={{ nome: ingressoDosLugares.nome, preco_centavos: ingressoDosLugares.faixas[0]?.preco_centavos ?? 0 }} setor={ingressoDosLugares.numerado?.setor ?? ""}
      fileiras={mapa ? comEscolhidos(comCorredor(mapa.fileiras, mapa.corredor), escolhaAtual) : []} layout={mapa ? lerLayout(mapa.layout) : null} escolhidos={escolhaAtual.map(l => rotuloDoLugar(l.fileira, l.numero))} max={max} totalCentavos={totalNasFaixas(ingressoDosLugares.faixas, escolhaAtual.length) ?? 0}
      ampliado={mapaAmpliado} carregando={carregandoMapa} erroDoMapa={mapaErro} onTentarDeNovo={() => void carregarMapa(ingressoDosLugares.id, escolhaAtual)} declarouAcessibilidade={acessibilidade} onDeclarar={v => { setAcessibilidade(v); void carregarMapa(ingressoDosLugares.id, escolhaAtual, v); }} onAmpliar={() => setMapaAmpliado(v => !v)}
      onAlternar={(fileira, numero) => setEscolhaAtual(atual => alternarEscolha(atual, fileira, numero, max))} onVoltar={() => setPasso("escolher")}
      onConfirmar={() => { setLugares(l => ({ ...l, [ingressoDosLugares.id]: escolhaAtual })); setQuantidades(q => ({ ...q, [ingressoDosLugares.id]: escolhaAtual.length })); setPasso("escolher"); }} />;
  }
  const ingressoDaEspera = ingressos.find(i => i.id === esperaIngresso);
  if (passo === "espera" && ingressoDaEspera) {
    return <TelaListaDeEspera site={site} evento={evento} ingresso={ingressoDaEspera} valores={esperaValores} quantidade={esperaQuantidade} max={ingressoDaEspera.limite} erro={esperaErro} trabalhando={entrandoNaEspera}
      onMudar={(campo, valor) => setEsperaValores(v => ({ ...v, [campo]: valor }))} onQuantidade={setEsperaQuantidade} onVoltar={() => { setEsperaErro(null); setPasso("escolher"); }} onEntrar={() => void entrarNaEspera()} />;
  }
  if (passo === "na-lista" && ingressoDaEspera) {
    return <TelaNaListaDeEspera site={site} evento={evento} ingresso={ingressoDaEspera} email={esperaValores.email.trim().toLowerCase()} quantidade={esperaQuantidade} onVoltar={() => { setEsperaErro(null); setPasso("escolher"); }} />;
  }
  if (passo === "expirou") {
    return <TelaAviso site={site} titulo="O tempo para pagar acabou" texto="A reserva dos seus lugares venceu e eles voltaram para a venda. Se você já pagou o Pix, os ingressos chegam por e-mail em instantes. Se não, escolha de novo." acao={{ rotulo: "Escolher os ingressos de novo", onClick: () => { setPedido(null); setPasso("escolher"); } }} />;
  }
  if (passo === "cartao" && pedido?.url_de_pagamento) {
    return <TelaAbrindoPagamento site={site} evento={evento} resumo={{ linhas, total_centavos: pedido.total_centavos, desconto: resumoDoDesconto }} endereco={pedido.url_de_pagamento} enderecoDoPedido={`/pedido/${pedido.pedido_id}`} />;
  }
  if (passo === "pix" && pedido?.pix_copia_e_cola) {
    return <TelaPagarPix site={site} evento={evento} pedido={{ codigo: pedido.codigo, total_centavos: pedido.total_centavos, pix_copia_e_cola: pedido.pix_copia_e_cola, reservado_ate: horaDe(pedido.reservado_ate), restante: faltam(pedido.reservado_ate, agora) }} onCopiar={() => void copiar()} copiado={copiado} />;
  }
  if (passo === "dados") {
    return <TelaDados site={site} evento={evento} resumo={{ linhas, total_centavos: total, desconto: resumoDoDesconto }} valores={valores} erro={erro} trabalhando={trabalhando} aceito={aceito} onAceitar={setAceito} novidades={novidades} onNovidades={setNovidades} whatsapp={whatsapp} onWhatsapp={v => setWhatsapp(mascararWhatsapp(v))} meio={meio} onMeio={setMeio} parcelasMax={parcelasMax} parcelas={parcelas} onParcelas={setParcelas}
      onMudar={(campo, valor) => setValores(v => ({ ...v, [campo]: campo === "documento" ? mascararDocumento(valor) : valor }))}
      onVoltar={() => { setErro(null); setPasso("escolher"); }} onGerarPix={() => void gerarPix()} />;
  }
  if (ingressos.length === 0) return <TelaAviso site={site} titulo="Ainda não há ingressos à venda" texto="Volte em breve." />;
  return <TelaEscolherIngressos site={site} evento={evento} ingressos={ingressos} quantidades={quantidades}
    onMudar={(id, novo) => setQuantidades(q => ({ ...q, [id]: Math.max(0, novo) }))} onContinuar={() => { setErro(null); setPasso("dados"); }}
    cupom={cupomParaMostrar} cupomErro={cupomErro} codigoDoCupom={codigoDoCupom} cupomAberto={cupomAberto} aplicandoCupom={aplicandoCupom}
    onCodigoDoCupom={codigo => { setCodigoDoCupom(codigo); setCupomErro(null); }} onAbrirCupom={() => setCupomAberto(true)} onAplicarCupom={() => void aplicarCupom()}
    onRemoverCupom={() => { setCupom(null); setCupomErro(null); }}
    aviso={avisoDaEscolha} lugaresEscolhidos={Object.fromEntries(Object.entries(lugares).map(([id, ls]) => [id, ls.map(l => rotuloDoLugar(l.fileira, l.numero))]))} onEscolherLugares={abrirMapa}
    onLimparLugares={id => { setLugares(l => { const novo = { ...l }; delete novo[id]; return novo; }); setQuantidades(q => ({ ...q, [id]: 0 })); }}
    onEntrarNaEspera={id => { setEsperaIngresso(id); setEsperaQuantidade(1); setEsperaErro(null); setPasso("espera"); }} />;
}
