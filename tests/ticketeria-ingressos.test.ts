import assert from "node:assert/strict";
import test from "node:test";
import { diaEHoraDoEvento, emailDosIngressos, enviarIngressosDoPedido, type IngressosDoPedido, type PortasDoEnvio } from "../lib/ticketeria/pagamento/ingressos";
import { processarAviso, type PortasDosAvisos } from "../lib/ticketeria/pagamento/avisos";
import { ProvedorDeMentira } from "../lib/ticketeria/pagamento/provedor-de-mentira";
import { ErroDaCompra, iniciarCompra, lerCorpoDaCompra, type PortasDaCompra } from "../lib/ticketeria/pagamento/compra";

const PEDIDO = "0d760000-0000-4000-8000-0000000000e1";
const dados: IngressosDoPedido = {
  pedido_id: PEDIDO, codigo: "ABCD2345", comprador_nome: "Rita <b>Teste</b>", evento: "Hamlet & Cia", inicio: "2026-11-21T23:00:00.000Z", fuso: "America/Sao_Paulo", local: "Teatro A",
  cidade: "Sorocaba", uf: "SP", sessao_cancelada: false,
  ingressos: [{ codigo: "AAAAAAAAA2", nome: "Inteira", preco_centavos: 6000, usado: false, cancelado: false }, { codigo: "BBBBBBBBB3", nome: "Meia", preco_centavos: 3000, usado: false, cancelado: false }, { codigo: "CCCCCCCCC4", nome: "Inteira", preco_centavos: 6000, usado: false, cancelado: true }],
};

function portas(sobre: Partial<PortasDoEnvio> = {}) {
  const c = { reivindicar: 0, liberar: 0, emails: [] as { para: string; assunto: string; texto: string; html: string }[] };
  let vaga = true;
  const p: PortasDoEnvio = {
    async reivindicar() { c.reivindicar++; const v = vaga; vaga = false; return v; },
    async liberar() { c.liberar++; vaga = true; },
    async ler() { return dados; },
    async destinatario() { return "rita@teste.com"; },
    async enviarEmail(para, m) { c.emails.push({ para, ...m }); return true; },
    enderecoDaPagina: id => `https://jards.com.br/pedido/${id}`,
    ...sobre,
  };
  return { p, c };
}

test("o horário do evento é o do fuso do local, não o do servidor", () => {
  assert.match(diaEHoraDoEvento("2026-11-21T23:00:00.000Z", "America/Sao_Paulo"), /sábado, 21\/11\/2026 às 20:00/);
  assert.match(diaEHoraDoEvento("2026-11-21T23:00:00.000Z", "America/Manaus"), /19:00/);
  assert.match(diaEHoraDoEvento("2026-11-21T23:00:00.000Z", "fuso/que-nao-existe"), /2026-11-21T23:00:00/, "fuso inválido não derruba o e-mail");
});

test("o e-mail traz o evento, o dia, o local, os códigos dos ingressos válidos, o link e o aviso de reembolso", () => {
  const m = emailDosIngressos(dados, "https://jards.com.br/pedido/x");
  assert.equal(m.assunto, "Seus ingressos: Hamlet & Cia");
  for (const trecho of ["Hamlet & Cia", "20:00", "Teatro A, Sorocaba/SP", "Inteira: AAAAAAAAA2", "Meia: BBBBBBBBB3", "https://jards.com.br/pedido/x", "reembolso - código do ingresso", "ABCD2345"]) assert.ok(m.texto.includes(trecho), `texto sem: ${trecho}`);
  assert.doesNotMatch(m.texto, /CCCCCCCCC4/, "o ingresso cancelado não vai no e-mail");
  assert.doesNotMatch(m.html, /<b>Teste/, "o nome do comprador não vira HTML");
  assert.match(m.html, /Rita &lt;b&gt;Teste&lt;\/b&gt;/);
  assert.match(m.html, /Hamlet &amp; Cia/);
});

test("o e-mail dos ingressos sai uma vez só", async () => {
  const { p, c } = portas();
  assert.equal(await enviarIngressosDoPedido(PEDIDO, p), "enviado");
  assert.equal(await enviarIngressosDoPedido(PEDIDO, p), "ja_enviado");
  assert.equal(c.emails.length, 1);
  assert.equal(c.emails[0].para, "rita@teste.com");
  assert.equal(c.liberar, 0);
});

test("se o e-mail não sai, a vaga volta e a próxima tentativa manda", async () => {
  let falhar = true;
  const { p, c } = portas({ async enviarEmail(para, m) { if (falhar) return false; c.emails.push({ para, ...m }); return true; } });
  assert.equal(await enviarIngressosDoPedido(PEDIDO, p), "falhou");
  assert.equal(c.liberar, 1);
  falhar = false;
  assert.equal(await enviarIngressosDoPedido(PEDIDO, p), "enviado");
  assert.equal(c.emails.length, 1);
});

test("erro do banco ou da rede nunca sobe, devolve a vaga e vai ao registro", async () => {
  const erros: unknown[] = [];
  const { p, c } = portas({ async ler() { throw new Error("banco fora do ar"); } });
  assert.equal(await enviarIngressosDoPedido(PEDIDO, p, e => erros.push(e)), "falhou");
  assert.equal(c.liberar, 1);
  assert.equal(erros.length, 1);
  const { p: p2 } = portas({ async reivindicar() { throw new Error("banco fora do ar"); } });
  assert.equal(await enviarIngressosDoPedido(PEDIDO, p2, e => erros.push(e)), "falhou");
});

test("sem ingresso emitido, sem destinatário ou só com ingresso cancelado: não manda e devolve a vaga", async () => {
  for (const sobre of [
    { async ler() { return null; } }, { async destinatario() { return null; } },
    { async ler() { return { ...dados, ingressos: dados.ingressos.map(i => ({ ...i, cancelado: true })) }; } },
  ] as Partial<PortasDoEnvio>[]) {
    const { p, c } = portas(sobre);
    assert.equal(await enviarIngressosDoPedido(PEDIDO, p), "sem_ingressos");
    assert.equal(c.emails.length, 0);
    assert.equal(c.liberar, 1);
  }
});

function avisos(sobre: Partial<PortasDosAvisos> = {}) {
  const chamadas: string[] = [];
  const p: PortasDosAvisos = {
    async registrar() { return "novo"; },
    async confirmar() { return "pago"; },
    async concluir() {},
    async aposPagamento(pedido) { chamadas.push(pedido); },
    ...sobre,
  };
  return { p, chamadas };
}

test("o aviso de pagamento manda os ingressos depois de confirmar; falha no envio não reprova o aviso", async () => {
  const provedor = new ProvedorDeMentira("segredo-de-teste-com-mais-de-16-letras");
  const aviso = provedor.simularAviso({ id_externo: "ev-1", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: "ref-1", valor_centavos: 6000 });
  const { p, chamadas } = avisos();
  const r = await processarAviso(provedor, p, aviso.corpo, aviso.assinatura);
  assert.equal(r.status, 200);
  assert.deepEqual(chamadas, [PEDIDO]);
  const { p: quebrado } = avisos({ async aposPagamento() { throw new Error("e-mail fora do ar"); } });
  const aviso2 = provedor.simularAviso({ id_externo: "ev-2", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: "ref-1", valor_centavos: 6000 });
  assert.equal((await processarAviso(provedor, quebrado, aviso2.corpo, aviso2.assinatura)).status, 200);
});

test("o ingresso gratuito manda os ingressos na hora da compra, e falha no envio não derruba a compra", async () => {
  const chamadas: string[] = [];
  const erros: unknown[] = [];
  const base: PortasDaCompra = {
    async contaDaSessao() { return { chave: "chave-da-subconta-0123456789", aprovada: true }; },
    async reservar() { return { pedido_id: PEDIDO, codigo: "ABCD2345", situacao: "pago", reservado_ate: "2026-11-19T12:15:00.000Z", total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 }; },
    async definirMeioPix() { throw new Error("não deveria"); },
    provedor() { throw new Error("não deveria"); },
    carteiraDoJards: "carteira",
    registrarErro: e => erros.push(e),
    async aposPagamento(pedido) { chamadas.push(pedido); },
  };
  const l = lerCorpoDaCompra({ sessao_id: "0d760000-0000-4000-8000-000000000081", itens: [{ ingresso_id: "0d760000-0000-4000-8000-000000000033", quantidade: 1 }], nome: "Rita Teste", email: "rita@teste.com", documento: "52998224725" });
  if (!l.ok) throw new Error("corpo");
  assert.equal((await iniciarCompra(l.corpo, base)).situacao, "pago");
  assert.deepEqual(chamadas, [PEDIDO]);
  const r = await iniciarCompra(l.corpo, { ...base, async aposPagamento() { throw new Error("e-mail fora do ar"); } });
  assert.equal(r.situacao, "pago");
  assert.equal(erros.length, 1);
  assert.ok(!(r instanceof ErroDaCompra));
});
