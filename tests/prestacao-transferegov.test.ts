import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarEncerramento } from "../lib/prestacao/checagens/checar-encerramento";
import { prazoDoSaldo } from "../lib/prestacao/prazo-final";
import { prazoDoSaldoEmAberto, prazosDaPrestacao } from "../lib/prestacao/prontidao";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import {
  codigoDaParceria,
  compararComTransferegov,
  contaCorrespondente,
  documentoDaApi,
  lerConta,
  lerExtratoDoTransferegov,
  lerParceria,
  lerProposta,
  nupFormatado,
  processoDoNup,
  resumoDaImportacao,
  resumoDosIngressos,
  saldoDaConta,
  separarLancamentosNovos,
} from "../lib/prestacao/transferegov";

// P9.4: a parceria, as contas e o extrato pela API de parcerias do
// Transferegov, e o saldo no encerramento. Os registros seguem o formato da
// API (consultada em 09/10/2026), com nomes, documentos e valores fictícios.

const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;
const LIE = regimePorCodigo("lie_p10_2026")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

test("identificadores: NUP sem pontuação, número da parceria e documentos que a API manda como número", () => {
  assert.equal(processoDoNup("25000.161983/2024-66"), "25000161983202466");
  assert.equal(processoDoNup("24-0264"), null, "SALIC não é NUP");
  assert.equal(nupFormatado("25000161983202466"), "25000.161983/2024-66");
  assert.equal(codigoDaParceria(202400000270), "2024-00000270");

  assert.equal(documentoDaApi("53096781000126.0"), "53096781000126");
  assert.equal(documentoDaApi("606549000124"), "00606549000124", "CNPJ sem os zeros à esquerda");
  assert.equal(documentoDaApi("191"), "00000000000191", "o Banco do Brasil");
  assert.equal(documentoDaApi("1234567890"), "01234567890", "CPF sem o zero à esquerda");
  assert.equal(documentoDaApi("***40317***"), "***40317***", "CPF mascarado pelo banco fica como veio");
  assert.equal(documentoDaApi("Não informado pelo banco"), null);
  assert.equal(documentoDaApi("0"), null);
  assert.equal(documentoDaApi(null), null);
});

const PARCERIA = {
  id_parceria: 9001, cd_parceria: 202400009001, id_proposta: 9001, in_situacao_parceria: "Em Execução",
  cd_processo_sei: "25000999999202491", dh_assinatura: "2026-04-10T11:07:40.999999",
  in_situacao_autorizacao_execucao: "Autorização Execução", dh_autorizacao_execucao: "2026-05-13T14:16:45.196999",
  ds_justificativa_autorizacao: "Transferência da conta captação para a conta movimento em 11/05/2026.",
  prazo_limite_captacao_recursos: "20/12/2024 à 30/11/2025",
  publicacoes_parceria: [{
    dt_publicacao: "2024-12-11", ds_documento_publicado: "PORTARIA SE/MS Nº 715, DE 10 DE DEZEMBRO DE 2024",
    ds_url_documento_publicado: "https://www.in.gov.br/exemplo", dt_inicio_captacao: "2024-12-20", dt_fim_captacao: "2025-11-30",
  }],
};

test("a parceria: situação, processo, assinatura, autorização de execução e captação pela publicação", () => {
  const p = lerParceria(PARCERIA);
  assert.deepEqual(
    [p.id, p.codigo, p.situacao, p.processo, p.assinatura, p.autorizacao.data, p.captacao.inicio, p.captacao.fim],
    [9001, "2024-00009001", "Em Execução", "25000.999999/2024-91", "2026-04-10", "2026-05-13", "2024-12-20", "2025-11-30"],
  );
  assert.equal(p.publicacoes[0].documento, "PORTARIA SE/MS Nº 715, DE 10 DE DEZEMBRO DE 2024");
  // Sem publicação, a captação sai do texto do prazo.
  const semPublicacao = lerParceria({ ...PARCERIA, publicacoes_parceria: [] });
  assert.deepEqual(semPublicacao.captacao, { inicio: "2024-12-20", fim: "2025-11-30" });

  const proposta = lerProposta({ nm_ente_recebedor: "HOSPITAL EXEMPLO", cnpj_ente_recebedor: "88417787000132", nm_municipio_recebedor: "MARAU", sg_uf_recebedor: "RS", vl_total_planejamento_gastos: 2632000.0, situacao_proposta: "Aprovada" });
  assert.deepEqual([proposta.instituicao, proposta.cnpj, proposta.municipio, proposta.valorPlanejado], ["HOSPITAL EXEMPLO", "88417787000132", "MARAU/RS", 263_200_000]);
});

const ingresso = (valor: number, campos: Record<string, unknown>) => ({
  id_extrato_lancamento: 1, nu_identificacao_depositante: "13769335000110", tx_nome_depositante: "INDUSTRIA EXEMPLO LTDA",
  dt_movimento_lancamento: "2025-03-28", vl_lancamento: valor, ...campos,
});

const CONTA_CAPTACAO = {
  id_parceria_conta: 260, id_parceria: 9001, tx_conta: "584061", tp_conta: "Conta Captação", nm_conta: "Conta captação",
  dt_abertura: "2024-12-23", tx_descricao: "Ativa", nm_banco: "Banco do Brasil", tx_numero: "726",
  ds_justificativa: "Agência do Banco do Brasil: 0726-9", nm_personalizado_conta_bb_agil: "PRONON ASSISTENCIAL-CAP24",
  vl_saldo_conta_corrente: 0.0, dt_referencia_saldo_conta_corrente: "2025-09-29", vl_saldo_conta_investimento: 1200.5, dt_referencia_saldo_conta_investimento: "2026-06-15",
  classificacoes_ingresso: [
    ingresso(513.83, { tx_descricao_classificacao_ingresso: "Classificado", tx_descricao_classificao_ingresso_tipo: "Doação/Incentivo", tx_desc_classificacao_analise_situacao: "Aprovado", vl_captado_aprovado: 513.83 }),
    ingresso(15000, { tx_descricao_classificacao_ingresso: "Classificado", tx_descricao_classificao_ingresso_tipo: "Doação/Incentivo", tx_desc_classificacao_analise_situacao: null, vl_aguardando_analise: 15000 }),
    ingresso(700, { tx_descricao_classificacao_ingresso: "Classificado", tx_descricao_classificao_ingresso_tipo: "Ingresso Indevido", tx_desc_classificacao_analise_situacao: null }),
    ingresso(2000, { tx_descricao_classificacao_ingresso: "Não Classificado", tx_descricao_classificao_ingresso_tipo: null, vl_nao_classificado: 2000 }),
  ],
};
const CONTA_MOVIMENTO = {
  id_parceria_conta: 261, id_parceria: 9001, tx_conta: "623334", tp_conta: null, nm_conta: "Conta Movimentação",
  dt_abertura: "2026-04-30", tx_descricao: "Ativa", nm_banco: "Banco do Brasil", tx_numero: "726",
  ds_justificativa: "Agência do Banco do Brasil: 0726-9", nm_personalizado_conta_bb_agil: "PRONON ASSISTENCIAL-MOV24",
  vl_saldo_conta_corrente: 0.0, dt_referencia_saldo_conta_corrente: "2026-06-03", vl_saldo_conta_investimento: 216633.95, dt_referencia_saldo_conta_investimento: "2026-06-15",
  classificacoes_ingresso: [
    { nu_identificacao_depositante: "Não informado pelo banco", tx_nome_depositante: "Não informado pelo banco", dt_movimento_lancamento: "2026-05-11", vl_lancamento: 2832835.04, tx_descricao_classificacao_ingresso: "Não Classificado", vl_nao_classificado: 2832835.04 },
  ],
};

test("as contas: tipo, agência com dígito, saldo com a aplicação e a captação classificada só na Conta Captação", () => {
  const captacao = lerConta(CONTA_CAPTACAO);
  const movimento = lerConta(CONTA_MOVIMENTO);
  assert.deepEqual([captacao.tipo, captacao.agencia, captacao.numero, captacao.apelido], ["captacao", "0726-9", "584061", "PRONON ASSISTENCIAL-CAP24"]);
  assert.equal(movimento.tipo, "movimento");
  assert.deepEqual(saldoDaConta(movimento), { valor: 21_663_395, data: "2026-06-03" }, "corrente mais aplicação, na referência mais antiga");
  assert.deepEqual(captacao.ingressos.map(i => [i.situacao, i.valor]), [["aprovado", 51_383], ["aguardando", 1_500_000], ["indevido", 70_000], ["nao_classificado", 200_000]]);
  assert.equal(captacao.ingressos[0].depositante.documento, "13769335000110");
  assert.deepEqual(resumoDosIngressos([captacao, movimento]), {
    aprovado: 51_383, aguardando: 1_500_000, naoClassificado: 200_000, indevido: 70_000, outro: 0, quantidadeNaoClassificada: 1,
  }, "a transferência para a movimentação não conta como captação");
});

const linha = (id: number, n: number, data: string, transacao: "Crédito" | "Débito", operacao: string, valor: number, campos: Record<string, unknown> = {}) => ({
  id_extrato_bancario: id, nu_identificador_lancamento_extrato_bancario: n, nr_interno_referencia: 1972, in_transacao: transacao,
  nm_tipo_operacao: operacao, dt_movimento_lancamento_extrato_bancario: `${data}T00:00:00`, vl_lancamento_extrato_bancario: valor,
  nu_identificacao_depositante_extrato_bancario: null, tx_nome_depositante_extrato_bancario: null, nu_identificacao_beneficiario: null, tx_nome_beneficiario: "",
  ...campos,
});

test("o extrato: ordem, categoria pela operação e pela conta, e o doador ou o favorecido no histórico", () => {
  const captacao = lerExtratoDoTransferegov([
    linha(1554, 8, "2024-12-27", "Débito", "BB-APLIC C.PRZ-APL.AUT", -119000),
    linha(1550, 2, "2024-12-27", "Crédito", "TED Transferência Eletr.Disp", 42000, { nu_identificacao_depositante_extrato_bancario: "60995891000195", tx_nome_depositante_extrato_bancario: "INDUSTRIA EXEMPLO LTDA" }),
    linha(1560, 54, "2026-05-11", "Débito", "Movimento do Dia", -2832835.04, { nu_identificacao_beneficiario: "0" }),
    linha(1561, 55, "2026-05-11", "Crédito", "Resgate Automático", 2832835.04, { nu_identificacao_depositante_extrato_bancario: "191", tx_nome_depositante_extrato_bancario: "BANCO DO BRASIL SA" }),
    linha(1562, 56, "2026-06-02", "Débito", "Tarifas Serviços Diversos", -12.5),
    linha(1563, 57, "2026-06-02", "Crédito", "Sem data", 1, { dt_movimento_lancamento_extrato_bancario: null }),
  ], "captacao");
  assert.deepEqual(captacao.map(l => [l.data, l.natureza, l.valor, l.categoria]), [
    ["2024-12-27", "credito", 42000, "aporte"],
    ["2024-12-27", "debito", 119000, "aplicacao"],
    ["2026-05-11", "debito", 2832835.04, "transferencia"],
    ["2026-05-11", "credito", 2832835.04, "resgate"],
    ["2026-06-02", "debito", 12.5, "tarifa"],
  ], "pela data e pelo número do lançamento; linha sem data fica de fora");
  assert.equal(captacao[0].historico, "TED Transferência Eletr.Disp · INDUSTRIA EXEMPLO LTDA · 60.995.891/0001-95");
  assert.deepEqual([captacao[0].chave, captacao[0].idExterno, captacao[0].documento], ["transferegov:1550", "1550", null]);

  const movimento = lerExtratoDoTransferegov([
    linha(2001, 1, "2026-05-11", "Crédito", "Movimento do Dia", 2832835.04),
    linha(2006, 6, "2026-07-03", "Débito", "Transferência enviada", -10000, { nu_identificacao_beneficiario: "53096781000126.0", tx_nome_beneficiario: "53.096.781 FULANA DE TAL" }),
    linha(2007, 7, "2026-07-04", "Débito", "Câmbio", -2632000),
    linha(2008, 8, "2026-07-05", "Débito", "Impostos", -300),
    linha(2009, 9, "2026-07-06", "Débito", "Transferido para Poupança", -500),
    linha(2010, 10, "2026-07-07", "Crédito", "TED Devolvida", 10000),
  ], "movimento");
  assert.deepEqual(movimento.map(l => l.categoria), ["transferencia", "pagamento", "pagamento", "pagamento", "aplicacao", "estorno"]);
  assert.equal(movimento[1].historico, "Transferência enviada · FULANA DE TAL · 53.096.781/0001-26");
});

test("a importação: o que já veio do Transferegov e o que já está no extrato do banco ficam de fora", () => {
  const daApi = lerExtratoDoTransferegov([
    linha(1, 1, "2026-07-03", "Débito", "Transferência enviada", -10000),
    linha(2, 2, "2026-07-03", "Débito", "Transferência enviada", -10000),
    linha(3, 3, "2026-07-04", "Débito", "Câmbio", -550),
    linha(4, 4, "2026-07-05", "Crédito", "Resgate Automático", 550),
  ], "movimento");
  const s = separarLancamentosNovos(daApi, [
    { chave: "transferegov:4", data: "2026-07-05", natureza: "credito", valor: 550 },
    // Um débito igual veio no OFX: um dos dois da API é ele; o outro é novo.
    { chave: "fitid:abc", data: "2026-07-03", natureza: "debito", valor: 10000 },
  ]);
  assert.deepEqual([s.novos.map(l => l.chave), s.jaImportados, s.equivalentes], [["transferegov:2", "transferegov:3"], 1, 1]);

  const contas = [{ id: "c1", conta: "58406-1" }, { id: "c2", conta: "0623334" }];
  assert.equal(contaCorrespondente({ numero: "584061" }, contas)?.id, "c1", "com o dígito separado");
  assert.equal(contaCorrespondente({ numero: "623334" }, contas)?.id, "c2", "com zero à esquerda");
  assert.equal(contaCorrespondente({ numero: "999" }, contas), null);

  const conta = lerConta(CONTA_MOVIMENTO);
  assert.deepEqual(resumoDaImportacao(conta, [{ data: "2026-05-11" }, { data: "2026-05-30" }]), { periodo_inicio: "2026-05-11", periodo_fim: "2026-06-03", saldo_final: 216633.95 });
  assert.deepEqual(resumoDaImportacao(conta, [{ data: "2026-05-11" }, { data: "2026-07-28" }]), { periodo_inicio: "2026-05-11", periodo_fim: "2026-07-28", saldo_final: null },
    "o saldo da API é de antes da última linha: não vale como saldo final");
});

test("a comparação com a prestação: datas, contas que faltam e captação", () => {
  const resposta = { parceria: lerParceria(PARCERIA), contas: [{ ...lerConta(CONTA_CAPTACAO), lancamentos: [] }, { ...lerConta(CONTA_MOVIMENTO), lancamentos: [] }] };
  const c = compararComTransferegov(resposta, { data_termo: "2026-04-10", data_inicio_execucao: "2025-03-01", data_fim_captacao: null }, { aportes: 1_000_000, contas: [{ conta: "584061" }] });
  assert.deepEqual(c.datas, [
    { campo: "data_inicio_execucao", rotulo: "Início da execução (autorização do MS)", naPrestacao: "2025-03-01", noTransferegov: "2026-05-13" },
    { campo: "data_fim_captacao", rotulo: "Fim da captação", naPrestacao: null, noTransferegov: "2025-11-30" },
  ]);
  assert.deepEqual(c.contasQueFaltam, [{ id: 261, nome: "Conta Movimentação", numero: "623334" }]);
  assert.deepEqual([c.ingressos.aprovado, c.aportesNoExtrato], [51_383, 1_000_000]);
});

test("o prazo do saldo no encerramento sai do regime: GRU em 30 dias na saúde, transferência em 60 na LIE", () => {
  const saude = prazoDoSaldo(SAUDE, { data_fim_execucao: "2027-06-30" })!;
  assert.deepEqual([saude.data, saude.chave, saude.rotulo], ["2027-07-30", "devolucaoSaldo", "Devolução do saldo (GRU)"]);
  assert.equal(saude.regra.fonte.dispositivo, "art. 71");
  const lie = prazoDoSaldo(LIE, { data_fim_execucao: "2026-10-31" })!;
  assert.deepEqual([lie.data, lie.rotulo], ["2026-12-30", "Transferência do saldo"]);
  assert.equal(prazoDoSaldo(ROUANET, { data_fim_execucao: "2026-10-31" }), null, "a Rouanet não tem prazo próprio do saldo");
  assert.equal(prazoDoSaldo(SAUDE, {}), null, "sem o fim da execução, sem prazo");

  const guiaPaga = { motivo: "saldo" as const, situacao: "paga" as const, valor_principal: 100, valor_atualizado: null, valor_pago: 100, pago_em: "2027-07-10", storage_path: "x.pdf" };
  assert.deepEqual(prazoDoSaldoEmAberto(SAUDE, { data_fim_execucao: "2027-06-30" }, []), { data: "2027-07-30", rotulo: "Devolução do saldo (GRU)" });
  assert.equal(prazoDoSaldoEmAberto(SAUDE, { data_fim_execucao: "2027-06-30" }, [guiaPaga]), null, "com a guia paga, o prazo sai");
  const prazos = prazosDaPrestacao({ status: "rascunho", prazo: "2027-10-28", prazo_saldo: { data: "2027-07-30", rotulo: "Devolução do saldo (GRU)" } }, SAUDE, [], "2027-07-01");
  assert.deepEqual(prazos.map(p => [p.rotulo, p.data, p.dias]), [["Devolução do saldo (GRU)", "2027-07-30", 29], ["Envio da prestação", "2027-10-28", 119]]);
  assert.equal(prazosDaPrestacao({ status: "enviado", prazo: null, prazo_saldo: { data: "2027-07-30", rotulo: "x" } }, SAUDE, [], "2027-07-01").length, 0, "enviada, o prazo do saldo não aparece mais");
});

const estado = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: SAUDE, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  contas: [{ id: "cap", tipo: "captacao" }, { id: "mov", tipo: "movimento" }],
  prestacao: { data_fim_execucao: "2027-06-30" },
  hoje: new Date("2027-07-10T12:00:00Z"),
  ...campos,
});

test("o saldo do encerramento: depois do fim da execução, sem guia paga e sem a conta zerada", () => {
  assert.deepEqual(checarEncerramento(estado({ hoje: new Date("2027-06-30T12:00:00Z") })), [], "no último dia da execução ainda não");
  assert.deepEqual(checarEncerramento(estado({ regime: ROUANET })), []);

  const [semNada] = checarEncerramento(estado());
  assert.deepEqual([semNada.codigo, semNada.severidade, semNada.chave], ["SALDO_DO_ENCERRAMENTO", "alerta", "SALDO_DO_ENCERRAMENTO:prestacao:-:saldo"]);
  assert.equal(semNada.mensagem, "Devolução do saldo (GRU) até 30/07/2027 (30 dias corridos após o fim da execução): registre a guia em Devoluções, ou importe o extrato que mostra a conta zerada. Devolver saldo e rendimentos ao término, sob pena de TCE imediata (improrrogável).");
  assert.equal(semNada.fonte?.dispositivo, "art. 71");

  const [comSaldo] = checarEncerramento(estado({ saldos: [{ conta_id: "mov", saldo: 216633.95, data: "2027-07-05" }] }));
  assert.match(comSaldo.mensagem.replace(/ /g, " "), /: a conta do projeto tinha R\$ 216\.633,95 no último extrato, de 05\/07\/2027\./);

  const aPagar = { motivo: "saldo" as const, situacao: "a_pagar" as const, valor_principal: 216633.95, valor_atualizado: null, valor_pago: null, pago_em: null, storage_path: null };
  const [comGuia] = checarEncerramento(estado({ devolucoes: [aPagar], hoje: new Date("2027-08-02T12:00:00Z") }));
  assert.match(comGuia.mensagem.replace(/ /g, " "), /^O prazo do saldo venceu em 30\/07\/2027 \(30 dias corridos após o fim da execução\): 1 guia do saldo está a pagar, R\$ 216\.633,95\./);

  assert.deepEqual(checarEncerramento(estado({ devolucoes: [{ ...aPagar, situacao: "paga", valor_pago: 216633.95, pago_em: "2027-07-08" }] })), [], "guia paga");
  assert.deepEqual(checarEncerramento(estado({ saldos: [{ conta_id: "mov", saldo: 0, data: "2027-07-02" }] })), [], "conta zerada depois do fim");
  assert.equal(checarEncerramento(estado({ saldos: [{ conta_id: "mov", saldo: 0, data: "2027-06-01" }] })).length, 1, "o saldo zerado de antes do fim não vale");
});
