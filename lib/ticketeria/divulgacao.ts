// O painel "Divulgação": de onde vieram as vendas de cada sessão, e o link que o produtor cola onde for divulgar (o canal vai no endereço, ver lib/ticketeria/origem.ts).
// Só a conta, sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-divulgacao.test.ts). Quem lê as linhas é lib/ticketeria/divulgacao-servidor.ts.
//
// De qual canal é uma venda: o canal do link de divulgação (`?canal=`) vale mais; depois a utm_source, depois o site de onde a pessoa chegou, depois o cupom usado; sem
// nada disso, "sem origem conhecida". Só entram vendas pagas; ingressos e valor são o que o comprador pagou (já com o desconto do cupom).

import { emCentavos, lerValorEmReais } from "@/lib/producao/dinheiro";
import { MAX_ACAO_DA_ORIGEM, MAX_CANAL_DA_ORIGEM, rotuloDeCampanha } from "@/lib/ticketeria/origem";

/** Os canais que o produtor escolhe ao criar um link. */
export const CANAIS_DE_DIVULGACAO = [
  { valor: "instagram", rotulo: "Instagram" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "anuncio-pago", rotulo: "Anúncio pago" },
  { valor: "parceiro", rotulo: "Parceiro ou influenciador" },
  { valor: "outro", rotulo: "Outro" },
] as const;

export const SEM_ORIGEM = "sem-origem";
export const ROTULO_SEM_ORIGEM = "Sem origem conhecida";

const ROTULOS: Record<string, string> = {
  instagram: "Instagram", whatsapp: "WhatsApp", email: "E-mail", "anuncio-pago": "Anúncio pago", parceiro: "Parceiro ou influenciador", outro: "Outro",
  facebook: "Facebook", google: "Google", tiktok: "TikTok", youtube: "YouTube", site: "Site do produtor",
};

/** Reconhece o canal pelo nome que as plataformas usam (utm_source "ig", site "l.instagram.com"…); null se não reconhece. */
export function canalPeloTexto(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  if (t === "") return null;
  if (t === "ig" || t.includes("instagram")) return "instagram";
  if (t === "wa" || t.includes("whatsapp") || t.includes("wa.me")) return "whatsapp";
  if (t === "fb" || t.includes("facebook") || t.startsWith("fb.") || t.includes("fbclid")) return "facebook";
  if (t.includes("tiktok")) return "tiktok";
  if (t.includes("youtube") || t.includes("youtu.be")) return "youtube";
  if (t.includes("google")) return "google";
  if (t === "email" || t === "e-mail" || t.includes("newsletter") || t.includes("mail")) return "email";
  return null;
}

function bonito(slug: string): string {
  const texto = slug.replace(/[-_]+/g, " ").trim();
  return texto === "" ? slug : texto.charAt(0).toUpperCase() + texto.slice(1);
}

export type OrigemDoPedido = {
  origem_canal: string | null; origem_utm: Record<string, unknown> | null; origem_referencia: string | null; cupom_codigo: string | null;
};

/** O canal de uma venda: a chave (para somar) e o nome que a tela mostra. */
export function canalDoPedido(p: OrigemDoPedido): { chave: string; rotulo: string } {
  if (p.origem_canal) {
    const chave = canalPeloTexto(p.origem_canal) ?? p.origem_canal;
    return { chave, rotulo: ROTULOS[chave] ?? bonito(chave) };
  }
  const fonte = typeof p.origem_utm?.utm_source === "string" ? p.origem_utm.utm_source : "";
  if (fonte.trim() !== "") {
    const chave = canalPeloTexto(fonte) ?? rotuloDeCampanha(fonte, MAX_CANAL_DA_ORIGEM);
    if (chave) return { chave, rotulo: ROTULOS[chave] ?? bonito(chave) };
  }
  if (p.origem_referencia) {
    const chave = canalPeloTexto(p.origem_referencia);
    return chave ? { chave, rotulo: ROTULOS[chave] ?? bonito(chave) } : { chave: p.origem_referencia, rotulo: p.origem_referencia };
  }
  if (p.cupom_codigo) return { chave: `cupom:${p.cupom_codigo}`, rotulo: `Cupom ${p.cupom_codigo}` };
  return { chave: SEM_ORIGEM, rotulo: ROTULO_SEM_ORIGEM };
}

export type PedidoPagoParaOrigem = OrigemDoPedido & { id: string; sessao_id: string; total_centavos: number; origem_acao?: string | null; pago_em?: string | null };
/** Vendas somadas por sessão e canal. */
export type LinhaDaDivulgacao = { sessao_id: string; chave: string; rotulo: string; ingressos: number; vendido_centavos: number };

export function agruparDivulgacao(pedidosPagos: PedidoPagoParaOrigem[], quantidadePorPedido: Record<string, number>): LinhaDaDivulgacao[] {
  const mapa = new Map<string, LinhaDaDivulgacao>();
  for (const p of pedidosPagos) {
    const canal = canalDoPedido(p);
    const chave = `${p.sessao_id}|${canal.chave}`;
    const linha = mapa.get(chave) ?? { sessao_id: p.sessao_id, chave: canal.chave, rotulo: canal.rotulo, ingressos: 0, vendido_centavos: 0 };
    linha.ingressos += quantidadePorPedido[p.id] ?? 0;
    linha.vendido_centavos += p.total_centavos;
    mapa.set(chave, linha);
  }
  return [...mapa.values()];
}

export type CanalResumido = { chave: string; rotulo: string; ingressos: number; vendido_centavos: number; porcento: number };
export type ResumoDaDivulgacao = { ingressos: number; vendido_centavos: number; sem_origem_porcento: number; canais: CanalResumido[] };

/** O painel de uma sessão (ou de todas, com `sessaoId` nulo): o total, a parte sem origem e a tabela por canal (a maior primeiro; "sem origem" por último). */
export function resumirDivulgacao(linhas: LinhaDaDivulgacao[], sessaoId: string | null): ResumoDaDivulgacao {
  const porCanal = new Map<string, CanalResumido>();
  for (const l of linhas) {
    if (sessaoId !== null && l.sessao_id !== sessaoId) continue;
    const c = porCanal.get(l.chave) ?? { chave: l.chave, rotulo: l.rotulo, ingressos: 0, vendido_centavos: 0, porcento: 0 };
    c.ingressos += l.ingressos;
    c.vendido_centavos += l.vendido_centavos;
    porCanal.set(l.chave, c);
  }
  const canais = [...porCanal.values()];
  const ingressos = canais.reduce((soma, c) => soma + c.ingressos, 0);
  const vendido = canais.reduce((soma, c) => soma + c.vendido_centavos, 0);
  for (const c of canais) c.porcento = ingressos > 0 ? Math.round((c.ingressos / ingressos) * 100) : 0;
  canais.sort((a, b) => (a.chave === SEM_ORIGEM ? 1 : 0) - (b.chave === SEM_ORIGEM ? 1 : 0) || b.ingressos - a.ingressos || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const sem = canais.find(c => c.chave === SEM_ORIGEM);
  return { ingressos, vendido_centavos: vendido, sem_origem_porcento: sem?.porcento ?? 0, canais };
}

/**
 * O link de divulgação de uma sessão: a página de compra com o canal (e o nome da ação, se houver) no endereço. Com `comUtm`, leva também `utm_source` (o canal), `utm_medium=divulgacao`
 * e `utm_campaign` (a ação): é o que o Google Analytics enxerga (ele não conhece `?canal=`). Sem `comUtm` (o padrão), o endereço é o de antes.
 */
export function enderecoDeDivulgacao(origem: string, sessaoId: string, canal: string, acao: string, comUtm: boolean = false): string {
  const base = `${origem.replace(/\/$/, "")}/comprar/${sessaoId}`;
  const parametros = new URLSearchParams();
  const c = rotuloDeCampanha(canal, MAX_CANAL_DA_ORIGEM);
  const a = rotuloDeCampanha(acao, MAX_ACAO_DA_ORIGEM);
  if (c) parametros.set("canal", c);
  if (a) parametros.set("acao", a);
  if (comUtm && c) {
    parametros.set("utm_source", c);
    parametros.set("utm_medium", "divulgacao");
    if (a) parametros.set("utm_campaign", a);
  }
  const busca = parametros.toString();
  return busca === "" ? base : `${base}?${busca}`;
}

export type SessaoParaDivulgar = { id: string; evento: string; quando: string; a_venda: boolean; /** O dia da sessão (AAAA-MM-DD, no fuso do local). */ dia?: string; /** Os lugares que ainda faltam vender (a lotação da sala menos os ingressos pagos); null se a sala não tem setores. */ lugares_restantes?: number | null };
export type DivulgacaoDaLoja = {
  linhas: LinhaDaDivulgacao[]; sessoes: SessaoParaDivulgar[];
  /** As ações registradas, com o que cada uma vendeu (pelos pedidos cujo link tinha o nome da ação) e o custo por ingresso. */
  acoes: AcaoComResultado[];
  /** Ingressos vendidos por dia (AAAA-MM-DD, no fuso da loja), das vendas pagas. */
  por_dia: Record<string, number>;
  /** O dia de hoje no fuso da loja, AAAA-MM-DD: o fim do gráfico. */
  hoje: string;
};

// ─── Ações de divulgação (passo B) ──────────────────────────────────────────

export type AcaoDaLoja = { id: string; evento_id: string | null; nome: string; canal: string; inicio: string; fim: string; gasto_centavos: number };
export type AcaoComResultado = AcaoDaLoja & { rotulo_do_canal: string; ingressos: number; vendido_centavos: number; custo_por_ingresso_centavos: number | null };

/** O nome da ação como o link de divulgação o leva (`?acao=`): é por ele que a venda acha a ação. */
export const nomeDaAcaoNoLink = (nome: string): string | null => rotuloDeCampanha(nome, MAX_ACAO_DA_ORIGEM);

/** Quanto custou cada ingresso: o gasto dividido pelos ingressos (arredondado ao centavo). Sem gasto ou sem ingresso, não há o que mostrar. */
export function custoPorIngresso(gastoCentavos: number, ingressos: number): number | null {
  return gastoCentavos > 0 && ingressos > 0 ? Math.round(gastoCentavos / ingressos) : null;
}

export function rotuloDoCanal(canal: string): string {
  return ROTULOS[canal] ?? bonito(canal);
}

/** O que cada ação vendeu: os pedidos pagos cujo link de divulgação tinha o mesmo nome de ação. Ações com o mesmo nome no link dividem as mesmas vendas. */
export function resultadoDasAcoes(acoes: AcaoDaLoja[], pedidosPagos: Pick<PedidoPagoParaOrigem, "id" | "total_centavos" | "origem_acao">[], quantidadePorPedido: Record<string, number>): AcaoComResultado[] {
  const porNome = new Map<string, { ingressos: number; vendido: number }>();
  for (const p of pedidosPagos) {
    if (!p.origem_acao) continue;
    const c = porNome.get(p.origem_acao) ?? { ingressos: 0, vendido: 0 };
    c.ingressos += quantidadePorPedido[p.id] ?? 0;
    c.vendido += p.total_centavos;
    porNome.set(p.origem_acao, c);
  }
  return acoes.map(a => {
    const chave = nomeDaAcaoNoLink(a.nome);
    const c = (chave && porNome.get(chave)) || { ingressos: 0, vendido: 0 };
    return { ...a, rotulo_do_canal: rotuloDoCanal(a.canal), ingressos: c.ingressos, vendido_centavos: c.vendido, custo_por_ingresso_centavos: custoPorIngresso(a.gasto_centavos, c.ingressos) };
  });
}

const FUSO_DA_LOJA = "America/Sao_Paulo";
/** O dia (AAAA-MM-DD) de um instante no fuso da loja. */
export function diaNoFuso(instante: string | Date, fuso: string = FUSO_DA_LOJA): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof instante === "string" ? new Date(instante) : instante);
}

export function ingressosPorDia(pedidosPagos: Pick<PedidoPagoParaOrigem, "id" | "pago_em">[], quantidadePorPedido: Record<string, number>, fuso: string = FUSO_DA_LOJA): Record<string, number> {
  const dias: Record<string, number> = {};
  for (const p of pedidosPagos) {
    if (!p.pago_em) continue;
    const dia = diaNoFuso(p.pago_em, fuso);
    dias[dia] = (dias[dia] ?? 0) + (quantidadePorPedido[p.id] ?? 0);
  }
  return dias;
}

const somaDias = (dia: string, n: number): string => { const d = new Date(`${dia}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (de: string, ate: string): number => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
const MAX_DIAS_NO_GRAFICO = 120;

export type FaixaDoGrafico = { id: string; nome: string; de: number; ate: number; linha: number };
export type SerieDoGrafico = { dias: { dia: string; ingressos: number }[]; faixas: FaixaDoGrafico[] };

/** O gráfico: um dia por barra, do primeiro dia com venda ou ação até o último (no máximo os 120 mais recentes), e uma faixa por ação (as que se sobrepõem ficam em linhas diferentes). */
export function serieDoGrafico(porDia: Record<string, number>, acoes: AcaoDaLoja[], hoje: string): SerieDoGrafico {
  const pontas = [...Object.keys(porDia), ...acoes.flatMap(a => [a.inicio, a.fim])].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (pontas.length === 0) return { dias: [], faixas: [] };
  const ultimo = [...pontas, hoje].sort().at(-1) as string;
  let primeiro = pontas.sort()[0];
  if (diasEntre(primeiro, ultimo) + 1 > MAX_DIAS_NO_GRAFICO) primeiro = somaDias(ultimo, -(MAX_DIAS_NO_GRAFICO - 1));
  const total = diasEntre(primeiro, ultimo) + 1;
  const dias = Array.from({ length: total }, (_, i) => { const dia = somaDias(primeiro, i); return { dia, ingressos: porDia[dia] ?? 0 }; });
  const ordenadas = acoes.filter(a => a.fim >= primeiro && a.inicio <= ultimo).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));
  const fimDaLinha: number[] = [];
  const faixas: FaixaDoGrafico[] = ordenadas.map(a => {
    const de = Math.max(0, diasEntre(primeiro, a.inicio));
    const ate = Math.min(total - 1, diasEntre(primeiro, a.fim));
    let linha = fimDaLinha.findIndex(fim => fim < de);
    if (linha === -1) { linha = fimDaLinha.length; fimDaLinha.push(ate); } else fimDaLinha[linha] = ate;
    return { id: a.id, nome: a.nome, de, ate, linha };
  });
  return { dias, faixas };
}

export type CamposDaAcao = { nome: string; canal: string; inicio: string; fim: string; gasto: string };
export type AcaoLida = { nome: string; canal: string; inicio: string; fim: string; gasto_centavos: number };

const DIA_VALIDO = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && diaNoFuso(new Date(`${d}T12:00:00Z`), "UTC") === d;

/** O formulário de registrar ação, conferido: nome de 2 a 80 letras, um canal, o período (o fim não vem antes do início) e o gasto em reais (em branco vale zero). */
export function lerAcao(c: CamposDaAcao): { ok: true; valor: AcaoLida } | { ok: false; erro: string } {
  const nome = c.nome.replace(/\s+/g, " ").trim();
  if (nome.length < 2 || nome.length > 80) return { ok: false, erro: "Dê um nome à ação, de 2 a 80 letras." };
  const canal = rotuloDeCampanha(c.canal, MAX_CANAL_DA_ORIGEM);
  if (!canal) return { ok: false, erro: "Escolha onde você divulgou." };
  if (!DIA_VALIDO(c.inicio) || !DIA_VALIDO(c.fim)) return { ok: false, erro: "Escolha o dia em que começou e o dia em que terminou." };
  if (c.fim < c.inicio) return { ok: false, erro: "A ação não pode terminar antes de começar." };
  let gasto = 0;
  if (c.gasto.trim() !== "") {
    const reais = lerValorEmReais(c.gasto);
    if (reais === null) return { ok: false, erro: "Escreva o gasto em reais, como 150 ou 1.200,50 (ou deixe em branco se não gastou)." };
    if (reais > 10000000) return { ok: false, erro: "O gasto vai até R$ 10.000.000." };
    gasto = emCentavos(reais);
  }
  return { ok: true, valor: { nome, canal, inicio: c.inicio, fim: c.fim, gasto_centavos: gasto } };
}

/** O gasto como o formulário o mostra: "150,00"; zero fica em branco. */
export const gastoParaCampo = (centavos: number): string => (centavos > 0 ? (centavos / 100).toFixed(2).replace(".", ",") : "");
