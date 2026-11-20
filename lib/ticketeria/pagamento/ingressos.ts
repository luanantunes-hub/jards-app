// Os ingressos de um pedido pago e o e-mail que os entrega (passo C2 da T5). O banco emite os ingressos sozinho quando o pedido vira pago (gatilho em
// supabase/migrations/20261119290000_ticketeria_ingressos_emitidos.sql); aqui se lê o que foi emitido e se manda o e-mail, UMA vez só: quem pega a
// vaga do envio manda, e se o envio falha a vaga volta e a próxima tentativa (o reenvio do aviso do provedor, por exemplo) manda. As portas são
// injetadas: testa-se sem rede e sem banco (tests/ticketeria-ingressos.test.ts).

/** `assento`: "Plateia · Fileira C · lugar 7" quando o ingresso é de um setor numerado. */
export type IngressoDoPedido = { codigo: string; nome: string; assento?: string | null; preco_centavos: number; usado: boolean; cancelado: boolean };

export type IngressosDoPedido = {
  pedido_id: string; codigo: string; comprador_nome: string; evento: string; inicio: string; fuso: string; local: string;
  cidade: string | null; uf: string | null; sessao_cancelada: boolean; ingressos: IngressoDoPedido[];
};

export type PortasDoEnvio = {
  /** fn_ticketeria_reivindicar_envio: true só para o primeiro. */
  reivindicar(pedido: string): Promise<boolean>;
  /** fn_ticketeria_liberar_envio. */
  liberar(pedido: string): Promise<void>;
  /** fn_ticketeria_ingressos_do_pedido. Nulo se o pedido não existe ou não está pago. */
  ler(pedido: string): Promise<IngressosDoPedido | null>;
  /** O e-mail do comprador (não vem com os ingressos: a página pública nunca o mostra). */
  destinatario(pedido: string): Promise<string | null>;
  /** O e-mail transacional. false se não saiu. */
  enviarEmail(para: string, mensagem: { assunto: string; texto: string; html: string }): Promise<boolean>;
  /** O endereço da página do pedido, aberta por quem tem o link. */
  enderecoDaPagina(pedido: string): string;
};

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "sábado, 21/11/2026 às 20:00", no fuso do local (o horário que o comprador vê é o do teatro, não o do servidor). */
export function diaEHoraDoEvento(inicio: string, fuso: string): string {
  const quando = new Date(inicio);
  try {
    const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(quando);
    const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(quando);
    return `${dia} às ${hora}`;
  } catch {
    return quando.toISOString();
  }
}

export function emailDosIngressos(dados: IngressosDoPedido, endereco: string): { assunto: string; texto: string; html: string } {
  const quando = diaEHoraDoEvento(dados.inicio, dados.fuso);
  const onde = [dados.local, [dados.cidade, dados.uf].filter(Boolean).join("/")].filter(Boolean).join(", ");
  const validos = dados.ingressos.filter(i => !i.cancelado);
  const linhas = validos.map(i => `${i.nome}${i.assento ? ` (${i.assento})` : ""}: ${i.codigo}`);
  const texto = [
    `Olá, ${dados.comprador_nome}! Seu pagamento foi confirmado.`,
    `${dados.evento}\n${quando}\n${onde}`,
    `Seus ingressos (mostre o código ou o QR Code na entrada):\n${linhas.join("\n")}`,
    `Para ver os ingressos com o QR Code: ${endereco}`,
    `Pedido ${dados.codigo}. Para pedir reembolso em até 7 dias da compra, use o botão “Pedir reembolso” na página dos ingressos (o link acima) ou escreva, do mesmo e-mail da compra, com o assunto "reembolso - código do ingresso".`,
  ].join("\n\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#282525">`
    + `<p style="margin:0 0 14px">Olá, ${escapar(dados.comprador_nome)}! Seu pagamento foi confirmado.</p>`
    + `<p style="margin:0 0 14px"><strong>${escapar(dados.evento)}</strong><br>${escapar(quando)}<br>${escapar(onde)}</p>`
    + `<p style="margin:0 0 6px">Seus ingressos (mostre o código ou o QR Code na entrada):</p>`
    + `<ul style="margin:0 0 14px;padding-left:18px">${validos.map(i => `<li>${escapar(i.nome)}${i.assento ? ` (${escapar(i.assento)})` : ""}: <strong style="letter-spacing:2px">${escapar(i.codigo)}</strong></li>`).join("")}</ul>`
    + `<p style="margin:0 0 14px"><a href="${escapar(endereco)}">Ver os ingressos com o QR Code</a></p>`
    + `<p style="margin:0;color:#6b6767;font-size:13px">Pedido ${escapar(dados.codigo)}. Para pedir reembolso em até 7 dias da compra, use o botão “Pedir reembolso” na página dos ingressos (o link acima) ou escreva, do mesmo e-mail da compra, com o assunto "reembolso - código do ingresso".</p>`
    + `</div>`;
  return { assunto: `Seus ingressos: ${dados.evento}`, texto, html };
}

export type ResultadoDoEnvio = "enviado" | "ja_enviado" | "sem_ingressos" | "falhou";

/** Manda o e-mail dos ingressos do pedido, uma vez só. Nunca lança: o pagamento já foi confirmado e o envio é uma segunda etapa. */
export async function enviarIngressosDoPedido(pedido: string, portas: PortasDoEnvio, registrarErro?: (erro: unknown) => void): Promise<ResultadoDoEnvio> {
  let reivindicou = false;
  try {
    if (!(await portas.reivindicar(pedido))) return "ja_enviado";
    reivindicou = true;
    const [dados, para] = await Promise.all([portas.ler(pedido), portas.destinatario(pedido)]);
    if (!dados || dados.ingressos.filter(i => !i.cancelado).length === 0 || !para) {
      await portas.liberar(pedido);
      return "sem_ingressos";
    }
    const enviado = await portas.enviarEmail(para, emailDosIngressos(dados, portas.enderecoDaPagina(pedido)));
    if (!enviado) {
      await portas.liberar(pedido);
      return "falhou";
    }
    return "enviado";
  } catch (erro) {
    registrarErro?.(erro);
    if (reivindicou) await portas.liberar(pedido).catch(() => undefined);
    return "falhou";
  }
}
