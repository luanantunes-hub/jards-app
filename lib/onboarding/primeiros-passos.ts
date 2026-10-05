/**
 * Primeiros passos de uma organização nova. Cada passo é concluído pelo dado
 * que ele cria (a tabela deixa de estar vazia), não por um clique no cartão:
 * quem cadastra o projeto por outro caminho também vê o passo marcado.
 */

export type PassoId = "projeto" | "empresa" | "negociacao" | "atividade" | "edital";

export type Passo = {
  id: PassoId;
  titulo: string;
  descricao: string;
  acao: string;
  href: string;
  /** Onde ver o que já foi feito, depois de concluído. */
  hrefFeito: string;
  /** Tabela cuja primeira linha da organização conclui o passo. */
  tabela: "projetos_crm" | "empresas_crm" | "captacoes" | "atividades" | "editais_user";
};

export const PASSOS: Record<PassoId, Passo> = {
  projeto: {
    id: "projeto",
    titulo: "Cadastre seu projeto",
    descricao: "Nome, lei de incentivo e quanto você quer captar. Tudo no Jards parte dele.",
    acao: "Cadastrar projeto",
    href: "/projetos?novo=1",
    hrefFeito: "/projetos",
    tabela: "projetos_crm",
  },
  empresa: {
    id: "empresa",
    titulo: "Encontre empresas que patrocinam",
    descricao: "Veja quem investe na sua área pelo banco de patrocinadores e salve como prospect.",
    acao: "Buscar patrocinadores",
    href: "/patrocinadores",
    hrefFeito: "/empresas-crm",
    tabela: "empresas_crm",
  },
  negociacao: {
    id: "negociacao",
    titulo: "Abra uma negociação",
    descricao: "Acompanhe a conversa com cada empresa, do primeiro contato ao contrato.",
    acao: "Nova negociação",
    href: "/captacoes?novo=1",
    hrefFeito: "/captacoes",
    tabela: "captacoes",
  },
  atividade: {
    id: "atividade",
    titulo: "Agende o próximo passo",
    descricao: "Registre a ligação, a reunião ou o e-mail que vem a seguir para não perder o ritmo.",
    acao: "Nova atividade",
    href: "/atividades?novo=1",
    hrefFeito: "/atividades",
    tabela: "atividades",
  },
  edital: {
    id: "edital",
    titulo: "Acompanhe um edital",
    descricao: "Encontre editais abertos para o seu projeto e traga os que interessam para suas inscrições.",
    acao: "Ver editais abertos",
    href: "/editais-abertos",
    hrefFeito: "/editais-inscritos",
    tabela: "editais_user",
  },
};

/** Ordem dos passos conforme o objetivo respondido no questionário de boas-vindas. */
const ORDEM_POR_OBJETIVO: Record<string, PassoId[]> = {
  captar_patrocinio: ["projeto", "empresa", "negociacao", "atividade", "edital"],
  encontrar_editais: ["projeto", "edital", "atividade", "empresa", "negociacao"],
  organizar_pipeline: ["empresa", "negociacao", "atividade", "projeto", "edital"],
  gerir_projetos: ["projeto", "atividade", "negociacao", "empresa", "edital"],
};

export function ordemDosPassos(objetivo: string | null | undefined): Passo[] {
  const ordem = (objetivo && ORDEM_POR_OBJETIVO[objetivo]) || ORDEM_POR_OBJETIVO.captar_patrocinio;
  return ordem.map(id => PASSOS[id]);
}

export type PassoComEstado = Passo & { feito: boolean };

export function comEstado(passos: Passo[], feitos: ReadonlySet<PassoId>): PassoComEstado[] {
  return passos.map(passo => ({ ...passo, feito: feitos.has(passo.id) }));
}

/** O primeiro passo ainda não feito, na ordem sugerida. */
export function proximoPasso(passos: PassoComEstado[]): PassoComEstado | null {
  return passos.find(passo => !passo.feito) ?? null;
}

/** Disparado quando o questionário de boas-vindas é salvo: o objetivo muda a ordem dos passos. */
export const EVENTO_PERFIL_CONCLUIDO = "jards:perfil-concluido";
