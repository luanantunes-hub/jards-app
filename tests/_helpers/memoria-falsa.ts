import { randomUUID } from "node:crypto";
import type { Consulta, Resolvedor, Resposta } from "./banco-falso";

/**
 * Tabelas de mentira que guardam o que o código grava: inserir, atualizar, apagar e ler de volta, com os filtros que as
 * rotas usam (eq, in, is, not is, lt, gte). Imita as duas conferências de unicidade que importam para os testes:
 * a chave de acesso da nota por prestação e o mesmo conteúdo na caixa de entrada.
 */
type Linha = Record<string, unknown>;

function casa(valor: unknown, operador: string, esperado: unknown): boolean {
  switch (operador) {
    case "eq":
      return valor === esperado;
    case "neq":
      return valor !== esperado;
    case "in":
      return Array.isArray(esperado) && esperado.includes(valor);
    case "is":
      return esperado === null ? valor === null || valor === undefined : valor === esperado;
    case "not": {
      // .not("coluna", "is", null) chega como ["is", null]
      const [op, alvo] = Array.isArray(esperado) ? esperado : [undefined, undefined];
      return op === "is" && alvo === null ? valor !== null && valor !== undefined : true;
    }
    case "lt":
      return typeof valor === "string" && typeof esperado === "string" && valor < esperado;
    case "gte":
      return typeof valor === "string" && typeof esperado === "string" && valor >= esperado;
    default:
      return true; // or(...), ilike(...) e afins: não filtram na memória
  }
}

/** Ordena como o PostgREST: pelas colunas na ordem pedida, com o vazio por último. */
function comparar(ordens: ReadonlyArray<readonly [string, boolean]>) {
  return (a: Linha, b: Linha): number => {
    for (const [coluna, ascendente] of ordens) {
      const x = a[coluna], y = b[coluna];
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const resultado = (x as string | number) < (y as string | number) ? -1 : 1;
      return ascendente ? resultado : -resultado;
    }
    return 0;
  };
}

/** O que o banco preenche sozinho quando a linha chega sem o campo (os padrões das colunas). */
const PADROES: Record<string, Linha> = {
  assistente_sessoes_envio: { enviados: 0, revogada_em: null },
};

export function memoriaFalsa(iniciais: Record<string, Linha[]> = {}) {
  const tabelas = new Map<string, Linha[]>(Object.entries(iniciais).map(([nome, linhas]) => [nome, linhas.map(l => ({ ...l }))]));
  const tabela = (nome: string) => {
    if (!tabelas.has(nome)) tabelas.set(nome, []);
    return tabelas.get(nome)!;
  };

  const conflito = (nome: string, linhas: Linha[], nova: Linha, ignorar?: Linha): boolean => {
    if (nome === "prestacao_comprovantes") {
      return Boolean(nova.chave_acesso) && linhas.some(l => l !== ignorar && l.prestacao_id === nova.prestacao_id && l.chave_acesso === nova.chave_acesso);
    }
    if (nome === "assistente_arquivos") {
      const vale = (l: Linha) => l.sha256 && (l.situacao === "recebido" || l.situacao === "registrado");
      return Boolean(vale(nova)) && linhas.some(l => l !== ignorar && vale(l) && l.prestacao_id === nova.prestacao_id && l.destino === nova.destino && l.sha256 === nova.sha256);
    }
    return false;
  };

  const resolver: Resolvedor = (c: Consulta): Resposta | undefined => {
    if (!tabelas.has(c.tabela)) return undefined;
    const linhas = tabela(c.tabela);
    const satisfaz = (linha: Linha) => c.filtros.every(([operador, coluna, valor]) => casa(linha[coluna], operador, valor));

    if (c.acao === "insert") {
      const novas = (Array.isArray(c.valores) ? c.valores : [c.valores]).map(v => ({ id: randomUUID(), created_at: new Date().toISOString(), ...(PADROES[c.tabela] ?? {}), ...(v as Linha) }));
      for (const nova of novas) {
        if (conflito(c.tabela, linhas, nova)) return { error: { message: "duplicate key value", code: "23505" } };
        linhas.push(nova);
      }
      return { data: c.unico ? novas[0] : novas };
    }
    if (c.acao === "update") {
      const alvo = linhas.filter(satisfaz);
      for (const linha of alvo) {
        const depois = { ...linha, ...(c.valores as Linha) };
        if (conflito(c.tabela, linhas, depois, linha)) return { error: { message: "duplicate key value", code: "23505" } };
        Object.assign(linha, c.valores);
      }
      return { data: c.unico ? (alvo[0] ?? null) : alvo };
    }
    if (c.acao === "delete") {
      const apagadas = linhas.filter(satisfaz);
      tabelas.set(c.tabela, linhas.filter(l => !satisfaz(l)));
      return { data: apagadas };
    }
    let achadas = linhas.filter(satisfaz);
    const total = achadas.length;
    if (c.ordens?.length) achadas = [...achadas].sort(comparar(c.ordens));
    if (c.intervalo) achadas = achadas.slice(c.intervalo[0], c.intervalo[1] + 1);
    if (c.limite !== undefined) achadas = achadas.slice(0, c.limite);
    return { data: c.unico ? (achadas[0] ?? null) : achadas, count: total };
  };

  return { resolver, tabela, linhas: (nome: string) => tabela(nome) };
}

/** Junta resolvedores: vale o primeiro que responder. */
export const primeiroQueResponder = (...resolvedores: Resolvedor[]): Resolvedor => c => {
  for (const resolver of resolvedores) {
    const resposta = resolver(c);
    if (resposta !== undefined) return resposta;
  }
  return undefined;
};
