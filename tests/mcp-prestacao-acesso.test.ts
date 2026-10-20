import assert from "node:assert/strict";
import test from "node:test";
import {
  decidirAcesso,
  requireModulo,
  resolveOrgId,
  SEM_ACESSO_A_PRESTACAO,
  SEM_ACESSO_AO_CONECTOR,
  type McpAuthContext,
} from "../lib/mcp/auth";
import { ehModuloMcp, MODULO_PADRAO, modulosDoEscopo, normalizarModulosDaChave } from "../lib/mcp/modulos";
import { acessoDaPrestacao, podeEditarNaPrestacao, type MembroDaPrestacao, type ModulosDaOrganizacao } from "../lib/mcp/prestacao/acesso";
import { instrucoesDosModulos, INSTRUCOES } from "../lib/mcp/protocolo";
import { INSTRUCOES_PRESTACAO } from "../lib/mcp/prestacao/instrucoes";

const ORG_A = "5c1b0f0e-0000-4000-8000-0000000000a1";
const ORG_B = "5c1b0f0e-0000-4000-8000-0000000000b2";
const ORG_C = "5c1b0f0e-0000-4000-8000-0000000000c3";

const membro = (organization_id: string, papel: string | null, modulos_acesso: string[] | null, prestacao_funcao: string | null = null): MembroDaPrestacao => ({
  organization_id,
  papel,
  modulos_acesso,
  prestacao_funcao,
});

const organizacao = (id: string, modulos_ativos: string[] | null, modulos_leitura: string[] | null = null, nome = `Org ${id.slice(-2)}`): ModulosDaOrganizacao => ({
  id,
  nome,
  modulos_ativos,
  modulos_leitura,
});

test("quem é da equipe, com o módulo no vínculo e a organização com o módulo em vigor, usa a prestação", () => {
  const acesso = acessoDaPrestacao([membro(ORG_A, "admin", ["captacao", "prestacao"], "revisor")], [organizacao(ORG_A, ["prestacao"])]);
  assert.deepEqual(acesso.organizationIds, [ORG_A]);
  assert.deepEqual(acesso.emVigorIds, [ORG_A]);
  assert.deepEqual(acesso.porOrganizacao[ORG_A], { organizationId: ORG_A, nome: "Org a1", papel: "admin", funcao: "revisor", emVigor: true });
});

test("módulo só para consulta entra como consulta: acesso existe, mas a organização não está em vigor", () => {
  const acesso = acessoDaPrestacao([membro(ORG_A, "colaborador", ["prestacao"])], [organizacao(ORG_A, [], ["prestacao"])]);
  assert.deepEqual(acesso.organizationIds, [ORG_A]);
  assert.deepEqual(acesso.emVigorIds, []);
  assert.equal(acesso.porOrganizacao[ORG_A].emVigor, false);
});

test("sem o módulo no vínculo a pessoa não entra, nem quando o vínculo não restringe módulos (diferente da captação)", () => {
  const organizacoes = [organizacao(ORG_A, ["prestacao"]), organizacao(ORG_B, ["prestacao"])];
  const acesso = acessoDaPrestacao([membro(ORG_A, "admin", null), membro(ORG_B, "admin", ["captacao"])], organizacoes);
  assert.deepEqual(acesso.organizationIds, []);
});

test("papéis externos ficam de fora; leitor, colaborador e o nome antigo visualizador entram", () => {
  const organizacoes = [ORG_A, ORG_B, ORG_C].map((id) => organizacao(id, ["prestacao"]));
  for (const papel of ["captador", "proponente", "convidado", "", null]) {
    assert.deepEqual(acessoDaPrestacao([membro(ORG_A, papel, ["prestacao"])], organizacoes).organizationIds, [], String(papel));
  }
  for (const papel of ["admin", "colaborador", "visualizador", "leitor"]) {
    assert.deepEqual(acessoDaPrestacao([membro(ORG_A, papel, ["prestacao"])], organizacoes).organizationIds, [ORG_A], papel);
  }
});

test("organização sem o módulo, ou que a consulta não devolveu, não conta", () => {
  const acesso = acessoDaPrestacao(
    [membro(ORG_A, "admin", ["prestacao"]), membro(ORG_B, "admin", ["prestacao"]), membro(ORG_C, "admin", ["prestacao"])],
    [organizacao(ORG_A, ["captacao"]), organizacao(ORG_B, null, null)]
  );
  assert.deepEqual(acesso.organizationIds, []);
});

test("várias organizações: cada uma com o próprio papel, e o mesmo vínculo repetido conta uma vez", () => {
  const acesso = acessoDaPrestacao(
    [membro(ORG_A, "admin", ["prestacao"]), membro(ORG_B, "leitor", ["prestacao"]), membro(ORG_A, "leitor", ["prestacao"])],
    [organizacao(ORG_A, ["prestacao"]), organizacao(ORG_B, ["prestacao"])]
  );
  assert.deepEqual(acesso.organizationIds, [ORG_A, ORG_B]);
  assert.equal(acesso.porOrganizacao[ORG_A].papel, "admin");
  assert.equal(acesso.porOrganizacao[ORG_B].papel, "leitor");
});

test("grava quem é admin, colaborador ou visualizador; leitor só consulta", () => {
  assert.equal(podeEditarNaPrestacao("admin"), true);
  assert.equal(podeEditarNaPrestacao("colaborador"), true);
  assert.equal(podeEditarNaPrestacao("visualizador"), true);
  assert.equal(podeEditarNaPrestacao("leitor"), false);
  assert.equal(podeEditarNaPrestacao("proponente"), false);
});

test("a chave de antes dos módulos vale só a captação, e valores estranhos não abrem módulo nenhum", () => {
  assert.deepEqual(normalizarModulosDaChave(undefined), ["captacao"]);
  assert.deepEqual(normalizarModulosDaChave(null), ["captacao"]);
  assert.deepEqual(normalizarModulosDaChave([]), ["captacao"]);
  assert.deepEqual(normalizarModulosDaChave(["financeiro"]), ["captacao"]);
  assert.deepEqual(normalizarModulosDaChave("prestacao"), ["captacao"]);
  assert.deepEqual(normalizarModulosDaChave(["prestacao"]), ["prestacao"]);
  assert.deepEqual(normalizarModulosDaChave(["prestacao", "captacao", "x"]), ["captacao", "prestacao"]);
  assert.equal(MODULO_PADRAO, "captacao");
  assert.ok(ehModuloMcp("prestacao") && !ehModuloMcp("financeiro") && !ehModuloMcp(null));
});

test("o scope do ChatGPT carrega o módulo; sem módulo no texto vale a captação, como nas Actions antigas", () => {
  assert.deepEqual(modulosDoEscopo("read"), ["captacao"]);
  assert.deepEqual(modulosDoEscopo("write"), ["captacao"]);
  assert.deepEqual(modulosDoEscopo("write prestacao"), ["prestacao"]);
  assert.deepEqual(modulosDoEscopo("read,prestacao captacao"), ["captacao", "prestacao"]);
  assert.deepEqual(modulosDoEscopo(null), ["captacao"]);
  assert.deepEqual(modulosDoEscopo(undefined), ["captacao"]);
});

const semPrestacao = acessoDaPrestacao([], []);

test("chave só da captação decide exatamente como antes dos módulos", () => {
  const entrada = (captacao: { organizationIds: string[]; paidOrganizationIds: string[] }, quantidadeDeVinculos: number) => ({
    modulosDaChave: ["captacao" as const],
    quantidadeDeVinculos,
    captacao,
    prestacao: null,
  });

  const ok = decidirAcesso(entrada({ organizationIds: [ORG_A, ORG_B], paidOrganizationIds: [ORG_A] }, 2));
  assert.ok(ok.ok);
  assert.deepEqual(ok.contexto.organizationIds, [ORG_A, ORG_B]);
  assert.deepEqual(ok.contexto.paidOrganizationIds, [ORG_A]);
  assert.deepEqual(ok.contexto.modulos, ["captacao"]);
  assert.equal("prestacao" in ok.contexto, false);

  const semPlano = decidirAcesso(entrada({ organizationIds: [ORG_A], paidOrganizationIds: [] }, 1));
  assert.ok(!semPlano.ok);
  assert.equal(semPlano.status, 402);
  assert.equal(semPlano.corpo.upgrade_url, "/meu-plano?acao=assinar");

  const semAcesso = decidirAcesso(entrada({ organizationIds: [], paidOrganizationIds: [] }, 3));
  assert.ok(!semAcesso.ok);
  assert.equal(semAcesso.status, 403);
  assert.equal(semAcesso.corpo.error, SEM_ACESSO_AO_CONECTOR);

  const semVinculo = decidirAcesso(entrada({ organizationIds: [], paidOrganizationIds: [] }, 0));
  assert.ok(!semVinculo.ok);
  assert.equal(semVinculo.status, 402);
});

test("chave da prestação não depende do plano da captação", () => {
  const prestacao = acessoDaPrestacao([membro(ORG_A, "admin", ["prestacao"])], [organizacao(ORG_A, ["prestacao"])]);
  const decisao = decidirAcesso({ modulosDaChave: ["prestacao"], quantidadeDeVinculos: 1, captacao: { organizationIds: [], paidOrganizationIds: [] }, prestacao });
  assert.ok(decisao.ok);
  assert.deepEqual(decisao.contexto.modulos, ["prestacao"]);
  assert.deepEqual(decisao.contexto.organizationIds, []);
  assert.equal(decisao.contexto.prestacao, prestacao);

  const sem = decidirAcesso({ modulosDaChave: ["prestacao"], quantidadeDeVinculos: 2, captacao: { organizationIds: [], paidOrganizationIds: [] }, prestacao: semPrestacao });
  assert.ok(!sem.ok);
  assert.equal(sem.status, 403);
  assert.equal(sem.corpo.error, SEM_ACESSO_A_PRESTACAO);
});

test("chave com os dois módulos fica com o que a pessoa realmente pode usar agora", () => {
  const prestacao = acessoDaPrestacao([membro(ORG_A, "admin", ["captacao", "prestacao"])], [organizacao(ORG_A, ["prestacao"])]);

  const soPrestacao = decidirAcesso({
    modulosDaChave: ["captacao", "prestacao"],
    quantidadeDeVinculos: 1,
    captacao: { organizationIds: [ORG_A], paidOrganizationIds: [] },
    prestacao,
  });
  assert.ok(soPrestacao.ok);
  assert.deepEqual(soPrestacao.contexto.modulos, ["prestacao"], "captação sem plano pago não entra");

  const soCaptacao = decidirAcesso({
    modulosDaChave: ["captacao", "prestacao"],
    quantidadeDeVinculos: 1,
    captacao: { organizationIds: [ORG_A], paidOrganizationIds: [ORG_A] },
    prestacao: semPrestacao,
  });
  assert.ok(soCaptacao.ok);
  assert.deepEqual(soCaptacao.contexto.modulos, ["captacao"], "prestação sem acesso não entra");

  const ambos = decidirAcesso({
    modulosDaChave: ["captacao", "prestacao"],
    quantidadeDeVinculos: 1,
    captacao: { organizationIds: [ORG_A], paidOrganizationIds: [ORG_A] },
    prestacao,
  });
  assert.ok(ambos.ok);
  assert.deepEqual(ambos.contexto.modulos, ["captacao", "prestacao"]);

  const nenhum = decidirAcesso({
    modulosDaChave: ["captacao", "prestacao"],
    quantidadeDeVinculos: 1,
    captacao: { organizationIds: [ORG_A], paidOrganizationIds: [] },
    prestacao: semPrestacao,
  });
  assert.ok(!nenhum.ok);
  assert.equal(nenhum.status, 402, "tem organização na captação, só falta o plano");
});

const contexto = (extra: Partial<McpAuthContext> = {}): McpAuthContext => ({
  userId: "u1",
  organizationIds: [ORG_A],
  paidOrganizationIds: [ORG_A],
  scope: "write",
  ...extra,
});

async function recusa(resultado: string | Response) {
  assert.ok(typeof resultado !== "string", "deveria ter recusado");
  return { status: resultado.status, corpo: (await resultado.json()) as Record<string, unknown> };
}

test("a rota de um módulo recusa a chave que não o autorizou, e a sem módulo declarado é a da captação", async () => {
  assert.equal(requireModulo(contexto(), "captacao"), null);
  const semPrestacaoNaChave = await recusa(requireModulo(contexto(), "prestacao") as Response);
  assert.equal(semPrestacaoNaChave.status, 403);
  assert.match(String(semPrestacaoNaChave.corpo.error), /prestação de contas/);

  assert.equal(requireModulo(contexto({ modulos: ["prestacao"] }), "prestacao"), null);
  const semCaptacaoNaChave = await recusa(requireModulo(contexto({ modulos: ["prestacao"] }), "captacao") as Response);
  assert.equal(semCaptacaoNaChave.status, 403);
  assert.match(String(semCaptacaoNaChave.corpo.error), /captação/);
});

function contextoDaPrestacao(membros: MembroDaPrestacao[], organizacoes: ModulosDaOrganizacao[]) {
  return contexto({ organizationIds: [], paidOrganizationIds: [], modulos: ["prestacao"], prestacao: acessoDaPrestacao(membros, organizacoes) });
}

test("organização da prestação: a única é escolhida, a de outro é recusada e várias exigem a escolha", async () => {
  const uma = contextoDaPrestacao([membro(ORG_A, "admin", ["prestacao"])], [organizacao(ORG_A, ["prestacao"])]);
  assert.equal(resolveOrgId(uma, null, "prestacao"), ORG_A);
  assert.equal(resolveOrgId(uma, ORG_A, "prestacao"), ORG_A);
  const outra = await recusa(resolveOrgId(uma, ORG_B, "prestacao") as Response);
  assert.equal(outra.status, 403);

  const duas = contextoDaPrestacao(
    [membro(ORG_A, "admin", ["prestacao"]), membro(ORG_B, "colaborador", ["prestacao"])],
    [organizacao(ORG_A, ["prestacao"]), organizacao(ORG_B, ["prestacao"])]
  );
  const escolha = await recusa(resolveOrgId(duas, null, "prestacao") as Response);
  assert.equal(escolha.status, 400);
  assert.equal((escolha.corpo.organizacoes as unknown[]).length, 2);
  assert.equal(resolveOrgId(duas, ORG_B, "prestacao"), ORG_B);

  const nenhuma = await recusa(resolveOrgId(contextoDaPrestacao([], []), null, "prestacao") as Response);
  assert.equal(nenhuma.status, 403);
  assert.equal(nenhuma.corpo.error, SEM_ACESSO_A_PRESTACAO);
});

test("gravar na prestação exige o módulo em vigor e um papel que edita; consultar não", async () => {
  const consulta = contextoDaPrestacao([membro(ORG_A, "admin", ["prestacao"])], [organizacao(ORG_A, [], ["prestacao"])]);
  assert.equal(resolveOrgId(consulta, null, "prestacao", { escrita: false }), ORG_A);
  const semVigor = await recusa(resolveOrgId(consulta, null, "prestacao", { escrita: true }) as Response);
  assert.equal(semVigor.status, 402);
  assert.equal(semVigor.corpo.upgrade_url, "/meu-plano?acao=assinar");

  const leitor = contextoDaPrestacao([membro(ORG_A, "leitor", ["prestacao"])], [organizacao(ORG_A, ["prestacao"])]);
  assert.equal(resolveOrgId(leitor, null, "prestacao", { escrita: false }), ORG_A);
  const soConsulta = await recusa(resolveOrgId(leitor, null, "prestacao", { escrita: true }) as Response);
  assert.equal(soConsulta.status, 403);

  for (const papel of ["admin", "colaborador", "visualizador"]) {
    const edita = contextoDaPrestacao([membro(ORG_A, papel, ["prestacao"])], [organizacao(ORG_A, ["prestacao"])]);
    assert.equal(resolveOrgId(edita, null, "prestacao", { escrita: true }), ORG_A, papel);
  }
});

test("a captação segue resolvendo a organização como antes", async () => {
  const ctx = contexto({ organizationIds: [ORG_A, ORG_B], paidOrganizationIds: [ORG_A] });
  assert.equal(resolveOrgId(ctx, null), ORG_A);
  assert.equal(resolveOrgId(ctx, ORG_A), ORG_A);
  assert.equal((await recusa(resolveOrgId(ctx, ORG_B) as Response)).status, 402);
  assert.equal((await recusa(resolveOrgId(ctx, ORG_C) as Response)).status, 403);
  assert.equal((await recusa(resolveOrgId(contexto({ organizationIds: [ORG_A, ORG_B], paidOrganizationIds: [ORG_A, ORG_B] }), null) as Response)).status, 400);
});

test("as instruções seguem os módulos: a captação sozinha é o texto de sempre", () => {
  assert.equal(instrucoesDosModulos(["captacao"]), INSTRUCOES);
  assert.equal(instrucoesDosModulos([]), INSTRUCOES);
  assert.equal(instrucoesDosModulos(["prestacao"]), INSTRUCOES_PRESTACAO);
  const juntas = instrucoesDosModulos(["captacao", "prestacao"]);
  assert.ok(juntas.includes(INSTRUCOES) && juntas.includes(INSTRUCOES_PRESTACAO));
  assert.ok(!INSTRUCOES_PRESTACAO.includes("negociações"), "a prestação não herda o texto do CRM");
});
