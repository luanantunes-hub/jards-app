// Relação de beneficiados (P8.5).
//
// O formulário PCP/PCF da Lei de Incentivo ao Esporte tem a aba BENEFICIADOS:
// cada diretamente beneficiado com evento ou modalidade, nome (em ordem
// alfabética), endereço, telefone, idade e os benefícios recebidos, e no fim o
// total feminino e o masculino, que precisam somar o número listado. Na
// formação esportiva regular, ao menos 50% dos alunos são da rede pública
// (Decreto 12.861/2026, art. 18); o formulário não tem esse campo, a relação
// guarda. Aqui ficam o resumo da relação, a leitura de uma planilha colada ou
// em CSV e as colunas de benefício do formulário. Sem React e sem Supabase.

import { semAcento } from "./extrato";
import type { TabelaLida } from "./orcamento";
import type { PrestacaoBeneficiario } from "@/lib/supabase/types";

export type SexoDoBeneficiado = NonNullable<PrestacaoBeneficiario["sexo"]>;

export type BeneficiadoParaChecar = Pick<PrestacaoBeneficiario, "id" | "nome" | "sexo" | "idade" | "rede_publica" | "beneficios">
  & Partial<Pick<PrestacaoBeneficiario, "modalidade" | "telefone" | "endereco" | "observacoes">>;

export type BeneficiadoNovo = Pick<PrestacaoBeneficiario,
  "nome" | "modalidade" | "sexo" | "idade" | "rede_publica" | "telefone" | "endereco" | "beneficios" | "observacoes">;

/** O formulário tem 6 colunas de benefício (G a L). */
export const COLUNAS_DE_BENEFICIO = 6;
export const LIMITES_DO_BENEFICIADO = { nome: 200, modalidade: 200, telefone: 40, endereco: 300, beneficio: 60, beneficios: 12, observacoes: 1000 } as const;

export const ROTULO_DO_SEXO: Record<SexoDoBeneficiado, string> = { feminino: "Feminino", masculino: "Masculino" };

export function rotuloDaRede(rede: boolean | null | undefined): string {
  return rede === true ? "Pública" : rede === false ? "Privada" : "Não informada";
}

/** Nome para comparar: sem acento, sem caixa e com um espaço entre as palavras. */
export const nomeComparavel = (nome: string) => semAcento(nome).replace(/\s+/g, " ").trim();

/** Ordem alfabética, como a aba pede. */
export function ordenarPorNome<T extends Pick<BeneficiadoParaChecar, "nome">>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

export type ResumoDosBeneficiados = {
  total: number;
  feminino: number;
  masculino: number;
  semSexo: number;
  redePublica: number;
  redePrivada: number;
  redeNaoInformada: number;
  /** Rede pública sobre o total listado; null sem beneficiado. */
  percentualRedePublica: number | null;
  /** Benefícios por quantos recebem, do mais comum ao menos. */
  beneficios: { nome: string; quantidade: number }[];
  /** O mesmo nome com a mesma idade mais de uma vez. */
  repetidos: { nome: string; idade: number | null; quantidade: number }[];
};

export function resumoDosBeneficiados(lista: readonly BeneficiadoParaChecar[]): ResumoDosBeneficiados {
  const contar = (f: (b: BeneficiadoParaChecar) => boolean) => lista.filter(f).length;
  const porBeneficio = new Map<string, { nome: string; quantidade: number }>();
  for (const b of lista) {
    for (const nome of new Set(b.beneficios.map(x => x.trim()).filter(Boolean))) {
      const chave = nomeComparavel(nome);
      const atual = porBeneficio.get(chave) ?? { nome, quantidade: 0 };
      atual.quantidade += 1;
      porBeneficio.set(chave, atual);
    }
  }
  const porPessoa = new Map<string, { nome: string; idade: number | null; quantidade: number }>();
  for (const b of lista) {
    const chave = `${nomeComparavel(b.nome)}|${b.idade ?? ""}`;
    const atual = porPessoa.get(chave) ?? { nome: b.nome.trim(), idade: b.idade, quantidade: 0 };
    atual.quantidade += 1;
    porPessoa.set(chave, atual);
  }
  const redePublica = contar(b => b.rede_publica === true);
  return {
    total: lista.length,
    feminino: contar(b => b.sexo === "feminino"),
    masculino: contar(b => b.sexo === "masculino"),
    semSexo: contar(b => !b.sexo),
    redePublica,
    redePrivada: contar(b => b.rede_publica === false),
    redeNaoInformada: contar(b => b.rede_publica === null || b.rede_publica === undefined),
    percentualRedePublica: lista.length ? Math.round((redePublica / lista.length) * 1000) / 10 : null,
    beneficios: [...porBeneficio.values()].sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR")),
    repetidos: [...porPessoa.values()].filter(p => p.quantidade > 1).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

/** As colunas BENEFÍCIOS do formulário: os 6 mais comuns; os demais ficam de fora. */
export function colunasDeBeneficios(lista: readonly BeneficiadoParaChecar[]): { colunas: string[]; foraDoFormulario: string[] } {
  const todos = resumoDosBeneficiados(lista).beneficios.map(b => b.nome);
  return { colunas: todos.slice(0, COLUNAS_DE_BENEFICIO), foraDoFormulario: todos.slice(COLUNAS_DE_BENEFICIO) };
}

// ─── Leitura de planilha ────────────────────────────────────────────────────

const SEXO_FEMININO = new Set(["f", "fem", "feminino", "mulher", "menina", "garota"]);
const SEXO_MASCULINO = new Set(["m", "masc", "masculino", "homem", "menino", "garoto"]);

/** "F", "Feminino", "menina"… viram feminino; "M", "Masc."… masculino; o resto, null. */
export function lerSexo(texto: string | null | undefined): SexoDoBeneficiado | null {
  const t = semAcento(texto ?? "").replace(/[.\s]/g, "");
  if (!t) return null;
  if (SEXO_FEMININO.has(t) || t.startsWith("femin")) return "feminino";
  if (SEXO_MASCULINO.has(t) || t.startsWith("mascul")) return "masculino";
  return null;
}

/** "Pública", "municipal", "EMEF João…", "sim" viram true; "privada", "particular", "não", false; o resto, null. */
export function lerRede(texto: string | null | undefined): boolean | null {
  const t = semAcento(texto ?? "").trim();
  if (!t) return null;
  if (/\b(privad[ao]|particular)\b/.test(t) || /^(n|nao)$/.test(t)) return false;
  if (/\b(public[ao]|municipal|estadual|federal|emef|emei|emeif|ee|etec|ciep|if|ifsp)\b/.test(t) || /\be\.\s?e\./.test(t) || /^(s|sim|x)$/.test(t)) return true;
  return null;
}

/** Idade em anos ("12", "12 anos") ou a data de nascimento (dd/mm/aaaa, aaaa-mm-dd), contada até `hoje`. */
export function lerIdade(texto: string | null | undefined, hoje: string): number | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const anos = /^(\d{1,3})(\s*anos?)?$/i.exec(t);
  if (anos) {
    const n = Number(anos[1]);
    return n <= 120 ? n : null;
  }
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const [dia, mes, ano] = br ? [Number(br[1]), Number(br[2]), Number(br[3])] : iso ? [Number(iso[3]), Number(iso[2]), Number(iso[1])] : [0, 0, 0];
  if (!ano || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const [hAno, hMes, hDia] = hoje.slice(0, 10).split("-").map(Number);
  const idade = hAno - ano - (hMes < mes || (hMes === mes && hDia < dia) ? 1 : 0);
  return idade >= 0 && idade <= 120 ? idade : null;
}

/** "Lanche; transporte, uniforme" vira ["Lanche", "Transporte", "Uniforme"], sem repetir. */
export function lerBeneficios(texto: string | null | undefined): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const parte of (texto ?? "").split(/[,;/|+\n]/)) {
    const nome = parte.trim().replace(/\s+/g, " ").slice(0, LIMITES_DO_BENEFICIADO.beneficio);
    if (!nome || vistos.has(nomeComparavel(nome))) continue;
    vistos.add(nomeComparavel(nome));
    lista.push(nome.charAt(0).toUpperCase() + nome.slice(1));
  }
  return lista.slice(0, LIMITES_DO_BENEFICIADO.beneficios);
}

export const CAMPOS_DA_IMPORTACAO = [
  { campo: "nome", rotulo: "Nome", pistas: ["nome", "beneficiad", "aluno", "atleta"] },
  { campo: "sexo", rotulo: "Sexo", pistas: ["sexo", "genero"] },
  { campo: "idade", rotulo: "Idade ou nascimento", pistas: ["idade", "nascimento", "nasc"] },
  { campo: "rede", rotulo: "Rede de ensino", pistas: ["rede", "escola", "ensino"] },
  { campo: "modalidade", rotulo: "Evento ou modalidade", pistas: ["modalidade", "evento", "turma", "nucleo"] },
  { campo: "telefone", rotulo: "Telefone", pistas: ["telefone", "fone", "celular", "whats", "contato"] },
  { campo: "endereco", rotulo: "Endereço", pistas: ["endereco", "logradouro", "bairro"] },
  { campo: "beneficios", rotulo: "Benefícios", pistas: ["benefic"] },
  { campo: "observacoes", rotulo: "Observações", pistas: ["observ", "obs"] },
] as const;
export type CampoDaImportacao = (typeof CAMPOS_DA_IMPORTACAO)[number]["campo"];
/** Índice da coluna (como texto, para o Dropdown) de cada campo; "" quando a planilha não tem. */
export type MapaDeBeneficiados = Record<CampoDaImportacao, string>;

/** A primeira coluna com a pista no começo de uma palavra do título ("idade" não casa com "Modalidade" nem "Cidade"). */
function colunaPelaPista(cabecalho: readonly string[], pistas: readonly string[], usados: readonly string[]): string {
  const titulos = cabecalho.map(t => semAcento(t));
  for (const pista of pistas) {
    const i = titulos.findIndex((t, j) => !usados.includes(String(j)) && new RegExp(`(^|[^a-z0-9])${pista}`).test(t));
    if (i >= 0) return String(i);
  }
  return "";
}

export function adivinharMapaDeBeneficiados(cabecalho: readonly string[]): MapaDeBeneficiados {
  const usados: string[] = [];
  const mapa = {} as MapaDeBeneficiados;
  for (const { campo, pistas } of CAMPOS_DA_IMPORTACAO) {
    const coluna = colunaPelaPista(cabecalho, pistas, usados);
    mapa[campo] = coluna;
    if (coluna) usados.push(coluna);
  }
  return mapa;
}

export type ImportacaoDeBeneficiados = {
  linhas: BeneficiadoNovo[];
  /** Linhas sem nome ou de total, que ficaram de fora. */
  ignoradas: number;
  /** O que a planilha tinha e não deu para ler. */
  avisos: string[];
};

const corte = (texto: string | undefined, limite: number) => {
  const t = (texto ?? "").trim().replace(/\s+/g, " ");
  return t ? t.slice(0, limite) : null;
};

/** As linhas da planilha pelo mapa de colunas; `hoje` (aaaa-mm-dd) conta a idade de quem veio com a data de nascimento. */
export function beneficiadosDaTabela(tabela: TabelaLida, mapa: MapaDeBeneficiados, hoje: string): ImportacaoDeBeneficiados {
  const indice = (campo: CampoDaImportacao) => (mapa[campo] === "" ? -1 : Number(mapa[campo]));
  const celula = (linha: readonly string[], campo: CampoDaImportacao) => {
    const i = indice(campo);
    return i < 0 ? undefined : linha[i];
  };
  const linhas: BeneficiadoNovo[] = [];
  let ignoradas = 0;
  const naoLidos = { sexo: 0, idade: 0, rede: 0 };
  for (const linha of tabela.linhas) {
    const nome = corte(celula(linha, "nome"), LIMITES_DO_BENEFICIADO.nome);
    // Sem nome, só número no lugar do nome ou linha de total ("Total", "Total geral") ficam de fora.
    if (!nome || /^\d+$/.test(nome) || linha.some(c => /^total\b/.test(semAcento(c.trim())))) {
      ignoradas += 1;
      continue;
    }
    const textoSexo = celula(linha, "sexo")?.trim();
    const textoIdade = celula(linha, "idade")?.trim();
    const textoRede = celula(linha, "rede")?.trim();
    const sexo = lerSexo(textoSexo);
    const idade = lerIdade(textoIdade, hoje);
    const rede = lerRede(textoRede);
    if (textoSexo && !sexo) naoLidos.sexo += 1;
    if (textoIdade && idade === null) naoLidos.idade += 1;
    if (textoRede && rede === null) naoLidos.rede += 1;
    linhas.push({
      nome,
      modalidade: corte(celula(linha, "modalidade"), LIMITES_DO_BENEFICIADO.modalidade),
      sexo,
      idade,
      rede_publica: rede,
      telefone: corte(celula(linha, "telefone"), LIMITES_DO_BENEFICIADO.telefone),
      endereco: corte(celula(linha, "endereco"), LIMITES_DO_BENEFICIADO.endereco),
      beneficios: lerBeneficios(celula(linha, "beneficios")),
      observacoes: corte(celula(linha, "observacoes"), LIMITES_DO_BENEFICIADO.observacoes),
    });
  }
  const aviso = (n: number, campo: string, dica: string, fica: string) =>
    n ? `${n === 1 ? "1 linha tem" : `${n} linhas têm`} ${campo} que não deu para ler (${dica}): ${n === 1 ? "fica" : "ficam"} ${fica}.` : null;
  const avisos = [
    aviso(naoLidos.sexo, "o sexo", "use F ou M", "sem sexo"),
    aviso(naoLidos.idade, "a idade", "anos ou dd/mm/aaaa", "sem idade"),
    aviso(naoLidos.rede, "a rede", "pública ou privada", "sem a rede informada"),
  ].filter((a): a is string => Boolean(a));
  return { linhas, ignoradas, avisos };
}
