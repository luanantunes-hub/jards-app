import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checklistDeEnvio, type DadosDoChecklist, type LinhaDoChecklist } from "../lib/prestacao/envio";
import { ABAS_A_MAO, formularioLie } from "../lib/prestacao/formulario-lie";
import { gravarFormularioLie } from "../lib/prestacao/formulario-lie-xlsx";
import {
  eventosDasAtividades,
  faltasDaTurma,
  gradePorNucleo,
  nomeDoNucleo,
  regimePedeGrade,
  rotuloDoHorario,
  rotuloDosDias,
  type AtividadeDoEvento,
  type NucleoDoLocal,
  type TurmaDaGrade,
} from "../lib/prestacao/grade";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { lerZip } from "../lib/zip";
import { PastaDeTrabalho } from "../lib/xlsx-modelo";

// P8.6: a grade semanal por núcleo (aba GRADE) e os eventos (aba EVENTOS) do
// formulário PCP/PCF da LIE, e os itens do checklist de envio.

const P10 = regimePorCodigo("lie_p10_2026")!;
const P424 = regimePorCodigo("lie_p424_2020")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const MODELO = new Uint8Array(readFileSync(new URL("../public/modelos/lie/formulario-pcp-pcf-2026.xlsx", import.meta.url)));

const local = (id: string, espaco: string, campos: Partial<NucleoDoLocal> = {}): NucleoDoLocal =>
  ({ id, pais: "Brasil", uf: "SP", municipio: "Campinas", status: "realizado", espaco, ...campos });

const turma = (id: string, local_id: string | null, nome: string, ordem = 0, campos: Partial<TurmaDaGrade> = {}): TurmaDaGrade =>
  ({ id, local_id, nome, modalidade: "Futebol", alunos: 20, dias: [1, 3, 5], hora_inicio: "08:00:00", hora_fim: "09:30:00", equipe: "1 professor", observacoes: null, ordem, ...campos });

const atividade = (id: string, titulo: string, data: string, campos: Partial<AtividadeDoEvento> = {}): AtividadeDoEvento =>
  ({ id, titulo, data_realizacao: data, data_inicio: null, data_fim: null, local_id: null, status_realizacao: "realizado", ...campos });

const LOCAIS = [
  local("l1", "Ginásio Central", { endereco: "Rua A, 10", responsavel: "Carla", telefone: "(19) 3333-0000" }),
  local("l2", "Quadra do Bairro", { endereco: "Av. B, 200" }),
  local("l3", "", { municipio: "Sumaré" }),
];

const TURMAS = [
  ...Array.from({ length: 9 }, (_, i) => turma(`t1${i}`, "l1", `Turma ${i + 1}`, i)),
  turma("t20", "l2", "Sub-13", 0, { modalidade: "Vôlei", dias: [4, 2], hora_inicio: "14:00:00", hora_fim: "15:00:00" }),
  turma("t30", "l3", "Adultos", 0, { alunos: null, dias: [], hora_inicio: null, hora_fim: null }),
];

const ATIVIDADES = [
  atividade("a1", "Festival de abertura", "2026-04-10", { data_inicio: "2026-04-10", data_fim: "2026-04-11", local_id: "l1", meta_prevista: 300 }),
  atividade("a2", "Torneio regional", "2026-03-20", { local: "Estádio Municipal", cidade: "Hortolândia", estado: "SP" }),
  atividade("a3", "Cancelado", "2026-05-01", { status_realizacao: "nao_realizado" }),
];

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: P10,
    despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [], nos: [], bens: [],
    prestacao: { data_termo: "2026-03-01", data_inicio_execucao: "2026-03-05", data_fim_execucao: "2026-10-31" },
    hoje: new Date("2026-08-01T12:00:00Z"),
    locais: LOCAIS,
    turmas: TURMAS,
    atividades: ATIVIDADES,
    ...campos,
  } as EstadoDaPrestacao;
}

test("dias, horário e nome do núcleo", () => {
  assert.equal(rotuloDosDias([5, 1, 3]), "Seg, Qua e Sex");
  assert.equal(rotuloDosDias([2, 4]), "Ter e Qui");
  assert.equal(rotuloDosDias([7]), "Dom");
  assert.equal(rotuloDosDias([]), "");
  assert.equal(rotuloDoHorario({ hora_inicio: "08:00:00", hora_fim: "09:30:00" }), "08:00 às 09:30");
  assert.equal(rotuloDoHorario({ hora_inicio: "08:00:00", hora_fim: null }), "a partir das 08:00");
  assert.equal(rotuloDoHorario({ hora_inicio: null, hora_fim: null }), "");
  assert.equal(nomeDoNucleo(LOCAIS[0]), "Ginásio Central");
  assert.equal(nomeDoNucleo(LOCAIS[2]), "Sumaré/SP", "sem espaço, a cidade e a UF");
  assert.equal(nomeDoNucleo({ espaco: " ", municipio: null, uf: null, pais: "Portugal" }), "Portugal");
});

test("grade por núcleo: na ordem dos locais, turmas pela ordem, as sem núcleo num bloco no fim", () => {
  const embaralhadas = [turma("x", null, "Avulsa"), turma("y", "l9", "De local apagado"), ...[...TURMAS].reverse()];
  const blocos = gradePorNucleo(embaralhadas, LOCAIS);
  assert.deepEqual(blocos.map(b => [b.nucleo, b.endereco, b.responsavel, b.telefone, b.turmas.length]), [
    ["Ginásio Central", "Rua A, 10, Campinas/SP", "Carla", "(19) 3333-0000", 9],
    ["Quadra do Bairro", "Av. B, 200, Campinas/SP", "", "", 1],
    ["Sumaré/SP", "Sumaré/SP", "", "", 1],
    ["", "", "", "", 2],
  ]);
  assert.deepEqual(blocos[0].turmas.slice(0, 3).map(t => t.nome), ["Turma 1", "Turma 2", "Turma 3"]);
  assert.equal(blocos[3].local, null);
  assert.deepEqual(blocos[3].turmas.map(t => t.nome), ["Avulsa", "De local apagado"]);
  // Núcleo sem turma não entra.
  assert.equal(gradePorNucleo([turma("z", "l2", "Única")], LOCAIS).length, 1);
});

test("o que falta numa turma", () => {
  assert.deepEqual(faltasDaTurma(TURMAS[0]), []);
  assert.deepEqual(faltasDaTurma(turma("f", null, "F", 0, { dias: [], hora_fim: null, alunos: null })), ["o núcleo", "os dias da semana", "o horário", "a quantidade de alunos"]);
  assert.deepEqual(faltasDaTurma(turma("g", "l1", "G", 0, { alunos: 0 })), [], "zero alunos é um número informado");
});

test("eventos das atividades: em ordem de data, sem as não realizadas, local do objeto ou da atividade", () => {
  assert.deepEqual(eventosDasAtividades(ATIVIDADES, LOCAIS), [
    { nome: "Torneio regional", de: "20/03/2026", ate: "20/03/2026", endereco: "Estádio Municipal", cidade: "Hortolândia/SP", pais: "Brasil", previstos: null },
    { nome: "Festival de abertura", de: "10/04/2026", ate: "11/04/2026", endereco: "Rua A, 10", cidade: "Campinas/SP", pais: "Brasil", previstos: 300 },
  ]);
  // Local do objeto sem endereço: o espaço.
  const [e] = eventosDasAtividades([atividade("b", "Copa", "2026-06-01", { local_id: "l2" })], [{ ...LOCAIS[1], endereco: null }]);
  assert.equal(e.endereco, "Quadra do Bairro");
});

test("a LIE pede a grade no envio (a P424 herda os modelos da P10); os outros regimes, não", () => {
  assert.equal(regimePedeGrade(P10), true);
  assert.equal(regimePedeGrade(P424), true);
  assert.equal(regimePedeGrade(ROUANET), false);
  assert.equal(regimePedeGrade(null), false);
});

test("formulário: blocos da GRADE, eventos e críticas", () => {
  assert.ok(!ABAS_A_MAO.includes("GRADE") && !ABAS_A_MAO.includes("EVENTOS"));
  const f = formularioLie({ estado: estado(), etapa: "parcial", prestacao: { titulo: "Futebol na Escola", sli: "2600123", proponente: "Associação" } });
  assert.deepEqual(f.grade.map(b => [b.nucleo, b.turmas.length]), [["Ginásio Central", 9], ["Quadra do Bairro", 1], ["Sumaré/SP", 1]]);
  assert.deepEqual(f.grade[1].turmas[0], { turma: "Sub-13", modalidade: "Vôlei", alunos: 20, dias: "Ter e Qui", de: "14:00", ate: "15:00", equipe: "1 professor", observacoes: "" });
  assert.deepEqual(f.eventos.map(e => e.nome), ["Torneio regional", "Festival de abertura"]);

  const textos = f.criticas.filter(c => c.aba === "GRADE" || c.aba === "EVENTOS").map(c => `${c.tipo}|${c.aba}|${c.campo}|${c.mensagem}|${c.destino?.tipo ?? ""}`);
  assert.deepEqual(textos, [
    "aviso|GRADE|Núcleo|Quadra do Bairro: faltam o responsável e o telefone do núcleo; preencha no local, na aba Objeto.|objeto",
    "aviso|GRADE|Núcleo|Sumaré/SP: faltam o endereço, o responsável e o telefone do núcleo; preencha no local, na aba Objeto.|objeto",
    "aviso|GRADE|Turma|Sumaré/SP, Adultos: faltam os dias da semana, o horário e a quantidade de alunos.|atividades",
    "aviso|EVENTOS|Eventos|Os eventos vêm da aba Atividades: tire do arquivo o que não é evento (as aulas regulares vão na GRADE).|atividades",
    "aviso|EVENTOS|Nº beneficiários previstos|1 evento está sem o público previsto (a meta prevista da atividade).|atividades",
  ]);
  assert.ok(f.criticas.some(c => c.campo === "Abas para preencher" && /^DIÁRIAS saem com o cabeçalho/.test(c.mensagem)));

  // Sem núcleo: corrigir. Sem turma e sem atividade: a aba sai com o cabeçalho.
  const semNucleo = formularioLie({ estado: estado({ turmas: [turma("s", null, "Avulsa")] }), etapa: "parcial", prestacao: { titulo: "", sli: "", proponente: "" } });
  assert.ok(semNucleo.criticas.some(c => c.tipo === "corrigir" && c.aba === "GRADE" && c.mensagem === "1 turma está sem núcleo e sai num bloco sem nome."));
  const vazio = formularioLie({ estado: estado({ turmas: [], atividades: [] }), etapa: "final", prestacao: { titulo: "", sli: "", proponente: "" } });
  assert.deepEqual(vazio.criticas.filter(c => c.aba === "GRADE" || c.aba === "EVENTOS").map(c => c.mensagem), [
    "Nenhuma turma na grade semanal: a aba sai com o cabeçalho.",
    "Nenhuma atividade realizada ou prevista: a aba sai com o cabeçalho.",
  ]);
});

test("grava a GRADE com um bloco por núcleo e linhas a mais, e os EVENTOS", async () => {
  const f = formularioLie({ estado: estado(), etapa: "parcial", prestacao: { titulo: "Futebol na Escola", sli: "2600123", proponente: "Associação" } });
  const bytes = await gravarFormularioLie(MODELO, f);
  const pasta = await PastaDeTrabalho.abrir(bytes);
  const g = pasta.planilha("GRADE");
  const linha = (r: number) => ["A", "B", "C", "D", "E", "F", "G", "H"].map(c => g.ler(`${c}${r}`) ?? null);

  // Bloco 1 (linhas 8 a 22): 9 turmas, 2 a mais que o modelo.
  assert.equal(g.ler("A8"), "NÚCLEO: Ginásio Central");
  assert.equal(g.ler("A9"), "ENDEREÇO: Rua A, 10, Campinas/SP");
  assert.equal(g.ler("A10"), "RESPONSÁVEL PELO PROJETO NO NÚCLEO : Carla");
  assert.equal(g.ler("A11"), "TELEFONE: (19) 3333-0000");
  assert.deepEqual(linha(14), ["Turma 1", "Futebol", 20, "Seg, Qua e Sex", "08:00", "09:30", "1 professor", null]);
  assert.equal(g.ler("A22"), "Turma 9");
  // Bloco 2 (23 a 35) e bloco 3, repetido do modelo (36 a 48).
  assert.equal(g.ler("A23"), "NÚCLEO: Quadra do Bairro");
  assert.equal(g.ler("A27"), "TURMA ");
  assert.deepEqual(linha(29), ["Sub-13", "Vôlei", 20, "Ter e Qui", "14:00", "15:00", "1 professor", null]);
  assert.equal(g.ler("A36"), "NÚCLEO: Sumaré/SP");
  assert.equal(g.ler("A40"), "TURMA ");
  assert.equal(g.ler("E41"), "DE");
  assert.deepEqual(linha(42), ["Adultos", "Futebol", null, null, null, null, "1 professor", null]);
  assert.equal(g.ler("A49"), null);

  const arquivos = await lerZip(bytes);
  const workbook = new TextDecoder().decode(arquivos.get("xl/workbook.xml"));
  assert.match(workbook, /GRADE!\$A\$1:\$H\$48<\/definedName>/, "a área de impressão cobre os 3 blocos");
  const folha = new TextDecoder().decode(arquivos.get("xl/worksheets/sheet6.xml"));
  for (const r of ["A12:A13", "E27:F27", "A40:A41", "E40:F40", "H40:H41"]) assert.ok(folha.includes(`<mergeCell ref="${r}"/>`), `faltou a mesclagem ${r}`);

  const ev = pasta.planilha("EVENTOS");
  assert.deepEqual(["A", "B", "C", "D", "E", "F", "G", "H"].map(c => ev.ler(`${c}11`)), [2, "Festival de abertura", "10/04/2026", "11/04/2026", "Rua A, 10", "Campinas/SP", "Brasil", 300]);
  assert.equal(ev.ler("B10"), "Torneio regional");
  assert.equal(ev.ler("H10"), null);
  assert.equal(ev.ler("B12"), null);
});

test("grava 20 eventos: o modelo tem 17 linhas", async () => {
  const muitas = Array.from({ length: 20 }, (_, i) => atividade(`e${i}`, `Evento ${i + 1}`, `2026-06-${String(i + 1).padStart(2, "0")}`, { meta_prevista: 10 }));
  const f = formularioLie({ estado: estado({ atividades: muitas, turmas: [] }), etapa: "parcial", prestacao: { titulo: "", sli: "", proponente: "" } });
  const ev = (await PastaDeTrabalho.abrir(await gravarFormularioLie(MODELO, f))).planilha("EVENTOS");
  assert.equal(ev.ler("B29"), "Evento 20");
  assert.equal(ev.ler("A29"), 20);
  // Sem turma, a GRADE fica como no modelo.
  const g = (await PastaDeTrabalho.abrir(await gravarFormularioLie(MODELO, f))).planilha("GRADE");
  assert.equal(g.ler("A8"), "NÚCLEO:");
  assert.equal(g.ler("A21"), "NÚCLEO:");
  assert.equal(g.ler("A34"), null);
});

const porCodigo = (linhas: readonly LinhaDoChecklist[]) => Object.fromEntries(linhas.map(l => [l.codigo, l]));
const checklist = (campos: Partial<EstadoDaPrestacao>) => {
  const dados: DadosDoChecklist = { regime: P10, etapa: "parcial", estado: estado(campos), verificacoes: [], contas: [], marcacoes: [], arquivos: [] };
  return porCodigo(checklistDeEnvio(dados).documentos);
};

test("envio: a grade e os eventos pelos dados", () => {
  const completo = checklist({ turmas: TURMAS.slice(0, 10) });
  assert.equal(completo.grade.situacao, "pronto");
  assert.equal(completo.grade.detalhe, "10 turmas em 2 núcleos, com dias e horário.");
  assert.equal(completo.eventos.situacao, "pronto");
  assert.equal(completo.eventos.detalhe, "2 eventos na aba Atividades.");

  const incompleto = checklist({});
  assert.equal(incompleto.grade.situacao, "pendente");
  assert.equal(incompleto.grade.detalhe, "1 turma está sem núcleo, dias, horário ou quantidade de alunos.");
  assert.equal(incompleto.grade.destino, "atividades");

  const vazio = checklist({ turmas: [], atividades: [atividade("n", "Cancelado", "2026-05-01", { status_realizacao: "nao_realizado" })] });
  assert.equal(vazio.grade.detalhe, "Cadastre a grade semanal: as turmas de cada núcleo, com dias e horário.");
  assert.equal(vazio.eventos.situacao, "pendente");
  assert.equal(vazio.eventos.detalhe, "Cadastre os eventos na aba Atividades, com as datas e o local.");
});
