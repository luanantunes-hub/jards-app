import assert from "node:assert/strict";
import test from "node:test";
import { type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarPecas } from "../lib/prestacao/checagens/checar-pecas";
import { DEFESO_ELEITORAL_2026 } from "../lib/prestacao/calendario-regulatorio";
import {
  defesosDaPeca,
  erroDaPeca,
  marcasEsperadas,
  marcasFaltando,
  periodoDaVeiculacao,
  situacaoDaAprovacao,
  type CamposDaPeca,
  type PecaParaChecar,
} from "../lib/prestacao/pecas";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const MARCAS = ["Lei de Incentivo à Cultura (Lei Rouanet)", "Ministério da Cultura", "Governo Federal"];
const SEM_GOVERNO = MARCAS.slice(0, 2);
const DEFESO = { inicio: DEFESO_ELEITORAL_2026.inicio, fim: DEFESO_ELEITORAL_2026.fim, descricao: DEFESO_ELEITORAL_2026.descricao };

const peca = (campos: Partial<PecaParaChecar>): PecaParaChecar => ({
  id: "p1", tipo: "cartaz", titulo: "Cartaz da estreia", veiculacao_inicio: "2026-06-15", veiculacao_fim: null, marcas: MARCAS,
  aprovacao_status: "aprovada", aprovacao_enviada_em: "2026-06-01", aprovacao_decidida_em: "2026-06-10",
  storage_path: "org/prestacoes/p/pecas/a.png", url: null, justificativa: null, ...campos,
});
const estado = (pecas: PecaParaChecar[], campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  hoje: new Date("2026-10-07T12:00:00Z"),
  defesos: [DEFESO],
  pecas,
  ...campos,
});

test("marcas do regime; no defeso, sem a do Governo Federal", () => {
  assert.deepEqual(marcasEsperadas(ROUANET, false), MARCAS);
  assert.deepEqual(marcasEsperadas(ROUANET, true), SEM_GOVERNO);
  assert.deepEqual(marcasEsperadas(null, false), []);
  assert.deepEqual(marcasFaltando({ marcas: ["ministerio da cultura", "Lei de Incentivo a Cultura (Lei Rouanet)"] }, MARCAS), ["Governo Federal"], "sem acento nem caixa");
  assert.equal(defesosDaPeca({ veiculacao_inicio: "2026-07-01", veiculacao_fim: "2026-07-05" }, [DEFESO]).length, 1, "o período encosta no defeso");
  assert.equal(defesosDaPeca({ veiculacao_inicio: "2026-10-05", veiculacao_fim: null }, [DEFESO]).length, 0);
  assert.equal(periodoDaVeiculacao({ veiculacao_inicio: "2026-08-01", veiculacao_fim: "2026-08-10" }), "01/08/2026 a 10/08/2026");
});

test("aprovação: expressa, pelo silêncio depois de 5 dias úteis ou aguardando", () => {
  // Enviada na segunda 03/08: o MinC tem até 10/08 (5 dias úteis); a peça circula a partir de 11/08.
  const enviada = { aprovacao_status: "enviada" as const, aprovacao_enviada_em: "2026-08-03", aprovacao_decidida_em: null };
  assert.deepEqual(situacaoDaAprovacao(enviada, ROUANET, "2026-08-10"), { estado: "aguardando", aprovadaEm: null, vencimento: "2026-08-10", texto: "Enviada em 03/08/2026; o órgão tem até 10/08/2026" });
  assert.deepEqual(situacaoDaAprovacao(enviada, ROUANET, "2026-08-11"), { estado: "aprovada_pelo_silencio", aprovadaEm: "2026-08-11", vencimento: "2026-08-10", texto: "Aprovada pelo silêncio em 11/08/2026" });
  // Com o feriado de 07/09 no meio, o prazo anda um dia.
  assert.equal(situacaoDaAprovacao({ ...enviada, aprovacao_enviada_em: "2026-09-04" }, ROUANET, "2026-09-05").vencimento, "2026-09-14");
  assert.equal(situacaoDaAprovacao({ aprovacao_status: "nao_enviada", aprovacao_enviada_em: null, aprovacao_decidida_em: null }, null, "2026-08-01").estado, "nao_pedida");
});

test("peça aprovada antes de circular, com as marcas e a amostra, não gera achado", () => {
  assert.deepEqual(checarPecas(estado([peca({})])), []);
  assert.deepEqual(checarPecas(estado([peca({ id: "silencio", aprovacao_status: "enviada", aprovacao_enviada_em: "2026-06-01", aprovacao_decidida_em: null, veiculacao_inicio: "2026-06-10" })])), [], "circulou depois do prazo do órgão (com Corpus Christi, ponto facultativo, em 04/06)");
  assert.deepEqual(checarPecas(estado([peca({ id: "futura", aprovacao_status: "nao_enviada", aprovacao_enviada_em: null, aprovacao_decidida_em: null, veiculacao_inicio: "2026-12-01", storage_path: null })])), [], "ainda não circulou");
});

test("peça que circulou sem aprovação: não enviada, antes do prazo, depois de recusada", () => {
  const achados = checarPecas(estado([
    peca({ id: "nao", aprovacao_status: "nao_enviada", aprovacao_enviada_em: null, aprovacao_decidida_em: null, veiculacao_inicio: "2026-06-01" }),
    peca({ id: "cedo", titulo: "Post", aprovacao_status: "enviada", aprovacao_enviada_em: "2026-06-01", aprovacao_decidida_em: null, veiculacao_inicio: "2026-06-03", justificativa: "Convite urgente da prefeitura." }),
    peca({ id: "recusada", aprovacao_status: "reprovada", aprovacao_decidida_em: "2026-06-10", veiculacao_inicio: "2026-06-20" }),
    peca({ id: "depois", aprovacao_decidida_em: "2026-06-20", veiculacao_inicio: "2026-06-15" }),
  ]));
  assert.deepEqual(achados.map(a => [a.chave, a.severidade, a.justificativa]), [
    ["PECA_SEM_APROVACAO:peca:nao", "alerta", null],
    ["PECA_SEM_APROVACAO:peca:cedo", "alerta", "Convite urgente da prefeitura."],
    ["PECA_SEM_APROVACAO:peca:recusada", "alerta", null],
    ["PECA_SEM_APROVACAO:peca:depois", "alerta", null],
  ]);
  assert.equal(achados[0].mensagem, `"Cartaz da estreia" circulou a partir de 01/06/2026 sem ter sido enviada para aprovação prévia.`);
  assert.match(achados[1].mensagem, /a partir de 03\/06\/2026 antes da aprovação \(10\/06\/2026\)/, "o silêncio aprovou depois que ela já circulava");
  assert.match(achados[2].mensagem, /e foi recusada em 10\/06\/2026/);
  assert.match(achados[3].mensagem, /antes da aprovação \(20\/06\/2026\)/);
  assert.equal(achados[0].fonte?.dispositivo, "art. 21, §§ 2º e 3º");
});

test("marca faltando é bloqueio na Rouanet; no defeso, a do Governo Federal sai", () => {
  const fora = checarPecas(estado([peca({ marcas: SEM_GOVERNO })]));
  assert.deepEqual(fora.map(a => [a.chave, a.severidade]), [["PECA_MARCA_FALTANDO:peca:p1", "bloqueio"]]);
  assert.equal(fora[0].mensagem, `"Cartaz da estreia" não mostra a marca "Governo Federal".`);
  assert.equal(fora[0].fonte?.regra?.codigo, "marcas_em_todas_as_pecas");

  const noDefeso = { veiculacao_inicio: "2026-08-15", aprovacao_decidida_em: "2026-08-01", aprovacao_enviada_em: "2026-07-25" };
  assert.deepEqual(checarPecas(estado([peca({ ...noDefeso, marcas: SEM_GOVERNO })])), [], "versão de defeso, sem o Governo Federal");
  const comGoverno = checarPecas(estado([peca({ ...noDefeso, marcas: MARCAS })]));
  assert.deepEqual(comGoverno.map(a => [a.chave, a.severidade]), [["PECA_MARCA_NO_DEFESO:peca:p1", "alerta"]]);
  assert.match(comGoverno[0].mensagem, /no defeso eleitoral \(04\/07\/2026 a 04\/10\/2026\) com a marca "Governo Federal"/);
  assert.equal(comGoverno[0].fonte?.documento, "Lei 9.504/1997");
});

test("peça que circulou sem amostra; regime sem divulgação só pede a amostra", () => {
  const achados = checarPecas(estado([peca({ storage_path: null, url: null })]));
  assert.deepEqual(achados.map(a => a.chave), ["PECA_SEM_AMOSTRA:peca:p1"]);
  assert.equal(achados[0].fonte?.dispositivo, "art. 69, V");
  assert.deepEqual(checarPecas(estado([peca({ storage_path: null, url: "https://instagram.com/p/x" })])), [], "o link vale como amostra");
  const semRegime = checarPecas(estado([peca({ marcas: [], aprovacao_status: "nao_enviada", aprovacao_enviada_em: null, aprovacao_decidida_em: null, storage_path: null })], { regime: null }));
  assert.deepEqual(semRegime.map(a => a.codigo), ["PECA_SEM_AMOSTRA"]);
});

test("formulário: o mesmo que o banco confere", () => {
  const base: CamposDaPeca = {
    tipo: "cartaz", titulo: "Cartaz", meio: null, veiculacao_inicio: "2026-08-01", veiculacao_fim: "2026-08-10", marcas: [],
    aprovacao_status: "aprovada", aprovacao_protocolo: null, aprovacao_enviada_em: "2026-07-20", aprovacao_decidida_em: "2026-07-25",
    url: null, justificativa: null, observacoes: null,
  };
  assert.equal(erroDaPeca(base), null);
  assert.match(erroDaPeca({ ...base, titulo: " " })!, /título/);
  assert.match(erroDaPeca({ ...base, veiculacao_fim: "2026-07-01" })!, /não termina antes/);
  assert.match(erroDaPeca({ ...base, aprovacao_enviada_em: null })!, /enviada/);
  assert.match(erroDaPeca({ ...base, aprovacao_decidida_em: null })!, /decisão/);
  assert.match(erroDaPeca({ ...base, aprovacao_decidida_em: "2026-07-10" })!, /antes do envio/);
  assert.match(erroDaPeca({ ...base, url: "instagram.com/x" })!, /https/);
});
