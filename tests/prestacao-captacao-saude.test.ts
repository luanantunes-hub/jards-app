import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO_CHECAGENS, executarChecagens, type DespesaDoEstado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarCaptacao } from "../lib/prestacao/checagens/checar-captacao";
import { checarObras, ehCnaeDeConstrucao, obrasVedadas, pareceObra } from "../lib/prestacao/checagens/checar-obras";
import { regraDaCaptacao, situacaoDaCaptacao, textoDaCaptacao, type DadosDaCaptacao } from "../lib/prestacao/captacao";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { prazosDaPrestacao } from "../lib/prestacao/prontidao";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

// P9.1: a captação diante da liberação da execução na saúde (100% para
// executar, readequação para menor de 60% a 99,99%, acréscimo de até 20%),
// os tetos de custos indiretos e de elaboração e a vedação de obras.

const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;
const SAUDE_ANTIGA = regimePorCodigo("pronon_pronas_lxxxvi_2017")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const LIE = regimePorCodigo("lie_p10_2026")!;

const dados = (captado: number, campos: Partial<DadosDaCaptacao> = {}): DadosDaCaptacao =>
  ({ captado: captado * 100, aprovado: 100_000_00, orcamentoVigente: 100_000_00, alteracoes: [], dataFimCaptacao: null, ...campos });

const no = (id: string, nome: string, valor_total: number, grupo_custo: string | null): NoOrcamento => ({
  id, nome, versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
  grupo_custo: grupo_custo as NoOrcamento["grupo_custo"], unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total, valor_remanejado: 0, ordem: 0,
});

const aporte = (id: string, valor: number) => ({
  id, data: "2026-05-10", natureza: "credito" as const, valor, historico: "DOACAO", numero_documento: null, numero_normalizado: null, categoria: "aporte",
});

const despesa = (id: string, campos: Partial<DespesaDoEstado> = {}): DespesaDoEstado => ({
  id, nome_arquivo: `${id}.pdf`, status: "aceito", no_id: "i1", tipo: "nfse", data_doc: "2026-07-10", valor_extraido: 5000,
  fornecedor_id: null, numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

/** O real formatado usa espaço inseparável depois do "R$". */
const txt = (s: string | undefined) => (s ?? "").replace(/\u00a0/g, " ");

const pagamento = { id: "p1", despesa_id: "d1", forma: "ted", data: "2026-07-15", valor: 5000, favorecido_documento: null, numero_documento: "1", lancamento_id: null };

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: SAUDE, despesas: [despesa("d1")], fornecedores: [], documentosDosFornecedores: [], itens: [],
    nos: [no("i1", "Equipe de enfermagem", 100_000, "execucao")],
    pagamentos: [pagamento], lancamentos: [aporte("a1", 78_000)], alteracoes: [],
    valorAprovado: 100_000,
    prestacao: { data_termo: "2026-07-01", data_inicio_execucao: "2026-07-01", data_fim_execucao: "2027-06-30" },
    hoje: new Date("2026-07-20T12:00:00Z"),
    ...campos,
  } as EstadoDaPrestacao;
}

test("as faixas da captação saem do regime: 100% na saúde, 20% na Rouanet, nada na LIE", () => {
  const saude = regraDaCaptacao(SAUDE)!;
  assert.deepEqual([saude.liberacao, saude.minimoDaReducao, saude.acrescimoMaximo, saude.prazoDaReadequacao?.quantidade], [100, 60, 20, 30]);
  assert.equal(saude.fontes.liberacao.dispositivo, "arts. 50, 56, 58, 60, III, e 69, § 3º");
  const rouanet = regraDaCaptacao(ROUANET)!;
  assert.deepEqual([rouanet.liberacao, rouanet.minimoDaReducao, rouanet.acrescimoMaximo], [20, null, null], "na Rouanet os 20% só liberam a movimentação");
  assert.equal(regraDaCaptacao(LIE), null);
  assert.equal(regraDaCaptacao(SAUDE_ANTIGA)?.minimoDaReducao, 60, "o Anexo LXXXVI tinha as mesmas faixas");
});

test("situação da captação na saúde, faixa por faixa", () => {
  const faixa = (captado: number, campos?: Partial<DadosDaCaptacao>) => situacaoDaCaptacao(SAUDE, dados(captado, campos))!.faixa;
  assert.equal(faixa(0), "sem_aporte");
  assert.equal(faixa(59_999.99), "abaixo_do_minimo");
  assert.equal(faixa(60_000), "readequacao_para_menor");
  assert.equal(faixa(99_999.99), "readequacao_para_menor");
  assert.equal(faixa(100_000), "liberada");
  assert.equal(faixa(120_000), "acrescimo");
  assert.equal(faixa(120_000.01), "excedente");

  const menor = situacaoDaCaptacao(SAUDE, dados(78_000, { dataFimCaptacao: "2026-06-30" }))!;
  assert.equal(menor.prazoDaReadequacao, "2026-07-30", "30 dias corridos do fim da captação");
  assert.equal(textoDaCaptacao(menor), "Entre 60% e 100% do aprovado: a execução só começa com a readequação para menor aprovada, pedida até 30/07/2026.");
  assert.equal(textoDaCaptacao(situacaoDaCaptacao(SAUDE, dados(50_000))!), "Abaixo de 60% do aprovado: se a captação terminar assim, o projeto é indeferido e o captado é recolhido.");

  // Readequação para menor aprovada: o valor a captar é o orçamento readequado.
  const readequada = situacaoDaCaptacao(SAUDE, dados(78_000, { orcamentoVigente: 78_000_00, alteracoes: [{ tipo: "reducao", status: "aprovada" }] }))!;
  assert.deepEqual([readequada.faixa, readequada.aCaptar, readequada.readequada, readequada.prazoDaReadequacao], ["liberada", 78_000_00, true, null]);
  assert.equal(textoDaCaptacao(readequada), "100% do valor readequado captado: a execução está liberada.");
  // Pedida e sem decisão.
  const pedida = situacaoDaCaptacao(SAUDE, dados(78_000, { alteracoes: [{ tipo: "reducao", status: "solicitada" }] }))!;
  assert.equal(pedida.readequacaoPedida, true);
  assert.match(textoDaCaptacao(pedida), /foi pedida; a execução começa depois de aprovada/);

  const acima = situacaoDaCaptacao(SAUDE, dados(130_000))!;
  assert.deepEqual([acima.excedente, acima.acimaDoLimite], [30_000_00, 10_000_00]);
  assert.equal(txt(textoDaCaptacao(acima)), "R$ 10.000,00 acima de 120% do aprovado: esse valor é desconsiderado e recolhido; o restante do excedente depende da readequação para maior.");
  assert.equal(situacaoDaCaptacao(SAUDE, dados(50_000, { aprovado: null, orcamentoVigente: null })), null, "sem aprovado nem orçamento, não há o que medir");
});

test("checagens da captação: pagamento sem a captação, readequação no prazo, captação insuficiente e excedente", () => {
  // 78% captado e um pagamento, sem fim da captação informado.
  const sem = checarCaptacao(estado());
  assert.deepEqual(sem.map(a => [a.codigo, a.severidade, a.resultado]), [
    ["EXECUCAO_SEM_CAPTACAO_MINIMA", "alerta", "nao_conforme"],
    ["READEQUACAO_DA_CAPTACAO", "info", "nao_calculavel"],
  ]);
  assert.equal(txt(sem[0].mensagem), "1 pagamento (R$ 5.000,00) com 78% do aprovado captado (R$ 78.000,00 de R$ 100.000,00): a execução só começa com a readequação para menor aprovada. Confira se o extrato da conta de captação está completo.");
  assert.equal(sem[0].fonte?.dispositivo, "arts. 50, 56, 58, 60, III, e 69, § 3º");
  assert.equal(sem[1].mensagem, "Com 78% do aprovado captado, a execução depende da readequação para menor, pedida em 30 dias do fim da captação. Informe o fim da captação nos dados oficiais para contar o prazo.");

  // Com o fim da captação, o prazo vencido vira alerta.
  const vencido = checarCaptacao(estado({ prestacao: { data_fim_captacao: "2026-06-10", data_termo: "2026-07-01", data_fim_execucao: "2027-06-30" } }));
  const readequacao = vencido.find(a => a.codigo === "READEQUACAO_DA_CAPTACAO")!;
  assert.equal(readequacao.severidade, "alerta");
  assert.equal(readequacao.mensagem, "Com 78% do aprovado captado, a execução depende da readequação para menor; o prazo do pedido venceu em 10/07/2026, 30 dias do fim da captação (10/06/2026). Registre o pedido em Orçamento, Alterações.");
  assert.equal(readequacao.fonte?.dispositivo, "arts. 58 e 59");

  // Readequação aprovada (o orçamento vigente já é o readequado): nada a apontar.
  assert.deepEqual(checarCaptacao(estado({
    nos: [no("i1", "Equipe de enfermagem", 78_000, "execucao")],
    alteracoes: [{ id: "x", numero: 1, status: "aprovada", solicitada_em: "2026-06-20", tipo: "reducao" }],
  })), []);

  // Captação encerrada abaixo de 60%.
  const pouca = checarCaptacao(estado({ lancamentos: [aporte("a1", 40_000)], pagamentos: [], prestacao: { data_fim_captacao: "2026-06-10" } }));
  assert.deepEqual(pouca.map(a => a.codigo), ["CAPTACAO_INSUFICIENTE"]);
  assert.equal(txt(pouca[0].mensagem), "A captação terminou em 10/06/2026 com R$ 40.000,00, 40% do aprovado (R$ 100.000,00), abaixo dos 60% que permitem a readequação: o projeto é indeferido e o captado é recolhido. Confira se o extrato da conta de captação está completo.");

  // Acima de 120%: o excedente é recolhido; até 20% depende da readequação para maior.
  const muito = checarCaptacao(estado({ lancamentos: [aporte("a1", 130_000)] }));
  assert.deepEqual(muito.map(a => [a.codigo, a.severidade, a.chave]), [
    ["READEQUACAO_DA_CAPTACAO", "info", "READEQUACAO_DA_CAPTACAO:prestacao:-:para_maior"],
    ["CAPTADO_ACIMA_DO_AUTORIZADO", "alerta", "CAPTADO_ACIMA_DO_AUTORIZADO:prestacao:-:captado"],
  ]);
  assert.equal(txt(muito[1].mensagem), "Os aportes do extrato somam R$ 130.000,00, acima de 120% do aprovado (R$ 120.000,00): R$ 10.000,00 são desconsiderados e recolhidos.");
  assert.equal(muito[1].fonte?.regra?.codigo, "captacao_acima");

  // Liberada: nada.
  assert.deepEqual(checarCaptacao(estado({ lancamentos: [aporte("a1", 100_000)] })), []);
  // Sem aporte no extrato, o extrato ausente já aponta.
  assert.deepEqual(checarCaptacao(estado({ lancamentos: [] })), []);
  // Rouanet: pagamentos com menos de 20% captado; acima do aprovado, nada aqui.
  const rouanet = checarCaptacao(estado({ regime: ROUANET, lancamentos: [aporte("a1", 15_000)] }));
  assert.deepEqual(rouanet.map(a => a.codigo), ["EXECUCAO_SEM_CAPTACAO_MINIMA"]);
  assert.match(rouanet[0].mensagem, /com 15% do aprovado captado .*: a execução só começa com 20% do aprovado captado\./);
  assert.deepEqual(checarCaptacao(estado({ regime: ROUANET, lancamentos: [aporte("a1", 150_000)] })), []);
  assert.deepEqual(checarCaptacao(estado({ regime: LIE })), []);
});

test("tetos da saúde: custos indiretos até 15% e elaboração até 5% e R$ 50 mil", () => {
  const tetos = (nos: NoOrcamento[]) => executarChecagens(estado({ nos, lancamentos: [aporte("a1", 2_000_000)], valorAprovado: 2_000_000 }))
    .filter(a => a.codigo === "TETO_GRUPO_CUSTO").map(a => [a.chave, txt(a.mensagem)]);
  assert.deepEqual(tetos([no("i1", "Equipe", 1_620_000, "execucao"), no("i2", "Aluguel e energia", 320_000, "administracao"), no("i3", "Captação", 60_000, "elaboracao")]), [
    ["TETO_GRUPO_CUSTO:prestacao:-:administracao", "Custos indiretos: R$ 320.000,00 no orçamento vigente, acima do teto de 15% do valor do projeto (R$ 300.000,00)."],
    ["TETO_GRUPO_CUSTO:prestacao:-:elaboracao", "Elaboração da proposta e captação: R$ 60.000,00 no orçamento vigente, acima do teto de 5% do valor total do projeto (R$ 50.000,00)."],
  ]);
  assert.deepEqual(tetos([no("i1", "Equipe", 1_660_000, "execucao"), no("i2", "Aluguel", 300_000, "administracao"), no("i3", "Captação", 40_000, "elaboracao")]), []);
});

test("obras vedadas: item com nome de obra e fornecedor da construção", () => {
  assert.deepEqual(obrasVedadas("Obras, reformas, ampliações e construções"), ["obra", "reforma", "ampliacao", "construcao"]);
  assert.deepEqual(obrasVedadas("Ampliação e construção de imóveis"), ["ampliacao", "construcao"]);
  const todas = obrasVedadas("Obras, reformas, ampliações e construções");
  assert.equal(pareceObra("Reforma do ambulatório", todas), true);
  assert.equal(pareceObra("Construção de sala de fisioterapia", todas), true);
  assert.equal(pareceObra("Mão de obra de enfermagem", todas), false, "mão de obra é pessoal");
  assert.equal(pareceObra("Reformatação do protocolo", todas), false);
  assert.equal(pareceObra("Reforma do ambulatório", ["ampliacao", "construcao"]), false, "no Anexo LXXXVI a reforma era admitida");
  assert.equal(ehCnaeDeConstrucao("4120-4/00"), true);
  assert.equal(ehCnaeDeConstrucao("4399103"), true);
  assert.equal(ehCnaeDeConstrucao("8630-5/03"), false);

  const fornecedor = { id: "f1", razao_social: "CONSTRUTORA P91 LTDA", nome: null, documento: "91000000000191", cnae_principal: "4120400", cnae_descricao: "Construção de edifícios" } as PrestacaoFornecedor;
  const achados = checarObras(estado({
    nos: [no("i1", "Equipe de enfermagem", 80_000, "execucao"), no("i2", "Reforma do ambulatório", 20_000, "execucao")],
    despesas: [despesa("d1", { fornecedor_id: "f1", nome_arquivo: "nf-obra.pdf" }), despesa("d2", { fornecedor_id: "f1", status: "rejeitado" })],
    fornecedores: [fornecedor],
  }));
  assert.deepEqual(achados.map(a => [a.codigo, a.chave]), [
    ["ITEM_DE_OBRA", "ITEM_DE_OBRA:prestacao:-:i2"],
    ["DESPESA_DE_OBRA", "DESPESA_DE_OBRA:despesa:d1"],
  ]);
  assert.equal(achados[0].mensagem, 'O item "Reforma do ambulatório" parece obra: obras, reformas, ampliações e construções são vedadas pelo regime. Tire o item do orçamento ou, se não for obra, dispense com o motivo.');
  assert.equal(achados[1].mensagem, "nf-obra.pdf: CONSTRUTORA P91 LTDA tem como atividade principal construção de edifícios (CNAE 4120-4/00), da construção; obras, reformas, ampliações e construções são vedadas pelo regime. Se o serviço não for obra, dispense com o motivo.");
  assert.equal(achados[0].fonte?.dispositivo, "art. 26");
  // No regime antigo, só ampliação e construção; o CNAE não distingue a reforma admitida.
  const antigo = checarObras(estado({ regime: SAUDE_ANTIGA, nos: [no("i2", "Reforma do ambulatório", 1, "execucao"), no("i3", "Ampliação da ala", 1, "execucao")], despesas: [despesa("d1", { fornecedor_id: "f1" })], fornecedores: [fornecedor] }));
  assert.deepEqual(antigo.map(a => a.chave), ["ITEM_DE_OBRA:prestacao:-:i3"]);
  assert.deepEqual(checarObras(estado({ regime: ROUANET, nos: [no("i2", "Reforma do teatro", 1, "execucao")] })), [], "a Rouanet não veda obra assim");
});

test("os códigos novos estão no catálogo e o prazo da readequação entra nos prazos", () => {
  for (const codigo of ["EXECUCAO_SEM_CAPTACAO_MINIMA", "READEQUACAO_DA_CAPTACAO", "CAPTACAO_INSUFICIENTE", "ITEM_DE_OBRA", "DESPESA_DE_OBRA"]) {
    assert.ok(codigo in CATALOGO_CHECAGENS, codigo);
  }
  const prazos = prazosDaPrestacao({ status: "rascunho", prazo: "2028-04-30", prazo_readequacao: "2026-07-30" }, SAUDE, [], "2026-07-20");
  assert.deepEqual(prazos.map(p => [p.rotulo, p.data, p.dias]), [["Pedido de readequação", "2026-07-30", 10], ["Envio da prestação", "2028-04-30", 650]]);
});
