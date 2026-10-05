import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("negociação reutiliza a adaptação comercial completa", async () => {
  const negociacao = await readFile(new URL("components/captacoes/PropostaDaNegociacao.tsx", root), "utf8");
  const panel = await readFile(new URL("components/PropostaValuePanel.tsx", root), "utf8");
  const modal = await readFile(new URL("components/projects/PropostaOperacionalModal.tsx", root), "utf8");

  for (const origem of [negociacao, panel]) {
    assert.match(origem, /PropostaOperacionalModal/);
    assert.doesNotMatch(origem, /NovaPropostaModal/);
  }
  assert.match(modal, />Título</);
  assert.match(modal, />Cota </);
  assert.match(modal, />Contrapartidas</);
  assert.match(modal, />Observações</);
});

test("aceite registra comprador e venda de forma atômica e idempotente", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/20260906000001_vendas_patrocinio_propostas.sql", root),
    "utf8",
  );
  const manager = await readFile(new URL("components/CotasProjetoManager.tsx", root), "utf8");

  assert.match(migration, /create table if not exists public\.vendas_patrocinio/i);
  assert.match(migration, /constraint vendas_patrocinio_proposta_unique unique \(proposta_id\)/i);
  assert.match(migration, /constraint vendas_patrocinio_captacao_unique unique \(captacao_id\)/i);
  assert.match(migration, /empresa_crm_id uuid references public\.empresas_crm/i);
  assert.match(migration, /empresa_id uuid references public\.empresas/i);
  assert.match(migration, /for update;/i);
  assert.match(migration, /set unidades_vendidas = v_novas_unidades/i);
  assert.match(migration, /set status = 'aprovado'/i);
  assert.doesNotMatch(manager, /handleSellOne/);
});
