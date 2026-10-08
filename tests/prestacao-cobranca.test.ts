import assert from "node:assert/strict";
import test from "node:test";
import {
  dadosDoContrato,
  ehAssinaturaDoModulo,
  itensDoCheckout,
  parametrosDaCobranca,
  vagasExtrasValidas,
  type AssinaturaStripe,
} from "../supabase/functions/_shared/cobranca-modulo";
import { descricaoDaAssinatura, type AssinaturaDoModulo } from "../lib/modulos-contrato";
import { modulosDaOrganizacao } from "../lib/modulos";

const PRECOS = { modulo: "price_modulo", vaga: "price_vaga" };
const ORG = "8b0e7a52-1f7c-4a59-9a3d-2f6c1b0d4e11";
const USUARIO = "0c3a9f1e-5b2d-4c6e-8f7a-1d2e3f4a5b6c";

function assinatura(campos: Partial<AssinaturaStripe> = {}): AssinaturaStripe {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { organization_id: ORG, modulo: "prestacao", user_id: USUARIO },
    items: { data: [
      { id: "si_modulo", price: { id: "price_modulo" }, quantity: 1, current_period_end: 1_793_000_000 },
      { id: "si_vagas", price: { id: "price_vaga" }, quantity: 3, current_period_end: 1_793_000_000 },
    ] },
    ...campos,
  };
}

test("assinatura do módulo: reconhecida pela marca do checkout ou pelo preço", () => {
  assert.equal(ehAssinaturaDoModulo(assinatura(), PRECOS), true);
  assert.equal(ehAssinaturaDoModulo(assinatura({ metadata: {} }), PRECOS), true);
  const doPlano = assinatura({ metadata: { user_id: USUARIO }, items: { data: [{ id: "si", price: "price_pro", quantity: 1 }] } });
  assert.equal(ehAssinaturaDoModulo(doPlano, PRECOS), false);
  // Sem o preço configurado, só a marca do checkout identifica.
  assert.equal(ehAssinaturaDoModulo(assinatura({ metadata: {} }), { modulo: "", vaga: "" }), false);
});

test("assinatura do módulo vira os dados do contrato", () => {
  const lido = dadosDoContrato(assinatura(), PRECOS);
  assert.ok(lido.ok);
  assert.deepEqual(lido.dados, {
    organizationId: ORG,
    billingUserId: USUARIO,
    customerId: "cus_1",
    subscriptionId: "sub_1",
    itemModuloId: "si_modulo",
    itemVagasId: "si_vagas",
    vagas: 3,
    status: "active",
    periodoFim: new Date(1_793_000_000 * 1000).toISOString(),
  });
  // Versão antiga da API: o fim do período fica na assinatura; o cliente pode vir expandido.
  const antiga = dadosDoContrato(assinatura({ current_period_end: 1_790_000_000, customer: { id: "cus_2" }, items: { data: [{ id: "si_modulo", price: "price_modulo" }] } }), PRECOS);
  assert.ok(antiga.ok);
  assert.equal(antiga.dados.periodoFim, new Date(1_790_000_000 * 1000).toISOString());
  assert.equal(antiga.dados.customerId, "cus_2");
  assert.equal(antiga.dados.vagas, 0);
  assert.equal(antiga.dados.itemVagasId, null);

  assert.deepEqual(dadosDoContrato(assinatura({ metadata: { modulo: "prestacao" } }), PRECOS), { ok: false, erro: "Assinatura sub_1 sem a organização" });
  assert.equal(dadosDoContrato(assinatura(), { modulo: "price_modulo", vaga: "" }).ok, false);
  const semUsuario = dadosDoContrato(assinatura({ metadata: { organization_id: ORG, user_id: "x" } }), PRECOS);
  assert.ok(semUsuario.ok);
  assert.equal(semUsuario.dados.billingUserId, null);
});

test("parâmetros da função do banco e itens do checkout", () => {
  const lido = dadosDoContrato(assinatura({ status: "past_due" }), PRECOS);
  assert.ok(lido.ok);
  const p = parametrosDaCobranca({ id: "evt_1", type: "invoice.payment_failed" }, lido.dados);
  assert.equal(p.p_event_id, "evt_1");
  assert.equal(p.p_modulo, "prestacao");
  assert.equal(p.p_stripe_status, "past_due");
  assert.equal(p.p_vagas, 3);
  assert.deepEqual(itensDoCheckout(PRECOS, 0), [{ price: "price_modulo", quantity: 1 }]);
  assert.deepEqual(itensDoCheckout(PRECOS, 2), [{ price: "price_modulo", quantity: 1 }, { price: "price_vaga", quantity: 2 }]);
  assert.equal(vagasExtrasValidas(0), 0);
  assert.equal(vagasExtrasValidas("4"), 4);
  assert.equal(vagasExtrasValidas(-1), null);
  assert.equal(vagasExtrasValidas(1.5), null);
  assert.equal(vagasExtrasValidas(51), null);
});

const contrato = (campos: Partial<AssinaturaDoModulo>): AssinaturaDoModulo => ({
  status: "ativo", cortesia_ate: null, past_due_since: null, vagas_cortesia: 1, vagas_compradas: 0,
  periodo_fim: null, encerrado_em: null, stripe_subscription_id: "sub_1", ...campos,
});

test("situação da assinatura para a tela", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  assert.deepEqual(
    { ...descricaoDaAssinatura(null, agora) },
    { titulo: "Sem assinatura", detalhe: "Assine para usar a prestação de contas na organização.", tom: "neutro", paga: false, podeAssinar: true, somenteLeitura: false });
  const ativa = descricaoDaAssinatura(contrato({ periodo_fim: "2026-11-08T15:00:00Z" }), agora);
  assert.equal(ativa.detalhe, "Renova em 08/11/2026.");
  assert.equal(ativa.paga, true);
  assert.equal(ativa.podeAssinar, false);
  const atraso = descricaoDaAssinatura(contrato({ status: "atraso", past_due_since: "2026-10-01T15:00:00Z" }), agora);
  assert.equal(atraso.detalhe, "Regularize até 16/10/2026 para continuar editando.");
  assert.equal(atraso.somenteLeitura, false);
  const vencido = descricaoDaAssinatura(contrato({ status: "atraso", past_due_since: "2026-09-01T15:00:00Z" }), agora);
  assert.equal(vencido.somenteLeitura, true);
  assert.equal(vencido.podeAssinar, false);
  const cortesia = descricaoDaAssinatura(contrato({ status: "cortesia", cortesia_ate: "2026-12-31", stripe_subscription_id: null }), agora);
  assert.equal(cortesia.detalhe, "Liberada até 31/12/2026. Assine para continuar depois disso.");
  assert.equal(cortesia.podeAssinar, true);
  const cancelada = descricaoDaAssinatura(contrato({ status: "cancelado", encerrado_em: "2026-10-05T12:00:00Z" }), agora);
  assert.equal(cancelada.titulo, "Somente leitura");
  assert.equal(cancelada.somenteLeitura, true);
  assert.equal(cancelada.paga, false);
  assert.match(cancelada.detalhe, /^Sem assinatura desde 05\/10\/2026\./);
});

test("módulos da organização incluem os que ficaram só para leitura", () => {
  assert.deepEqual(modulosDaOrganizacao(["captacao"], ["prestacao"]), ["captacao", "prestacao"]);
  assert.deepEqual(modulosDaOrganizacao(["captacao", "prestacao"], []), ["captacao", "prestacao"]);
  assert.deepEqual(modulosDaOrganizacao(null, null), ["captacao"]);
  assert.deepEqual(modulosDaOrganizacao(["captacao"], ["outro"]), ["captacao"]);
});
