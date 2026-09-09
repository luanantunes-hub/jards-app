import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { activationBudgetRatio, activationProgress } from "../lib/ativacao/metrics";

test("progresso da ativação considera somente grupos com dados", () => {
  assert.equal(activationProgress({
    tarefas_total: 4,
    tarefas_concluidas: 2,
    entregaveis_total: 2,
    entregaveis_aprovados: 2,
    acoes_total: 0,
    acoes_concluidas: 0,
  }), 75);
  assert.equal(activationProgress({
    tarefas_total: 0,
    tarefas_concluidas: 0,
    entregaveis_total: 0,
    entregaveis_aprovados: 0,
    acoes_total: 0,
    acoes_concluidas: 0,
  }), 0);
});

test("relação entre verba de ativação e direito não inventa base ausente", () => {
  assert.equal(activationBudgetRatio({ valor_direito_snapshot: 100_000, orcamento_planejado: 20_000 }), 0.2);
  assert.equal(activationBudgetRatio({ valor_direito_snapshot: null, orcamento_planejado: 20_000 }), null);
  assert.equal(activationBudgetRatio({ valor_direito_snapshot: 0, orcamento_planejado: 20_000 }), null);
});

test("migration de ativação protege relações e mantém as atividades canônicas", async () => {
  const source = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260831000001_planos_ativacao_patrocinio.sql"),
    "utf8",
  );
  assert.match(source, /create table if not exists public\.planos_ativacao/i);
  assert.match(source, /create table if not exists public\.ativacao_acao_atividades/i);
  assert.match(source, /atividade_id uuid not null references public\.atividades\(id\)/i);
  assert.match(source, /public\.auth_can_manage_activation\(organization_id\)/i);
  assert.match(source, /fn_validate_activation_commitment/i);
  assert.match(source, /Entregável inválido para este plano/);
  assert.match(source, /documento_id is not null or url_externa is not null/i);
});
