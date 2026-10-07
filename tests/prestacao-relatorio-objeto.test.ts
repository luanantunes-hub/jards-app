import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import {
  chaveDoComplemento,
  chaveDosNumeros,
  lerNumeros,
  modeloDoRegime,
  rascunhoDoRelatorio,
  textoDaSecao,
  type DadosDoRelatorio,
  type Paragrafo,
  type SecaoDoRelatorio,
} from "../lib/prestacao/relatorio-objeto";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { rotuloDaCategoria } from "../lib/prestacao/distribuicao";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const LIE = regimePorCodigo("lie_p10_2026")!;
const ANCINE = regimePorCodigo("ancine_in159_2021")!;

const estado = (campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [], ...campos,
});
const dados = (campos: Partial<DadosDoRelatorio> = {}): DadosDoRelatorio => ({
  regime: ROUANET, estado: estado(), prestacao: { titulo: "Festival (teste)", identificador_oficial: "269999", proponente: null }, guardados: {}, ...campos,
});
const texto = (p: Paragrafo) => p.map(x => (x.tipo === "lacuna" ? `[${x.texto}]` : x.texto)).join("");
const porId = (secoes: SecaoDoRelatorio[]) => Object.fromEntries(secoes.map(s => [s.id, s]));

type Evidencia = NonNullable<EstadoDaPrestacao["evidencias"]>[number];
const evidencia = (id: string, campos: Partial<Evidencia>): Evidencia =>
  ({ id, tipo: "foto", nome_arquivo: `${id}.jpg`, url: null, atividade_id: null, meta_id: null, local_id: null, capturada_em: null, latitude: null, longitude: null, justificativa: null, ...campos });

const CHEIO = estado({
  metas: [
    { id: "m1", descricao: "Oficinas", unidade: "oficinas", previsto: 6, realizado: 6, justificativa: null },
    { id: "m2", descricao: "Apresentações", unidade: "apresentações", previsto: 4, realizado: 3, justificativa: null },
  ],
  atividades: [
    { id: "a1", titulo: "Oficina 1", data_realizacao: "2026-08-10", data_inicio: null, data_fim: null, local_id: "l1", meta_id: "m1", status_realizacao: "realizado", acessibilidade_descricao: "Intérprete de Libras em todas as oficinas." },
    { id: "a2", titulo: "Oficina 2", data_realizacao: "2026-09-02", data_inicio: null, data_fim: null, local_id: "l1", meta_id: "m1", status_realizacao: "realizado" },
    { id: "a3", titulo: "Apresentação em Santos", data_realizacao: "2026-09-20", data_inicio: null, data_fim: null, local_id: null, meta_id: "m2", status_realizacao: "nao_realizado", justificativa_nao_realizacao: "Teatro interditado pela Defesa Civil." },
  ],
  evidencias: [
    evidencia("e1", { atividade_id: "a1", requisitos: ["alcance_objeto", "acessibilidade"], descricao: "Libras na oficina 1" }),
    evidencia("e2", { tipo: "lista_presenca", nome_arquivo: "lista.pdf", atividade_id: "a2", requisitos: ["democratizacao"] }),
  ],
  locais: [
    { id: "l1", pais: "Brasil", uf: "SP", municipio: "São Paulo", status: "realizado", inicio: "2026-08-10", fim: null, justificativa: null },
    { id: "l2", pais: "Brasil", uf: "SP", municipio: "Santos", status: "nao_realizado", inicio: null, fim: null, justificativa: "Teatro interditado." },
  ],
  distribuicao: [
    { id: "d1", produto: "Espetáculo", categoria: "social", quantidade: 100, quantidade_meia: 0, preco: null, quantidade_realizada: 120, beneficiario: "ONG Teatro Vivo", beneficiario_documento: "12.345.678/0001-95", justificativa: null },
    { id: "d2", produto: "Espetáculo", categoria: "gratuita", quantidade: 200, quantidade_meia: 0, preco: null, quantidade_realizada: 180, beneficiario: null, beneficiario_documento: null, justificativa: null },
    { id: "d3", produto: "Espetáculo", categoria: "popular", quantidade: 300, quantidade_meia: 100, preco: 40, quantidade_realizada: null, beneficiario: null, beneficiario_documento: null, justificativa: null },
  ],
  pecas: [{ id: "p1", tipo: "cartaz", titulo: "Cartaz", veiculacao_inicio: "2026-08-01", veiculacao_fim: null, marcas: [], aprovacao_status: "aprovada", aprovacao_enviada_em: "2026-07-20", aprovacao_decidida_em: "2026-07-25", storage_path: "org/p/pecas/c.png", url: null, justificativa: null }],
  nos: [{ id: "item-projetor", nome: "Projetor" } as NonNullable<EstadoDaPrestacao["nos"]>[number]],
  bens: [{ id: "b1", no_id: "item-projetor", despesa_id: null, tipo: "equipamento", descricao: "Projetor Epson", valor: 3000, registro_imovel: null, cotacoes: [], destinacao: "doacao", beneficiario: "Escola Municipal", beneficiario_documento: null, doacao_storage_path: "x.pdf", aceite_storage_path: null, justificativa: null, quantidade: 1 }],
  alteracoes: [
    { id: "alt1", numero: 1, status: "aprovada", solicitada_em: "2026-05-01", tipo: "remanejamento", justificativa: "Troca de fornecedor de luz.", decidida_em: "2026-05-10" },
    { id: "alt2", numero: 2, status: "rascunho", solicitada_em: null },
  ],
});

test("modelo pelo regime: Salic na Rouanet, RCO na LIE, genérico nos demais", () => {
  assert.deepEqual([modeloDoRegime(ROUANET), modeloDoRegime(LIE), modeloDoRegime(ANCINE), modeloDoRegime(null)], ["salic", "rco", "generico", "generico"]);
  assert.deepEqual(lerNumeros('{"diretos": 3, "indiretos": "x"}', ["diretos", "indiretos"]), { diretos: 3, indiretos: null });
  assert.deepEqual(lerNumeros("não é json", ["diretos"]), { diretos: null });
});

test("Salic vazio: as telas da Comprovação Física, com o que falta como lacuna", () => {
  const r = rascunhoDoRelatorio(dados());
  assert.equal(r.modelo, "salic");
  assert.deepEqual(r.secoes.map(s => s.id), ["etapas", "acessibilidade", "democratizacao", "empregos", "locais", "distribuicao", "execucao", "aceite_obra", "bens_doados"]);
  assert.deepEqual(r.secoes.map(s => s.lacunas), [2, 1, 1, 2, 1, 0, 1, 1, 0]);
  assert.equal(r.lacunas, 9);
  assert.equal(r.fonte?.dispositivo, "art. 69, I a III");
  const s = porId(r.secoes);
  assert.equal(textoDaSecao(s.etapas), "[Falta: cadastre as metas do objeto, com o previsto e o realizado]\n[Falta: resultados do projeto junto à sociedade]");
  assert.equal(textoDaSecao(s.empregos), "Diretos: [Falta: diretos] · Indiretos: [Falta: indiretos] · Total: —");
  assert.equal(texto(s.bens_doados.paragrafos[0]), "Nenhum bem doado.");
});

test("Salic com dados: cada número leva à fonte; diferença sem justificativa é lacuna", () => {
  const guardados = {
    [chaveDoComplemento("salic", "etapas")]: "As oficinas formaram 60 jovens.",
    [chaveDosNumeros("salic", "empregos")]: '{"diretos": 12, "indiretos": 30}',
  };
  const envio = {
    regime: ROUANET, estado: CHEIO, verificacoes: [], contas: [], marcacoes: [],
    arquivos: [{ id: "x", etapa: "final" as const, codigo: "aceitacao_obra", storage_path: "s", nome_arquivo: "termo-obra.pdf", mime_type: "application/pdf", tamanho_bytes: 10, created_at: "2026-10-01" }],
  };
  const r = rascunhoDoRelatorio(dados({ estado: CHEIO, guardados, envio }));
  const s = porId(r.secoes);

  assert.deepEqual(s.etapas.paragrafos.map(texto), [
    "Oficinas: previsto 6 oficinas, realizado 6 oficinas (100%).",
    "Apresentações: previsto 4 apresentações, realizado 3 apresentações (75%). [justifique a diferença entre o previsto e o realizado]",
    "Foram realizadas 2 atividades, de 10/08/2026 a 02/09/2026.",
    "Não realizada: Apresentação em Santos. Motivo: Teatro interditado pela Defesa Civil.",
  ]);
  const metaDois = s.etapas.paragrafos[1].find(x => x.tipo === "dado" && x.texto === "3 apresentações");
  assert.deepEqual(metaDois?.tipo === "dado" ? metaDois.fonte : null, { aba: "objeto", parametro: "meta", id: "m2" });
  assert.equal(s.etapas.lacunas, 1, "o complemento guardado conta");

  assert.deepEqual(s.acessibilidade.paragrafos.map(texto), ["Oficina 1: Intérprete de Libras em todas as oficinas.", "Comprovação: 1 evidência (Libras na oficina 1)."]);
  assert.deepEqual(s.acessibilidade.documentos.map(x => x.nome), ["e1.jpg"]);
  assert.equal(texto(s.democratizacao.paragrafos[0]), "Distribuição gratuita (social, educativa e ao público): 300 unidades. Preço popular: [quantidade vendida a preço popular].");

  assert.equal(textoDaSecao(s.empregos), "Diretos: 12 · Indiretos: 30 · Total: 42");
  assert.equal(s.empregos.lacunas, 0);

  assert.deepEqual(s.locais.tabela!.linhas.map(l => l.map(texto).join(" | ")), [
    "Brasil | SP | São Paulo | Realizado | 10/08/2026 | [fim] | ",
    "Brasil | SP | Santos | Não realizado |  |  | Teatro interditado.",
  ]);
  assert.deepEqual(s.distribuicao.tabela!.linhas.map(l => l.map(texto).join(" | ")), [
    `Espetáculo | ${rotuloDaCategoria("social")} | ONG Teatro Vivo | 12345678000195 | 120`,
    `Espetáculo | ${rotuloDaCategoria("gratuita")} | Público em geral |  | 180`,
  ]);
  assert.deepEqual(s.execucao.tabela!.linhas.map(l => l.map(texto).join(" | ")), [
    "Foto | e1.jpg | Libras na oficina 1",
    "Arquivo (lista de presença) | lista.pdf | [observação sobre a evidência]",
    "Arquivo (divulgação) | Cartaz | Peça de divulgação: Cartaz",
  ]);
  assert.equal(texto(s.aceite_obra.paragrafos[0]), "Sim. Termo de aceitação: termo-obra.pdf.");
  assert.deepEqual(s.bens_doados.tabela!.linhas[0].map(texto), ["Projetor", "Projetor Epson", "Escola Municipal", "[CPF ou CNPJ]", "1", "anexado", "[aceite de quem recebeu]"]);
  assert.match(textoDaSecao(s.locais), /^País: Brasil · UF: SP · Município: São Paulo · Situação: Realizado · Início: 10\/08\/2026 · Fim: \[Falta: fim\]/);
});

test("RCO da LIE: dados do projeto, metas com instrumentos, alterações e considerações sem inventar", () => {
  const lie = estado({ ...CHEIO, regime: LIE });
  const r = rascunhoDoRelatorio(dados({ regime: LIE, estado: lie, prestacao: { titulo: "Escolinha (teste)", identificador_oficial: null, proponente: { nome: "Instituto X", cnpj: "11.222.333/0001-81" } } }));
  assert.equal(r.modelo, "rco");
  assert.deepEqual(r.secoes.map(s => s.id), ["dados", "objeto", "resultados", "alteracoes", "locais", "metas", "documentos", "aplicacao", "consideracoes", "autenticacao"]);
  const s = porId(r.secoes);
  assert.deepEqual(s.dados.tabela!.linhas.map(l => l.map(texto).join(": ")), ["Processo nº: [número do processo]", "Projeto: Escolinha (teste)", "Proponente: Instituto X", "CNPJ: 11222333000181"]);
  assert.deepEqual(s.alteracoes.paragrafos.map(texto), ["Remanejamento nº 1, aprovada em 10/05/2026. Troca de fornecedor de luz."], "o rascunho não entra");
  assert.deepEqual(s.metas.tabela!.linhas.map(l => l.map(texto).join(" | ")), [
    "Oficinas | oficinas | 6 | 6 | 100% | 2 evidências (foto, lista de presença)",
    "Apresentações | apresentações | 4 | 3 | 75% | [instrumentos de verificação]",
  ]);
  assert.match(texto(s.consideracoes.paragrafos[0]), /^\[explique as metas não atingidas \(Apresentações\)/);
  assert.match(texto(s.documentos.paragrafos[0]), /veja os documentos no checklist/, "sem o checklist, lacuna");

  const todas = estado({ ...lie, metas: lie.metas!.map(m => ({ ...m, realizado: m.previsto })) });
  const pronto = porId(rascunhoDoRelatorio(dados({ regime: LIE, estado: todas })).secoes);
  assert.equal(texto(pronto.consideracoes.paragrafos[0]), "Ressalta-se que foi atingido o objeto pactuado e cumprido fielmente o Plano de Trabalho aprovado.");
});

test("genérico: as partes do relatório nos demais regimes", () => {
  const r = rascunhoDoRelatorio(dados({ regime: ANCINE, estado: estado({ ...CHEIO, regime: ANCINE }) }));
  assert.equal(r.modelo, "generico");
  assert.deepEqual(r.secoes.map(s => s.id), ["metas", "locais", "evidencias", "acessibilidade", "democratizacao", "distribuicao", "bens"]);
  assert.equal(r.fonte?.documento, ANCINE.envio && "documentos" in ANCINE.envio ? ANCINE.envio.documentos.find(d => d.codigo === "objeto")?.fonte.documento : undefined);
});
