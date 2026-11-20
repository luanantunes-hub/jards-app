/**
 * O registro do que o assistente (Claude ou ChatGPT) fez numa prestação (assistente_acoes), em módulo puro (sem Node): o
 * conector e o card "Ações do assistente" do app usam a mesma regra de quando dá para retirar o que ele criou.
 */

export const COLUNAS_DA_ACAO = "id,ferramenta,acao,plataforma,tabela,registro_id,resumo,desfeita_em,created_at";

export interface LinhaDaAcao {
  id: string;
  ferramenta: string;
  acao: string;
  plataforma: string;
  tabela: string | null;
  registro_id: string | null;
  resumo: string;
  desfeita_em: string | null;
  created_at: string;
}

/** As únicas tabelas em que o assistente cria linhas que ele mesmo pode retirar. */
export const TABELAS_QUE_O_ASSISTENTE_CRIA = ["prestacao_comprovantes", "prestacao_evidencias"] as const;

/** Só se retira o que o assistente criou e ainda não foi retirado; o resto se muda no app. */
export const podeRetirar = (a: Pick<LinhaDaAcao, "acao" | "tabela" | "registro_id" | "desfeita_em">) =>
  a.acao === "criar" && !a.desfeita_em && Boolean(a.registro_id) && (TABELAS_QUE_O_ASSISTENTE_CRIA as readonly (string | null)[]).includes(a.tabela);

/** Quem fez, para mostrar à equipe. "outro" é um assistente que o Jards não reconhece pelo nome da conexão. */
export const ROTULO_DO_ASSISTENTE: Record<string, string> = { claude: "Claude", chatgpt: "ChatGPT", outro: "Assistente" };
