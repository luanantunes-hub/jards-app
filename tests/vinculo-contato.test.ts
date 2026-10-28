import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConcluirAtividadeModal } from "../components/modals/ConcluirAtividadeModal";
import { podeRegistrarContato } from "../lib/vinculo-contato";

const ler = (caminho: string) => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("negociação, empresa, proponente ou conta bastam para registrar o contato", () => {
  assert.equal(podeRegistrarContato({ captacao_id: "n1" }), true);
  assert.equal(podeRegistrarContato({ captacao_id: null, empresa_crm_id: "e1" }), true);
  assert.equal(podeRegistrarContato({ proponente_id: "p1" }), true);
  assert.equal(podeRegistrarContato({ conta_patrocinio_id: "c1" }), true);
});

test("sem nenhum desses vínculos o contato não pode ser registrado", () => {
  assert.equal(podeRegistrarContato({}), false);
  assert.equal(podeRegistrarContato({ captacao_id: null, empresa_crm_id: null, proponente_id: null, conta_patrocinio_id: null }), false);
  // Campos de outros vínculos (inscrição, projeto, contrato) não entram na regra.
  assert.equal(podeRegistrarContato({ edital_user_id: "i1", projeto_id: "pr1", contrato_id: "k1" } as never), false);
});

test("o modal usa a regra para o aviso e para o botão, não só a negociação", () => {
  const modal = ler("components/modals/ConcluirAtividadeModal.tsx");
  assert.match(modal, /podeRegistrarContato\(atividade\)/);
  assert.match(modal, /disabled=\{!podeRegistrar\}/);
  assert.match(modal, /\{!podeRegistrar && /);
  // O aviso antigo olhava só a negociação.
  assert.doesNotMatch(modal, /!atividade\.captacao_id/);
  assert.doesNotMatch(modal, /Vincule a atividade a uma negociação/);
});

test("a página de atividades entrega ao modal os vínculos que a regra lê", () => {
  const pagina = ler("app/(dashboard)/atividades/page.tsx");
  const campos = pagina.match(/const SELECT_FIELDS = `([\s\S]*?)`;/)?.[1] ?? "";
  for (const campo of ["captacao_id", "empresa_crm_id", "proponente_id", "conta_patrocinio_id"]) {
    assert.match(campos, new RegExp(`\\b${campo}\\b`), `SELECT_FIELDS deve trazer ${campo}`);
  }
});

test("o banco aceita empresa, proponente ou conta como vínculo e guarda esses vínculos na interação", () => {
  const nome = readdirSync(new URL("../supabase/migrations/", import.meta.url)).find((n) => n.endsWith("_concluir_atividade_vinculo_empresa.sql"));
  assert.ok(nome, "migration concluir_atividade_vinculo_empresa não encontrada");
  const arquivo = ler(`supabase/migrations/${nome}`);
  assert.match(arquivo, /create or replace function public\.fn_concluir_atividade_com_interacao\(\s*p_atividade_id uuid,\s*p_registrar_interacao boolean default false,\s*p_canal text default null,\s*p_resultado text default null,\s*p_resumo text default null,\s*p_ocorreu_em timestamptz default now\(\),\s*p_direcao text default 'saida'\s*\)/);
  assert.match(arquivo, /num_nonnulls\(v_atividade\.captacao_id, v_atividade\.empresa_crm_id, v_atividade\.proponente_id, v_atividade\.conta_patrocinio_id\) = 0/);
  assert.match(arquivo, /insert into public\.crm_interacoes \(\s*organization_id, account_id, empresa_crm_id, proponente_id, contato_id, captacao_id,\s*conta_patrocinio_id, atividade_id,/);
  // A assinatura não muda: uma sobrecarga nova quebraria o RPC (PGRST203).
  assert.equal((arquivo.match(/create or replace function/g) ?? []).length, 1);
});

// O modal desenhado no servidor (sem clique), para conferir o que a pessoa vê em cada vínculo.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-falsa-so-para-o-teste";

type AtividadeDoModal = ComponentProps<typeof ConcluirAtividadeModal>["atividade"];
const atividade = (parcial: Partial<AtividadeDoModal>): AtividadeDoModal => ({ id: "a1", nome: "Ligar para o Itaú", tipo: "telefone", captacao_id: null, ...parcial });
const modal = (parcial: Partial<AtividadeDoModal>) =>
  renderToStaticMarkup(createElement(ConcluirAtividadeModal, { atividade: atividade(parcial), onClose() {}, onCompleted() {} }));
const botaoSim = (html: string) => /<button[^>]*>Sim, registrar interação<\/button>/.exec(html)?.[0] ?? "";
const desativado = (tag: string) => /\sdisabled(=|\s|>)/.test(tag);
const AVISO = "Vincule a atividade a uma empresa ou negociação para registrar o contato.";

test("ligada só à empresa: sem aviso, o botão Sim vale e o contato já abre para preencher", () => {
  const html = modal({ empresa_crm_id: "e1" });
  assert.doesNotMatch(html, /Vincule a atividade/);
  assert.ok(botaoSim(html), "o botão Sim aparece");
  assert.equal(desativado(botaoSim(html)), false);
  assert.match(html, /Resultado \*/);
});

test("ligada à negociação: sem aviso e o botão Sim vale", () => {
  const html = modal({ captacao_id: "n1" });
  assert.doesNotMatch(html, /Vincule a atividade/);
  assert.equal(desativado(botaoSim(html)), false);
});

test("ligada só ao proponente ou à conta de patrocínio: também registra o contato", () => {
  for (const vinculo of [{ proponente_id: "p1" }, { conta_patrocinio_id: "c1" }]) {
    const html = modal(vinculo);
    assert.doesNotMatch(html, /Vincule a atividade/);
    assert.equal(desativado(botaoSim(html)), false);
  }
});

test("sem empresa nem negociação: o aviso aparece e o botão Sim fica desativado", () => {
  const html = modal({});
  assert.ok(html.includes(AVISO), "o aviso pede empresa ou negociação");
  assert.equal(desativado(botaoSim(html)), true);
  assert.doesNotMatch(html, /Resultado \*/, "sem contato a registrar, o formulário do contato fica fechado");
});

test("tarefa ligada à empresa começa em 'Não', mas o Sim continua disponível", () => {
  const html = modal({ tipo: "tarefa", empresa_crm_id: "e1" });
  assert.doesNotMatch(html, /Vincule a atividade/);
  assert.equal(desativado(botaoSim(html)), false);
  assert.doesNotMatch(html, /Resultado \*/);
});
