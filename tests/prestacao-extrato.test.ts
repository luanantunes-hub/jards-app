import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adivinharMapaExtrato,
  chavesDosLancamentos,
  classificarLancamento,
  conferirSaldo,
  decodificarArquivo,
  hashDoArquivo,
  lerCsvExtrato,
  lerData,
  lerExtrato,
  lerOfx,
  lerValorComSinal,
  normalizarDocumento,
  totaisDoExtrato,
} from "../lib/prestacao/extrato";

const exemplo = async (nome: string) => decodificarArquivo(new Uint8Array(await readFile(`tests/fixtures/extrato/${nome}`)));

test("datas do extrato em AAAA-MM-DD", () => {
  assert.equal(lerData("02/09/2026"), "2026-09-02");
  assert.equal(lerData("2/9/26"), "2026-09-02");
  assert.equal(lerData("2026-09-02"), "2026-09-02");
  assert.equal(lerData("20260902120000[-3:BRT]"), "2026-09-02");
  assert.equal(lerData("31/02/2026"), null);
  assert.equal(lerData("Saldo"), null);
});

test("valor com sinal nos jeitos que os bancos escrevem", () => {
  assert.equal(lerValorComSinal("-2.057,00"), -2057);
  assert.equal(lerValorComSinal("(45,90)"), -45.9);
  assert.equal(lerValorComSinal("1.200,50 D"), -1200.5);
  assert.equal(lerValorComSinal("1.200,50-"), -1200.5);
  assert.equal(lerValorComSinal("15.000,00 C"), 15000);
  assert.equal(lerValorComSinal("-45.90"), -45.9);
  assert.equal(lerValorComSinal(""), 0);
});

test("OFX 1.x em Windows-1252: conta, período, saldo final e lançamentos", async () => {
  const extrato = lerOfx(await exemplo("ofx1-sgml-1252.ofx"));
  assert.deepEqual(extrato.conta, { banco: "001", agencia: "1234-5", conta: "98765-4" });
  assert.deepEqual(extrato.periodo, { inicio: "2026-09-01", fim: "2026-09-30" });
  assert.equal(extrato.saldoFinal, 148209.55);
  assert.equal(extrato.saldoInicial, null, "o OFX não traz o saldo inicial");
  assert.equal(extrato.lancamentos.length, 4);
  const [aporte, pix, tarifa, rendimento] = extrato.lancamentos;
  assert.equal(aporte.natureza, "credito");
  assert.equal(aporte.categoria, "transferencia");
  assert.equal(pix.valor, 2057);
  assert.equal(pix.natureza, "debito");
  assert.equal(pix.categoria, "pagamento");
  assert.equal(pix.documentoNormalizado, "45678", "sem ponto e traço, como o Salic compara");
  assert.equal(pix.idExterno, "202609050001");
  assert.equal(tarifa.historico, "TARIFA PACOTE SERVIÇOS", "acento lido do Windows-1252");
  assert.equal(tarifa.valor, 45.9, "vírgula decimal no TRNAMT");
  assert.equal(tarifa.categoria, "tarifa");
  assert.equal(rendimento.categoria, "rendimento");
  assert.deepEqual(conferirSaldo(extrato), { situacao: "sem_saldos" });
});

test("OFX 2.x em XML, com entidades no texto", async () => {
  const extrato = lerExtrato(await exemplo("ofx2-xml.ofx"));
  assert.ok(extrato);
  assert.equal(extrato.formato, "ofx");
  assert.equal(extrato.conta?.banco, "104");
  assert.equal(extrato.lancamentos.length, 2);
  assert.equal(extrato.lancamentos[0].historico, "PAGAMENTO BOLETO · Gráfica & Cia");
  assert.equal(extrato.lancamentos[0].categoria, "pagamento");
  assert.equal(extrato.lancamentos[1].categoria, "aplicacao");
  assert.equal(extrato.saldoFinal, 3799.5);
});

test("CSV do BB: linhas de saldo marcam os saldos e a conta confere", async () => {
  const lido = lerCsvExtrato(await exemplo("bb.csv"));
  assert.ok(lido);
  const { extrato, mapa, tabela } = lido;
  assert.equal(tabela.cabecalho[Number(mapa.historico)], "Lançamento");
  assert.equal(tabela.cabecalho[Number(mapa.detalhe)], "Detalhes");
  assert.equal(tabela.cabecalho[Number(mapa.natureza)], "Tipo Lançamento");
  assert.equal(extrato.saldoInicial, 10000);
  assert.equal(extrato.saldoFinal, 32851.2);
  assert.equal(extrato.lancamentos.length, 4, "saldo anterior, saldo do dia e S A L D O não são lançamentos");
  assert.equal(extrato.lancamentos[0].historico, "Pix - Enviado · 02/09 10:31 Equipamento de Som Ltda");
  assert.equal(extrato.lancamentos[0].documentoNormalizado, "123456");
  assert.equal(extrato.lancamentos[3].natureza, "credito");
  assert.deepEqual(totaisDoExtrato(extrato.lancamentos), { creditos: 25000, debitos: 2148.8, quantidade: 4 });
  assert.deepEqual(conferirSaldo(extrato), { situacao: "confere" });
});

test("CSV com dados da conta antes do cabeçalho e coluna D/C", async () => {
  const extrato = lerCsvExtrato(await exemplo("caixa-com-preambulo.csv"))?.extrato;
  assert.ok(extrato);
  assert.equal(extrato.lancamentos.length, 3);
  assert.deepEqual(extrato.lancamentos.map(l => [l.natureza, l.valor]), [["credito", 15000], ["debito", 1200.5], ["debito", 12]]);
  assert.equal(extrato.lancamentos[2].categoria, "tarifa");
  assert.deepEqual(extrato.periodo, { inicio: "2026-10-01", fim: "2026-10-10" });
  assert.deepEqual(conferirSaldo(extrato), { situacao: "sem_saldos" });
});

test("CSV com colunas de crédito, débito e saldo", async () => {
  const lido = lerCsvExtrato(await exemplo("creditos-debitos.csv"));
  assert.ok(lido);
  assert.equal(lido.mapa.valor, "", "com crédito e débito separados, não há coluna de valor");
  const { extrato } = lido;
  assert.deepEqual(extrato.lancamentos.map(l => [l.natureza, l.valor]), [["credito", 50000], ["debito", 12300], ["debito", 3.1]]);
  assert.equal(extrato.saldoInicial, 0, "saldo da primeira linha menos o primeiro lançamento");
  assert.equal(extrato.saldoFinal, 37696.9);
  assert.deepEqual(conferirSaldo(extrato), { situacao: "confere" });
  assert.equal(extrato.lancamentos[2].categoria, "tarifa");
});

test("saldo que não bate aparece com a diferença", () => {
  const conferencia = conferirSaldo({
    saldoInicial: 100,
    saldoFinal: 90,
    lancamentos: [{ data: "2026-09-01", valor: 15, natureza: "debito", historico: "x", documento: null, documentoNormalizado: null, idExterno: null, saldoApos: null, categoria: "outro" }],
  });
  assert.deepEqual(conferencia, { situacao: "diverge", esperado: 85, informado: 90, diferenca: 5 });
});

test("chaves: FITID manda; sem ele, iguais no mesmo arquivo viram dois", async () => {
  const bb = lerCsvExtrato(await exemplo("bb.csv"))!.extrato;
  const chaves = chavesDosLancamentos(bb.lancamentos);
  assert.equal(new Set(chaves).size, 4, "as duas tarifas iguais do mesmo dia continuam sendo duas");
  assert.match(chaves[1], /\|1$/);
  assert.match(chaves[2], /\|2$/);
  // O mesmo período importado de novo gera as mesmas chaves.
  assert.deepEqual(chavesDosLancamentos(lerCsvExtrato(await exemplo("bb.csv"))!.extrato.lancamentos), chaves);
  const ofx = lerOfx(await exemplo("ofx1-sgml-1252.ofx"));
  assert.equal(chavesDosLancamentos(ofx.lancamentos)[0], "fitid:202609020001");
});

test("categoria sugerida pelo histórico", () => {
  assert.equal(classificarLancamento("TAR MANUT CONTA", "debito"), "tarifa");
  assert.equal(classificarLancamento("Rend Pago Aplic", "credito"), "rendimento");
  assert.equal(classificarLancamento("Resgate CDB", "credito"), "resgate");
  assert.equal(classificarLancamento("Estorno de Pix", "credito"), "estorno");
  assert.equal(classificarLancamento("Pix - Recebido", "credito"), "outro", "crédito por Pix não é pagamento");
  assert.equal(classificarLancamento("Pagto GRU", "debito"), "devolucao");
});

test("número do documento normalizado e mapa de colunas", async () => {
  assert.equal(normalizarDocumento("000.123-4"), "1234");
  assert.equal(normalizarDocumento(" "), null);
  const mapa = adivinharMapaExtrato(["Data_Mov", "Nr_Doc", "Historico", "Valor", "Deb_Cred"]);
  assert.deepEqual(mapa, { data: "0", historico: "2", detalhe: "", documento: "1", valor: "3", credito: "", debito: "", natureza: "4", saldo: "" });
  assert.equal((await hashDoArquivo(new TextEncoder().encode("abc"))).length, 64);
});

test("banco do extrato: contas por papel, importação e lançamentos só pela função", async () => {
  const sql = (await readFile("supabase/migrations/20261006140000_prestacao_extrato.sql", "utf8")).replace(/--.*$/gm, "");
  for (const tabela of ["prestacao_contas_bancarias", "prestacao_extrato_importacoes", "prestacao_lancamentos"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${tabela} \\(`));
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`));
  }
  assert.match(sql, /revoke insert, update on public\.prestacao_extrato_importacoes from authenticated, anon/);
  assert.match(sql, /revoke insert, update, delete on public\.prestacao_lancamentos from authenticated, anon/);
  assert.match(sql, /unique \(conta_id, chave\)/, "a chave do lançamento é única na conta");
  assert.match(sql, /prestacao_extrato_importacoes \(conta_id, hash_arquivo\) where hash_arquivo is not null/);
  assert.match(sql, /security definer[\s\S]*auth_prestacao_pode\(v_prestacao, 'editar'\)/);
  assert.match(sql, /'\/prestacoes\/' \|\| v_prestacao \|\| '\/extratos\/%'/, "o arquivo tem de estar na pasta da prestação");
  assert.match(sql, /revoke execute on function public\.fn_prestacao_extrato_importar\(uuid, jsonb, jsonb\) from public, anon/);
  assert.doesNotMatch(sql, /\bdrop\b/i, "sem DROP: o conector trava em comandos destrutivos");
});
