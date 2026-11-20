// O Público da loja: as pessoas que compraram ingressos ou entraram na lista de espera, uma linha por e-mail. Só a conta, sem banco e sem imports de servidor: roda nos testes
// (tests/ticketeria-publico.test.ts). Quem lê as linhas é lib/ticketeria/publico-servidor.ts. Um contato "aceitou novidades" quando marcou a caixa em alguma compra paga; quem só
// entrou na lista de espera (ou comprou sem marcar) não recebe divulgação.

export type PedidoParaOPublico = {
  id: string; sessao_id: string; comprador_nome: string; comprador_email: string; comprador_whatsapp: string | null; novidades_aceitas_em: string | null; pago_em: string | null; created_at: string;
};
export type EsperaParaOPublico = { sessao_id: string; nome: string; email: string; created_at: string };

export type EntradaDoPublico = {
  /** Só as compras pagas e não reembolsadas. */
  pedidos: PedidoParaOPublico[];
  /** Quantos ingressos tem cada pedido, pelo id do pedido. */
  quantidadePorPedido: Record<string, number>;
  espera: EsperaParaOPublico[];
  /** O título do evento de cada sessão, pelo id da sessão. */
  eventoDaSessao: Record<string, string>;
  /** Os e-mails (em minúsculas) de quem saiu da lista de novidades da loja. */
  saidas?: string[];
};

export type NovidadesDoContato = "aceitou" | "sem_aceite" | "so_espera" | "saiu";
export type ContatoDoPublico = {
  email: string; nome: string;
  /** Só com o aceite de novidades (o número nem é guardado sem ele). */
  whatsapp: string | null;
  veio_de: "compra" | "espera"; evento: string; ingressos: number;
  /** A data da compra mais recente (ISO), ou null para quem só está na lista de espera. */
  ultima_compra: string | null; atividade_em: string; novidades: NovidadesDoContato;
};
export type ResumoDoPublico = { contatos: number; aceitaram: number; aceitaram_porcento: number; com_whatsapp: number; sairam: number };
export type PublicoDaLoja = { contatos: ContatoDoPublico[]; resumo: ResumoDoPublico };

const quando = (p: PedidoParaOPublico) => p.pago_em ?? p.created_at;

export function montarPublico(e: EntradaDoPublico): PublicoDaLoja {
  const porEmail = new Map<string, ContatoDoPublico & { _whatsappEm: string }>();
  const novo = (p: PedidoParaOPublico) => `${p.comprador_email}`.trim().toLowerCase();
  // Do mais antigo ao mais novo: o dado mais recente vence (nome, evento, número).
  for (const p of [...e.pedidos].sort((a, b) => Date.parse(quando(a)) - Date.parse(quando(b)))) {
    const email = novo(p);
    if (!email) continue;
    const atual = porEmail.get(email);
    const aceitou = p.novidades_aceitas_em !== null;
    const contato = atual ?? { email, nome: p.comprador_nome, whatsapp: null, veio_de: "compra" as const, evento: "", ingressos: 0, ultima_compra: null, atividade_em: quando(p), novidades: "sem_aceite" as NovidadesDoContato, _whatsappEm: "" };
    contato.nome = p.comprador_nome || contato.nome;
    contato.evento = e.eventoDaSessao[p.sessao_id] ?? contato.evento;
    contato.ingressos += e.quantidadePorPedido[p.id] ?? 0;
    contato.ultima_compra = quando(p);
    contato.atividade_em = quando(p);
    if (aceitou) {
      contato.novidades = "aceitou";
      if (p.comprador_whatsapp && quando(p) >= contato._whatsappEm) { contato.whatsapp = p.comprador_whatsapp; contato._whatsappEm = quando(p); }
    }
    porEmail.set(email, contato);
  }
  for (const w of e.espera) {
    const email = w.email.trim().toLowerCase();
    if (!email || porEmail.has(email)) continue;
    porEmail.set(email, { email, nome: w.nome, whatsapp: null, veio_de: "espera", evento: e.eventoDaSessao[w.sessao_id] ?? "", ingressos: 0, ultima_compra: null, atividade_em: w.created_at, novidades: "so_espera", _whatsappEm: "" });
  }
  const saiu = new Set((e.saidas ?? []).map(x => x.trim().toLowerCase()));
  const contatos: ContatoDoPublico[] = [...porEmail.values()].map(c => ({ email: c.email, nome: c.nome, whatsapp: saiu.has(c.email) ? null : c.whatsapp, veio_de: c.veio_de, evento: c.evento, ingressos: c.ingressos, ultima_compra: c.ultima_compra, atividade_em: c.atividade_em, novidades: saiu.has(c.email) ? ("saiu" as NovidadesDoContato) : c.novidades }))
    .sort((a, b) => Date.parse(b.atividade_em) - Date.parse(a.atividade_em) || a.email.localeCompare(b.email));
  const aceitaram = contatos.filter(c => c.novidades === "aceitou").length;
  return {
    contatos,
    resumo: { contatos: contatos.length, aceitaram, aceitaram_porcento: contatos.length === 0 ? 0 : Math.round((aceitaram / contatos.length) * 100), com_whatsapp: contatos.filter(c => c.whatsapp).length, sairam: contatos.filter(c => c.novidades === "saiu").length },
  };
}

export type FiltroDoPublico = "todos" | "aceitaram" | "compraram" | "espera";
export const FILTROS_DO_PUBLICO: [FiltroDoPublico, string][] = [["todos", "Todos"], ["aceitaram", "Aceitaram novidades"], ["compraram", "Compraram"], ["espera", "Lista de espera"]];

const simples = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O filtro da lista e a busca por nome ou e-mail (sem acento nem maiúscula). */
export function filtrarPublico(contatos: ContatoDoPublico[], filtro: FiltroDoPublico, busca: string): ContatoDoPublico[] {
  const termo = simples(busca.trim());
  return contatos.filter(c => {
    if (filtro === "aceitaram" && c.novidades !== "aceitou") return false;
    if (filtro === "compraram" && c.veio_de !== "compra") return false;
    if (filtro === "espera" && c.veio_de !== "espera") return false;
    return termo === "" || simples(c.nome).includes(termo) || c.email.includes(termo);
  });
}

/** "(15) 99712-4410" a partir de 5515997124410. */
export function whatsappEmTexto(numero: string): string {
  const d = numero.startsWith("55") ? numero.slice(2) : numero;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : numero;
}
