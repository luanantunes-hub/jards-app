// Leitor seguro de fórmulas do orçamento (plano do módulo, PD5.2): `pessoas * dias_de_estrada * 180`. Sem eval e sem Function: um leitor de descida recursiva
// que só conhece números, nomes de variáveis, + - * /, parênteses, o sinal de menos e as funções min, max, round, ceil e floor. Sem tela e sem banco.
//
// Aceita vírgula ou ponto como separador decimal e o ponto como milhar quando há três dígitos depois (`1.500`). Entre os argumentos de uma função, use `;`
// ou vírgula com espaço (`max(pessoas; 8)`, `max(pessoas, 8)`): `max(1,5)` lê um e meio. Limites: 200 letras, 20 níveis de parênteses
// e resultado finito. Divisão por zero e variável desconhecida voltam como erro escrito, nunca como exceção.

export const FUNCOES_DA_FORMULA = ["min", "max", "round", "ceil", "floor"] as const;
export const TAMANHO_MAXIMO_DA_FORMULA = 200;
const PROFUNDIDADE_MAXIMA = 20;

export type ResultadoDaFormula = { ok: true; valor: number; usadas: string[] } | { ok: false; erro: string };

type Ficha = { tipo: "numero"; valor: number } | { tipo: "nome"; nome: string } | { tipo: "simbolo"; simbolo: "+" | "-" | "*" | "/" | "(" | ")" | "," };

class ErroDeFormula extends Error {}

function fichas(texto: string): Ficha[] {
  const lista: Ficha[] = [];
  let i = 0;
  while (i < texto.length) {
    const letra = texto[i];
    if (/\s/.test(letra)) { i += 1; continue; }
    if (/[0-9]/.test(letra)) {
      const achado = /^\d+(?:[.,]\d+)*/.exec(texto.slice(i));
      const bruto = achado ? achado[0] : letra;
      lista.push({ tipo: "numero", valor: lerNumero(bruto) });
      i += bruto.length;
      continue;
    }
    if (/[a-z_]/i.test(letra)) {
      let fim = i;
      while (fim < texto.length && /[a-z0-9_]/i.test(texto[fim])) fim += 1;
      lista.push({ tipo: "nome", nome: texto.slice(i, fim).toLowerCase() });
      i = fim;
      continue;
    }
    if (letra === ";") { lista.push({ tipo: "simbolo", simbolo: "," }); i += 1; continue; }
    if ("+-*/(),".includes(letra)) { lista.push({ tipo: "simbolo", simbolo: letra as "+" }); i += 1; continue; }
    if (letra === "×") { lista.push({ tipo: "simbolo", simbolo: "*" }); i += 1; continue; }
    if (letra === "÷") { lista.push({ tipo: "simbolo", simbolo: "/" }); i += 1; continue; }
    throw new ErroDeFormula(`O caractere "${letra}" não é aceito na fórmula.`);
  }
  return lista;
}

/** "1.500" é mil e quinhentos; "1,5" e "1.5" são um e meio; "1.500,75" é mil e quinhentos e setenta e cinco centavos. */
function lerNumero(bruto: string): number {
  let limpo = bruto;
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(limpo)) throw new ErroDeFormula(`"${bruto}" não é um número.`);
  return Number(limpo);
}

/** Calcula a fórmula com os valores das variáveis (nomes em minúsculas). Nunca lança: o erro vem escrito. */
export function avaliarFormula(texto: string, variaveis: Readonly<Record<string, number>>): ResultadoDaFormula {
  if (texto.trim() === "") return { ok: false, erro: "Escreva a fórmula." };
  if (texto.length > TAMANHO_MAXIMO_DA_FORMULA) return { ok: false, erro: `A fórmula pode ter até ${TAMANHO_MAXIMO_DA_FORMULA} letras.` };
  try {
    const lista = fichas(texto);
    const usadas = new Set<string>();
    let posicao = 0;
    const espiar = () => lista[posicao];
    const simbolo = (esperado: string) => { const f = lista[posicao]; if (f?.tipo === "simbolo" && f.simbolo === esperado) { posicao += 1; return true; } return false; };

    const expressao = (nivel: number): number => {
      if (nivel > PROFUNDIDADE_MAXIMA) throw new ErroDeFormula("A fórmula tem parênteses demais.");
      let valor = termo(nivel);
      for (;;) {
        if (simbolo("+")) valor += termo(nivel);
        else if (simbolo("-")) valor -= termo(nivel);
        else return valor;
      }
    };
    const termo = (nivel: number): number => {
      let valor = fator(nivel);
      for (;;) {
        if (simbolo("*")) valor *= fator(nivel);
        else if (simbolo("/")) {
          const divisor = fator(nivel);
          if (divisor === 0) throw new ErroDeFormula("A fórmula divide por zero.");
          valor /= divisor;
        } else return valor;
      }
    };
    const fator = (nivel: number): number => {
      if (simbolo("-")) return -fator(nivel);
      if (simbolo("+")) return fator(nivel);
      const f = espiar();
      if (!f) throw new ErroDeFormula("A fórmula termina antes da hora.");
      if (f.tipo === "numero") { posicao += 1; return f.valor; }
      if (f.tipo === "nome") {
        posicao += 1;
        if ((FUNCOES_DA_FORMULA as readonly string[]).includes(f.nome)) return funcao(f.nome, nivel);
        if (!Object.hasOwn(variaveis, f.nome)) throw new ErroDeFormula(`Não existe a variável "${f.nome}" neste orçamento.`);
        usadas.add(f.nome);
        return variaveis[f.nome];
      }
      if (simbolo("(")) {
        const valor = expressao(nivel + 1);
        if (!simbolo(")")) throw new ErroDeFormula("Falta fechar um parêntese.");
        return valor;
      }
      throw new ErroDeFormula(`Não era esperado "${f.simbolo}" aqui.`);
    };
    const funcao = (nome: string, nivel: number): number => {
      if (!simbolo("(")) throw new ErroDeFormula(`Depois de ${nome} vem um parêntese: ${nome}(...).`);
      const argumentos: number[] = [expressao(nivel + 1)];
      while (simbolo(",")) argumentos.push(expressao(nivel + 1));
      if (!simbolo(")")) throw new ErroDeFormula("Falta fechar um parêntese.");
      if (nome === "min") return Math.min(...argumentos);
      if (nome === "max") return Math.max(...argumentos);
      if (argumentos.length !== 1) throw new ErroDeFormula(`${nome} recebe um número só.`);
      return nome === "round" ? Math.round(argumentos[0]) : nome === "ceil" ? Math.ceil(argumentos[0]) : Math.floor(argumentos[0]);
    };

    const valor = expressao(0);
    if (posicao < lista.length) throw new ErroDeFormula("Sobrou algo depois do fim da conta.");
    if (!Number.isFinite(valor) || valor > 999999999999.99) throw new ErroDeFormula("O resultado é grande demais.");
    if (valor < 0) throw new ErroDeFormula("O resultado não pode ser negativo: o orçamento só guarda valores de zero para cima.");
    return { ok: true, valor: Math.round(valor * 100) / 100, usadas: [...usadas].sort() };
  } catch (erro) {
    if (erro instanceof ErroDeFormula) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível ler a fórmula." };
  }
}

/** O nome de uma variável como o banco confere: minúsculas, números e sublinhado, de 1 a 30, começando por letra, e fora os nomes das funções. */
export function nomeDeVariavelValido(nome: string): boolean {
  return /^[a-z][a-z0-9_]{0,29}$/.test(nome) && !(FUNCOES_DA_FORMULA as readonly string[]).includes(nome);
}

/** Um nome digitado como a pessoa escreve ("Dias de estrada") vira o nome da variável ("dias_de_estrada"). */
export function nomeSugeridoParaVariavel(texto: string): string {
  const base = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const comLetra = /^[a-z]/.test(base) ? base : base === "" ? "" : `v_${base}`;
  const curto = comLetra.slice(0, 30).replace(/_+$/g, "");
  return (FUNCOES_DA_FORMULA as readonly string[]).includes(curto) ? `${curto}_` : curto;
}

export type VariavelDoOrcamento = { id: string; nome: string; rotulo: string | null; valor: number };

/** Os valores das variáveis num objeto nome → valor, pronto para `avaliarFormula`. */
export const valoresDasVariaveis = (variaveis: readonly Pick<VariavelDoOrcamento, "nome" | "valor">[]): Record<string, number> =>
  Object.fromEntries(variaveis.map(variavel => [variavel.nome, variavel.valor]));

/**
 * Recalcula as estimativas das linhas que têm fórmula, com os valores atuais das variáveis. Devolve só as linhas que mudam (a tela grava essas) e as que
 * não calculam (com o erro escrito, para avisar). Linhas sem fórmula não entram.
 */
export function recalcularEstimativas(
  linhas: readonly { id: string; descricao: string; formula?: string | null; estimativa: number | null }[],
  variaveis: Readonly<Record<string, number>>,
): { mudancas: { id: string; estimativa: number }[]; problemas: { id: string; descricao: string; erro: string }[] } {
  const mudancas: { id: string; estimativa: number }[] = [];
  const problemas: { id: string; descricao: string; erro: string }[] = [];
  for (const linha of linhas) {
    if (!linha.formula) continue;
    const resultado = avaliarFormula(linha.formula, variaveis);
    if (!resultado.ok) { problemas.push({ id: linha.id, descricao: linha.descricao, erro: resultado.erro }); continue; }
    if (resultado.valor !== linha.estimativa) mudancas.push({ id: linha.id, estimativa: resultado.valor });
  }
  return { mudancas, problemas };
}
