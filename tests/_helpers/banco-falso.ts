/**
 * Banco de mentira para testar as rotas do conector sem tocar no Supabase: guarda cada consulta que o código fez
 * (tabela, ação, filtros, valores gravados) e devolve o que o teste mandar. Cobre só o encadeamento que as rotas usam.
 */
export interface Consulta {
  tabela: string;
  acao: "select" | "insert" | "upsert" | "update" | "delete" | "rpc";
  colunas?: string;
  valores?: unknown;
  /** Segundo argumento do upsert (`onConflict`). */
  opcoes?: unknown;
  filtros: Array<[operador: string, coluna: string, valor: unknown]>;
  unico: "maybe" | "single" | null;
  /** .order(coluna, { ascending }) na ordem em que foram pedidos. */
  ordens?: Array<[coluna: string, ascendente: boolean]>;
  /** .limit(n). */
  limite?: number;
  /** .range(de, ate), inclusive nos dois lados como no PostgREST. */
  intervalo?: [de: number, ate: number];
}

export type Resposta = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type Resolvedor = (consulta: Consulta) => Resposta | undefined;

export function bancoFalso(resolver: Resolvedor) {
  const consultas: Consulta[] = [];

  function resolver_(consulta: Consulta) {
    consultas.push(consulta);
    const saida = resolver(consulta) ?? {};
    return { data: saida.data ?? (consulta.unico ? null : []), error: saida.error ?? null, count: saida.count ?? null };
  }

  function encadeamento(inicial: Consulta) {
    const consulta = inicial;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cadeia: any = {
      select(colunas?: string) {
        consulta.colunas = colunas ?? consulta.colunas;
        return cadeia;
      },
      insert(valores: unknown) {
        consulta.acao = "insert";
        consulta.valores = valores;
        return cadeia;
      },
      upsert(valores: unknown, opcoes?: unknown) {
        consulta.acao = "upsert";
        consulta.valores = valores;
        consulta.opcoes = opcoes;
        return cadeia;
      },
      update(valores: unknown) {
        consulta.acao = "update";
        consulta.valores = valores;
        return cadeia;
      },
      delete() {
        consulta.acao = "delete";
        return cadeia;
      },
      maybeSingle() {
        consulta.unico = "maybe";
        return Promise.resolve(resolver_(consulta));
      },
      single() {
        consulta.unico = "single";
        return Promise.resolve(resolver_(consulta));
      },
      then(resolve: (valor: unknown) => unknown, rejeitar?: (erro: unknown) => unknown) {
        return Promise.resolve(resolver_(consulta)).then(resolve, rejeitar);
      },
    };
    for (const operador of ["eq", "neq", "in", "ilike", "is", "not", "gte", "lt", "or", "contains"]) {
      cadeia[operador] = (coluna: string, valor?: unknown, extra?: unknown) => {
        consulta.filtros.push([operador, coluna, extra === undefined ? valor : [valor, extra]]);
        return cadeia;
      };
    }
    cadeia.order = (coluna: string, opcoes?: { ascending?: boolean }) => {
      (consulta.ordens ??= []).push([coluna, opcoes?.ascending !== false]);
      return cadeia;
    };
    cadeia.limit = (n: number) => {
      consulta.limite = n;
      return cadeia;
    };
    cadeia.range = (de: number, ate: number) => {
      consulta.intervalo = [de, ate];
      return cadeia;
    };
    return cadeia;
  }

  const admin = {
    from: (tabela: string) => encadeamento({ tabela, acao: "select", filtros: [], unico: null }),
    rpc: (nome: string, argumentos: unknown) =>
      encadeamento({ tabela: nome, acao: "rpc", valores: argumentos, filtros: [], unico: null }),
  };

  return { admin: admin as never, consultas };
}

/** Procura, entre as consultas feitas, as de uma tabela e ação. */
export function consultasDe(consultas: readonly Consulta[], tabela: string, acao: Consulta["acao"]): Consulta[] {
  return consultas.filter((consulta) => consulta.tabela === tabela && consulta.acao === acao);
}
