import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adivinharMapaDeBeneficiados,
  beneficiadosDaTabela,
  colunasDeBeneficios,
  lerBeneficios,
  lerIdade,
  lerRede,
  lerSexo,
  resumoDosBeneficiados,
  type BeneficiadoParaChecar,
} from "../lib/prestacao/beneficiarios";
import { executarChecagens, type Achado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { ABAS_A_MAO, formularioLie } from "../lib/prestacao/formulario-lie";
import { gravarFormularioLie } from "../lib/prestacao/formulario-lie-xlsx";
import { lerTabela } from "../lib/prestacao/orcamento";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { PastaDeTrabalho } from "../lib/xlsx-modelo";

// P8.5: a relação de beneficiados, a leitura da planilha, as checagens da LIE
// e a aba BENEFICIADOS do formulário.

const P10 = regimePorCodigo("lie_p10_2026")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const MODELO = new Uint8Array(readFileSync(new URL("../public/modelos/lie/formulario-pcp-pcf-2026.xlsx", import.meta.url)));

let seq = 0;
const pessoa = (nome: string, campos: Partial<BeneficiadoParaChecar> = {}): BeneficiadoParaChecar =>
  ({ id: `b${++seq}`, nome, sexo: "feminino", idade: 10, rede_publica: true, beneficios: [], ...campos });

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: P10,
    despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [], nos: [], bens: [],
    contas: [],
    prestacao: { data_termo: "2026-03-01", data_fim_execucao: "2026-10-31" },
    manifestacaoEsportiva: "formacao",
    hoje: new Date("2026-08-01T12:00:00Z"),
    ...campos,
  } as EstadoDaPrestacao;
}

const de = (achados: Achado[], codigo: string) => achados.filter(a => a.codigo === codigo);

test("leitura das células: sexo, rede, idade e benefícios", () => {
  assert.deepEqual(["F", "fem.", "Feminino", "menina", "M", "Masc", "masculino", "homem", "outro", ""].map(lerSexo),
    ["feminino", "feminino", "feminino", "feminino", "masculino", "masculino", "masculino", "masculino", null, null]);
  assert.deepEqual(["Pública", "municipal", "EMEF Vila Nova", "E.E. João XXIII", "sim", "Particular", "privada", "não", "Colégio Alfa", ""].map(lerRede),
    [true, true, true, true, true, false, false, false, null, null]);
  assert.equal(lerIdade("12", "2026-08-01"), 12);
  assert.equal(lerIdade("12 anos", "2026-08-01"), 12);
  assert.equal(lerIdade("02/08/2014", "2026-08-01"), 11, "faz 12 no dia seguinte");
  assert.equal(lerIdade("2014-08-01", "2026-08-01"), 12);
  assert.equal(lerIdade("abc", "2026-08-01"), null);
  assert.equal(lerIdade("130", "2026-08-01"), null);
  assert.deepEqual(lerBeneficios("lanche; Transporte, uniforme / LANCHE"), ["Lanche", "Transporte", "Uniforme"]);
});

test("importação da planilha: colunas pelo título, linha de total fora e avisos do que não deu para ler", () => {
  const tabela = lerTabela([
    "Nº\tNome do aluno\tSexo\tData de nascimento\tEscola\tModalidade\tBenefícios\tTelefone",
    "1\tAna Souza\tF\t10/03/2015\tEMEF Vila Nova\tAtletismo\tLanche, Transporte\t(19) 99999-0001",
    "2\tBruno Lima\tM\t12\tColégio Alfa\tAtletismo\tLanche\t",
    "3\tCarla Dias\tX\t\tparticular\tNatação\t\t",
    "4\t\tF\t\t\t\t\t",
    "Total\t3\t\t\t\t\t\t",
  ].join("\n"))!;
  const mapa = adivinharMapaDeBeneficiados(tabela.cabecalho);
  assert.deepEqual([mapa.nome, mapa.sexo, mapa.idade, mapa.rede, mapa.modalidade, mapa.beneficios, mapa.telefone, mapa.endereco],
    ["1", "2", "3", "4", "5", "6", "7", ""]);
  const r = beneficiadosDaTabela(tabela, mapa, "2026-08-01");
  assert.equal(r.linhas.length, 3);
  assert.equal(r.ignoradas, 2);
  assert.deepEqual(r.linhas[0], {
    nome: "Ana Souza", modalidade: "Atletismo", sexo: "feminino", idade: 11, rede_publica: true,
    telefone: "(19) 99999-0001", endereco: null, beneficios: ["Lanche", "Transporte"], observacoes: null,
  });
  assert.deepEqual(r.linhas.map(l => [l.sexo, l.rede_publica]), [["feminino", true], ["masculino", null], [null, false]]);
  assert.deepEqual(r.avisos, [
    "1 linha tem o sexo que não deu para ler (use F ou M): fica sem sexo.",
    "1 linha tem a rede que não deu para ler (pública ou privada): fica sem a rede informada.",
  ]);
});

test("resumo: totais por sexo, rede pública, benefícios por frequência e repetidos", () => {
  const lista = [
    pessoa("Ana", { beneficios: ["Lanche", "Transporte"] }),
    pessoa("Bruno", { sexo: "masculino", rede_publica: false, beneficios: ["lanche"] }),
    pessoa("Carla", { sexo: null, rede_publica: null }),
    pessoa("ana ", { beneficios: ["Uniforme"] }),
  ];
  const r = resumoDosBeneficiados(lista);
  assert.deepEqual([r.total, r.feminino, r.masculino, r.semSexo, r.redePublica, r.redePrivada, r.redeNaoInformada, r.percentualRedePublica],
    [4, 2, 1, 1, 2, 1, 1, 50]);
  assert.deepEqual(r.beneficios, [{ nome: "Lanche", quantidade: 2 }, { nome: "Transporte", quantidade: 1 }, { nome: "Uniforme", quantidade: 1 }]);
  assert.deepEqual(r.repetidos, [{ nome: "Ana", idade: 10, quantidade: 2 }]);
  const sete = [pessoa("P1", { beneficios: ["A", "B", "C", "D", "E", "F", "G"] }), pessoa("P2", { beneficios: ["G", "F", "E", "D", "C", "B"] })];
  assert.deepEqual(colunasDeBeneficios(sete), { colunas: ["B", "C", "D", "E", "F", "G"], foraDoFormulario: ["A"] }, "os 6 mais comuns; empate pelo nome");
});

test("checagens da relação: vazia (aviso antes do fim, alerta depois), sem sexo e repetido; fora da LIE, nada", () => {
  const [antes] = de(executarChecagens(estado()), "BENEFICIADOS_AUSENTES");
  assert.equal(antes.severidade, "info");
  const [depois] = de(executarChecagens(estado({ hoje: new Date("2026-11-10T12:00:00Z") })), "BENEFICIADOS_AUSENTES");
  assert.equal(depois.severidade, "alerta");
  const achados = executarChecagens(estado({ beneficiarios: [pessoa("Ana"), pessoa("ANA"), pessoa("Bruno", { sexo: null })] }));
  const [semSexo] = de(achados, "BENEFICIADO_SEM_SEXO");
  assert.equal(semSexo.mensagem, "1 beneficiado está sem o sexo: o formulário traz o total feminino (2) e o masculino (0), que precisam somar os 3 listados.");
  assert.deepEqual(de(achados, "BENEFICIADO_REPETIDO").map(a => a.mensagem), ["Ana (10 anos) aparece 2 vezes na relação: cada beneficiado conta uma vez nos totais."]);
  assert.equal(de(achados, "BENEFICIADOS_AUSENTES").length, 0);
  assert.equal(executarChecagens(estado({ regime: ROUANET })).filter(a => a.codigo.startsWith("BENEFICIAD")).length, 0);
});

test("rede pública na formação: bloqueio abaixo de 50%, alerta quando a rede não informada ainda alcança, nada fora da formação", () => {
  const publica = (n: number) => Array.from({ length: n }, (_, i) => pessoa(`Pub ${i}`, { rede_publica: true }));
  const privada = (n: number) => Array.from({ length: n }, (_, i) => pessoa(`Pri ${i}`, { rede_publica: false }));
  const semRede = (n: number) => Array.from({ length: n }, (_, i) => pessoa(`Sem ${i}`, { rede_publica: null }));

  assert.equal(de(executarChecagens(estado({ beneficiarios: [...publica(5), ...privada(5)] })), "REDE_PUBLICA_ABAIXO_DO_MINIMO").length, 0, "50% cabe");
  const [bloqueio] = de(executarChecagens(estado({ beneficiarios: [...publica(4), ...privada(6)] })), "REDE_PUBLICA_ABAIXO_DO_MINIMO");
  assert.equal(bloqueio.severidade, "bloqueio");
  assert.equal(bloqueio.mensagem, "Na formação esportiva regular, ao menos 50% dos alunos são da rede pública (5 dos 10); a relação tem 4 de 10 (40%). Se o projeto não é de atividade regular, justifique.");
  const [alerta] = de(executarChecagens(estado({ beneficiarios: [...publica(4), ...privada(4), ...semRede(2)] })), "REDE_PUBLICA_ABAIXO_DO_MINIMO");
  assert.equal(alerta.severidade, "alerta");
  assert.match(alerta.mensagem, /hoje 4 de 10 \(40%\) estão marcados, e 2 beneficiados estão sem a rede informada\. Informe a rede de cada um\.$/);
  assert.equal(de(executarChecagens(estado({ manifestacaoEsportiva: "toda_vida", beneficiarios: privada(3) })), "REDE_PUBLICA_ABAIXO_DO_MINIMO").length, 0);
  assert.equal(de(executarChecagens(estado({ manifestacaoEsportiva: null, beneficiarios: privada(3) })), "REDE_PUBLICA_ABAIXO_DO_MINIMO").length, 0);
});

test("formulário: a aba BENEFICIADOS sai preenchida, em ordem alfabética, com os benefícios em colunas e os totais", async () => {
  assert.ok(!ABAS_A_MAO.includes("BENEFICIADOS"));
  const lista = [
    pessoa("Carla Dias", { sexo: "feminino", idade: 9, beneficios: ["Lanche"], modalidade: "Natação" }),
    pessoa("Ana Souza", { sexo: "feminino", idade: 11, beneficios: ["Lanche", "Transporte"], modalidade: "Atletismo", telefone: "(19) 99999-0001", endereco: "Rua A, 10" }),
    pessoa("Bruno Lima", { sexo: "masculino", idade: 12, beneficios: [], observacoes: "Entrou em maio" }),
    ...Array.from({ length: 27 }, (_, i) => pessoa(`Zé ${String(i).padStart(2, "0")}`, { sexo: "masculino", beneficios: ["Lanche"] })),
  ];
  const f = formularioLie({ estado: estado({ beneficiarios: lista }), etapa: "final", prestacao: { titulo: "Atletismo de Base", sli: "2600456", proponente: "Associação" } });
  assert.deepEqual(f.beneficiados.colunas, ["Lanche", "Transporte"]);
  assert.deepEqual(f.beneficiados.linhas.slice(0, 3).map(l => [l.nome, l.idade, l.beneficios]), [
    ["Ana Souza", 11, [true, true]], ["Bruno Lima", 12, [false, false]], ["Carla Dias", 9, [true, false]],
  ]);
  assert.deepEqual([f.beneficiados.feminino, f.beneficiados.masculino], [2, 28]);

  const pasta = await PastaDeTrabalho.abrir(await gravarFormularioLie(MODELO, f));
  const aba = pasta.planilha("BENEFICIADOS");
  assert.deepEqual(["G7", "H7", "I7"].map(r => aba.ler(r) ?? null), ["Lanche", "Transporte", null]);
  assert.deepEqual(["A8", "B8", "C8", "D8", "E8", "F8", "G8", "H8"].map(r => aba.ler(r)), [1, "Atletismo", "Ana Souza", "Rua A, 10", "(19) 99999-0001", 11, "X", "X"]);
  assert.equal(aba.ler("M9"), "Entrou em maio");
  // 30 linhas: 3 a mais que o modelo, e os totais descem 3 linhas.
  assert.equal(aba.ler("C37"), "Zé 26");
  assert.match(String(aba.ler("A38")), /Feminino:\s*2$/);
  assert.match(String(aba.ler("A39")), /Masculino:\s*28$/);
  assert.match(String(aba.ler("M2")).replace(/\s+/g, " "), /FINAL \(X\)/);
});
