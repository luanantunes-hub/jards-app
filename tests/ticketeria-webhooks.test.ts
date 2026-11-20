import assert from "node:assert/strict";
import test from "node:test";
import { MAX_WEBHOOKS_POR_LOJA, assinaturaConfere, assinaturaDoAviso, cabecalhosDoAviso, corpoDoAviso, enderecoPrivado, lerCorpoDoWebhook, lerEnderecoDoWebhook, lerEntregas, mensagemDoErroDoWebhook, resolverSemRedeInterna, type EntregaParaEnviar } from "../lib/ticketeria/webhooks";
import { enviarDevidas, enviarEntrega, entregue, motivoDaFalha, type PortasDoEnvio, type Transporte } from "../lib/ticketeria/webhooks-envio";

// Os webhooks de saída (I0, parte 3): assinatura, endereço seguro, leitura do cadastro e o fluxo de envio com portas e transporte falsos.

const SEGREDO = "whsec_" + "ab".repeat(24);
const entrega = (extra: Partial<EntregaParaEnviar> = {}): EntregaParaEnviar => ({ entrega: "0d760000-0000-4000-8000-0000000000e1", webhook: "0d760000-0000-4000-8000-0000000000e2", url: "https://exemplo.com.br/hooks/jards", segredo: SEGREDO, tipo: "pedido.pago", dados: { pedido: { codigo: "ABCD2345" } }, tentativa: 1, criado_em: "2026-11-20T12:00:00Z", ...extra });

test("a assinatura: HMAC-SHA256 de 't.corpo' com o segredo, e quem recebe a confere com tolerância de relógio", () => {
  const corpo = corpoDoAviso(entrega());
  const cab = assinaturaDoAviso(SEGREDO, corpo, 1_800_000_000);
  assert.match(cab, /^t=1800000000,v1=[a-f0-9]{64}$/);
  assert.equal(assinaturaConfere(SEGREDO, corpo, cab, 1_800_000_100), true);
  assert.equal(assinaturaConfere(SEGREDO, corpo + " ", cab, 1_800_000_100), false, "corpo mudado");
  assert.equal(assinaturaConfere("whsec_" + "cd".repeat(24), corpo, cab, 1_800_000_100), false, "outro segredo");
  assert.equal(assinaturaConfere(SEGREDO, corpo, cab, 1_800_000_000 + 301), false, "aviso velho demais (repetição de um aviso capturado)");
  for (const ruim of ["", "t=1,v1=abc", "v1=" + "a".repeat(64), cab.toUpperCase()]) assert.equal(assinaturaConfere(SEGREDO, corpo, ruim, 1_800_000_000), false, ruim);
});

test("o aviso: o corpo tem o id da entrega (o mesmo em toda tentativa), e os cabeçalhos dizem o que é", () => {
  const e = entrega({ tentativa: 3 });
  const corpo = JSON.parse(corpoDoAviso(e));
  assert.deepEqual(Object.keys(corpo).sort(), ["criado_em", "dados", "id", "tentativa", "tipo", "versao"]);
  assert.equal(corpo.id, e.entrega);
  assert.equal(JSON.parse(corpoDoAviso({ ...e, tentativa: 4 })).id, e.entrega, "o id não muda entre tentativas");
  const cab = cabecalhosDoAviso(e, corpoDoAviso(e), 1_800_000_000);
  assert.equal(cab["x-jards-evento"], "pedido.pago");
  assert.equal(cab["x-jards-entrega"], e.entrega);
  assert.equal(assinaturaConfere(SEGREDO, corpoDoAviso(e), cab["x-jards-assinatura"], 1_800_000_000), true);
  assert.equal(JSON.stringify(cab).includes(SEGREDO), false, "o segredo nunca vai nos cabeçalhos");
  assert.equal(corpoDoAviso(e).includes(SEGREDO), false, "nem no corpo");
});

test("as entregas reivindicadas: só as bem formadas", () => {
  const boa = { entrega: "e", webhook: "w", url: "https://a.com/x", segredo: SEGREDO, tipo: "teste", dados: { a: 1 }, tentativa: 2, criado_em: "2026-11-20T12:00:00Z" };
  assert.equal(lerEntregas([boa, { ...boa, url: 1 }, null, "x", { ...boa, tentativa: "1" }, { ...boa, dados: undefined }]).length, 2);
  assert.deepEqual(lerEntregas(null), []);
  assert.deepEqual(lerEntregas({}), []);
});

test("rede interna: IPv4, IPv6 e os disfarces (IPv4 dentro de IPv6) são recusados; endereços públicos passam", () => {
  for (const interno of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "ff02::1", "[::1]"]) assert.equal(enderecoPrivado(interno), true, interno);
  for (const publico of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "191.252.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) assert.equal(enderecoPrivado(publico), false, publico);
});

test("o endereço do produtor: https, sem usuário e senha, nome de site, porta 443 ou 8443", () => {
  assert.deepEqual(lerEnderecoDoWebhook("  https://exemplo.com.br/hooks/jards  "), { ok: true, url: "https://exemplo.com.br/hooks/jards" });
  assert.deepEqual(lerEnderecoDoWebhook("https://exemplo.com:8443/a?x=1#frag"), { ok: true, url: "https://exemplo.com:8443/a?x=1" });
  for (const ruim of ["", "   ", "http://exemplo.com/x", "ftp://exemplo.com", "javascript:alert(1)", "https://u:s@exemplo.com/x", "https://exemplo.com:22/x", "https://exemplo.com:8080/x", "https://localhost/x", "https://127.0.0.1/x", "https://[::1]/x", "https://10.0.0.1/x", "https://intranet/x", "https://meu.servidor.local/x", "https://x.internal/x", "https://" + "a".repeat(600) + ".com", null, 5, {}]) {
    const r = lerEnderecoDoWebhook(ruim);
    assert.equal(r.ok, false, String(ruim));
  }
});

test("o corpo do cadastro: completo na criação, parcial na mudança", () => {
  const ok = lerCorpoDoWebhook({ url: "https://exemplo.com/h", eventos: ["pedido.pago", "pedido.pago", "ingresso.lido"] }, true);
  assert.deepEqual(ok, { ok: true, corpo: { url: "https://exemplo.com/h", eventos: ["pedido.pago", "ingresso.lido"] } });
  for (const ruim of [{}, { url: "https://exemplo.com/h" }, { eventos: ["pedido.pago"] }, { url: "https://exemplo.com/h", eventos: [] }, { url: "https://exemplo.com/h", eventos: ["teste"] }, { url: "https://exemplo.com/h", eventos: "pedido.pago" }, { url: "http://x.com/h", eventos: ["pedido.pago"] }, null, []]) assert.equal(lerCorpoDoWebhook(ruim, true).ok, false, JSON.stringify(ruim));
  assert.deepEqual(lerCorpoDoWebhook({ ativo: false }, false), { ok: true, corpo: { ativo: false } });
  assert.deepEqual(lerCorpoDoWebhook({ eventos: ["sessao.cancelada"] }, false), { ok: true, corpo: { eventos: ["sessao.cancelada"] } });
  for (const ruim of [{}, { ativo: "sim" }, { url: "http://x.com" }, { eventos: [] }]) assert.equal(lerCorpoDoWebhook(ruim, false).ok, false, JSON.stringify(ruim));
  assert.match(mensagemDoErroDoWebhook({ message: "limite_de_webhooks" }), new RegExp(`até ${MAX_WEBHOOKS_POR_LOJA} endereços`));
  assert.match(mensagemDoErroDoWebhook({ message: "url_invalida" }), /não é válido/);
  assert.match(mensagemDoErroDoWebhook({ message: "coisa estranha" }), /Tente de novo/);
});

function portas(devidas: unknown) {
  const registros: { entrega: string; ok: boolean; status: number | null; erro: string | null }[] = [];
  const p: PortasDoEnvio & { falharAoRegistrar?: boolean } = {
    async reivindicar() { return devidas; },
    async registrar(entrega, ok, status, erro) { if (p.falharAoRegistrar) throw new Error("banco fora"); registros.push({ entrega, ok, status, erro }); },
  };
  return { p, registros };
}

test("o envio: 2xx entrega; outro status, redirecionamento e erro de rede são falha com o motivo registrado", async () => {
  assert.equal([200, 201, 204, 299].every(entregue), true);
  assert.equal([199, 300, 301, 404, 410, 500].some(entregue), false);
  const casos: [Transporte, boolean, number | null, string | null][] = [
    [async () => ({ status: 200 }), true, 200, null],
    [async () => ({ status: 500 }), false, 500, "http_500"],
    [async () => ({ status: 404 }), false, 404, "http_404"],
    [async () => ({ status: 302 }), false, 302, "redirecionamento_302"],
    [async () => { throw new Error("tempo_esgotado"); }, false, null, "tempo_esgotado"],
    [async () => { throw new Error("endereco_interno"); }, false, null, "endereco_interno"],
    [async () => { throw new Error("getaddrinfo ENOTFOUND x.com"); }, false, null, "endereco_nao_encontrado"],
    [async () => { throw new Error("connect ECONNREFUSED 1.2.3.4:443"); }, false, null, "conexao_recusada"],
    [async () => { throw new Error("unable to verify the first certificate"); }, false, null, "certificado_invalido"],
    [async () => { throw new Error("algo inesperado com https://x.com/segredo123"); }, false, null, "falha_de_conexao"],
  ];
  for (const [transporte, ok, status, erro] of casos) {
    const { p, registros } = portas([]);
    assert.equal(await enviarEntrega(entrega(), p, transporte), ok);
    assert.deepEqual(registros, [{ entrega: entrega().entrega, ok, status, erro }]);
  }
  assert.equal(motivoDaFalha("socket hang up"), "conexao_encerrada");
});

test("o envio manda o corpo assinado ao endereço certo, com o relógio do envio", async () => {
  const { p } = portas([]);
  let visto: { url: string; cab: Record<string, string>; corpo: string } | null = null;
  await enviarEntrega(entrega(), p, async (url, cab, corpo) => { visto = { url, cab, corpo }; return { status: 200 }; }, () => 1_800_000_000_000);
  assert.ok(visto);
  const v = visto as { url: string; cab: Record<string, string>; corpo: string };
  assert.equal(v.url, "https://exemplo.com.br/hooks/jards");
  assert.equal(assinaturaConfere(SEGREDO, v.corpo, v.cab["x-jards-assinatura"], 1_800_000_000), true);
});

test("falha ao registrar não derruba o envio nem as outras entregas", async () => {
  const { p, registros } = portas([]);
  p.falharAoRegistrar = true;
  assert.equal(await enviarEntrega(entrega(), p, async () => ({ status: 200 })), true);
  assert.deepEqual(registros, []);
});

test("uma rodada: reivindica, envia em lotes e conta; entrega malformada é descartada e uma que falha não para as outras", async () => {
  const lista = [1, 2, 3, 4, 5, 6, 7].map(n => ({ ...entrega({ entrega: `e${n}`, url: n === 3 ? "https://falha.exemplo.com/h" : "https://ok.exemplo.com/h" }) })).concat([{ lixo: true } as unknown as EntregaParaEnviar]);
  const { p, registros } = portas(lista);
  let simultaneas = 0, maximo = 0;
  const transporte: Transporte = async url => {
    simultaneas++; maximo = Math.max(maximo, simultaneas);
    await new Promise(r => setTimeout(r, 2));
    simultaneas--;
    if (url.includes("falha")) throw new Error("ECONNREFUSED");
    return { status: 200 };
  };
  const resumo = await enviarDevidas(p, transporte, 50, 3);
  assert.deepEqual(resumo, { reivindicadas: 7, enviadas: 6, falhas: 1 });
  assert.equal(registros.length, 7);
  assert.ok(maximo <= 3, "no máximo 3 ao mesmo tempo");
  assert.equal(registros.find(r => r.entrega === "e3")?.erro, "conexao_recusada");
  assert.deepEqual(await enviarDevidas(portas(null).p, transporte), { reivindicadas: 0, enviadas: 0, falhas: 0 });
});

test("a resolução do nome: recusa nome que aponta para rede interna (mesmo que misturado com endereço público) e devolve só o endereço conferido", async () => {
  const resolver = (mapa: Record<string, { address: string; family: number }[]>) => resolverSemRedeInterna(async host => mapa[host] ?? []);
  const r = resolver({ "ok.com": [{ address: "8.8.8.8", family: 4 }], "mau.com": [{ address: "10.0.0.5", family: 4 }], "misto.com": [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }], "meta.com": [{ address: "169.254.169.254", family: 4 }] });
  const chamar = (host: string, opcoes: { all?: boolean }) => new Promise<{ erro: Error | null; resposta: unknown; familia?: number }>(resolve => r(host, opcoes, (erro, resposta, familia) => resolve({ erro, resposta, familia })));
  assert.deepEqual(await chamar("ok.com", {}), { erro: null, resposta: "8.8.8.8", familia: 4 });
  assert.deepEqual((await chamar("ok.com", { all: true })).resposta, [{ address: "8.8.8.8", family: 4 }]);
  for (const host of ["mau.com", "misto.com", "meta.com", "inexistente.com"]) assert.equal((await chamar(host, {})).erro?.message, "endereco_interno", host);
});
