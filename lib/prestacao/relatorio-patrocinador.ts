// Relatório do patrocinador por link (P5.2): o que a página pública mostra a
// partir do que fn_relatorio_patrocinador_publico devolve, e a situação de
// cada link na prestação. Sem React e sem Supabase.

export type RelatorioPublico = {
  situacao: "ativo" | "expirado" | "revogado";
  patrocinador: string;
  mensagem?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  expira_em?: string;
  organizacao?: { nome: string | null; avatar_url: string | null } | null;
  prestacao?: {
    titulo: string;
    identificador_oficial: string | null;
    status: string;
    regime: string | null;
    proponente: string | null;
    data_aprovacao: string | null;
    data_liberacao: string | null;
    data_inicio_execucao: string | null;
    data_fim_execucao: string | null;
    data_envio: string | null;
  };
  execucao?: { orcamento: number | string; executado: number | string; despesas: number };
  metas?: { descricao: string; unidade: string | null; previsto: number | string | null; realizado: number | string | null }[];
  atividades?: { total: number; realizadas: number };
  contrapartidas?: { titulo: string; categoria: string; status: string; prazo: string | null; entregue_em: string | null }[];
  ativacoes?: { titulo: string | null; tipo: string; url: string | null; capturada_em: string | null }[];
  fotos?: { path: string; descricao: string | null; capturada_em: string | null }[];
  aceite?: { em: string; nome: string; comentario: string | null } | null;
};

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
/** Dia de um instante (com hora), no horário de Brasília. */
export const diaEmBrasilia = (instante: string | null | undefined) =>
  (instante ? new Date(instante).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

/** Os marcos que têm data, na ordem do tempo. */
export function marcosDoRelatorio(p: NonNullable<RelatorioPublico["prestacao"]>): { rotulo: string; data: string }[] {
  const marcos: [string, string | null][] = [
    ["Aprovação do projeto", p.data_aprovacao],
    ["Liberação dos recursos", p.data_liberacao],
    ["Início da execução", p.data_inicio_execucao],
    ["Fim da execução", p.data_fim_execucao],
    ["Envio da prestação de contas", p.data_envio],
  ];
  return marcos
    .filter((m): m is [string, string] => Boolean(m[1]))
    .map(([rotulo, data]) => ({ rotulo, data: data.slice(0, 10) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Quanto do orçamento já foi executado; null sem orçamento. */
export function percentualExecutado(e: RelatorioPublico["execucao"]): number | null {
  const orcamento = Number(e?.orcamento) || 0;
  if (orcamento <= 0) return null;
  return Math.min(100, Math.floor(((Number(e?.executado) || 0) / orcamento) * 100));
}

/** Realizado sobre previsto da meta; null quando não dá para dizer. */
export function percentualDaMeta(m: { previsto: number | string | null; realizado: number | string | null }): number | null {
  const previsto = Number(m.previsto);
  if (!Number.isFinite(previsto) || previsto <= 0 || m.realizado === null || m.realizado === undefined) return null;
  return Math.floor((Number(m.realizado) / previsto) * 100);
}

export const ROTULO_DA_CONTRAPARTIDA: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "A entregar", cor: "#6B6B6B" },
  em_andamento: { rotulo: "Em andamento", cor: "#2D72B0" },
  entregue: { rotulo: "Entregue", cor: "#2E8932" },
  aprovado: { rotulo: "Aprovada", cor: "#2E8932" },
  atrasado: { rotulo: "Atrasada", cor: "#B07A14" },
};

export function textoDoPeriodo(r: Pick<RelatorioPublico, "periodo_inicio" | "periodo_fim">): string | null {
  if (r.periodo_inicio && r.periodo_fim) return `De ${dataBr(r.periodo_inicio)} a ${dataBr(r.periodo_fim)}`;
  if (r.periodo_inicio) return `A partir de ${dataBr(r.periodo_inicio)}`;
  if (r.periodo_fim) return `Até ${dataBr(r.periodo_fim)}`;
  return null;
}

/** O que a página confere antes de registrar o aceite (o banco confere de novo). */
export function erroDoAceite(c: { nome: string; comentario: string }): string | null {
  const nome = c.nome.trim();
  if (nome.length < 2) return "Informe seu nome.";
  if (nome.length > 200) return "O nome tem até 200 caracteres.";
  if (c.comentario.trim().length > 2000) return "O comentário tem até 2.000 caracteres.";
  return null;
}

// ─── Na prestação ───────────────────────────────────────────────────────────

export type LinkDoPatrocinador = {
  id: string;
  patrocinador: string;
  expira_em: string;
  revogado_em: string | null;
  visualizacoes: number;
  visto_em: string | null;
  aceite_em: string | null;
  aceite_nome: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  created_at: string;
};

export type SituacaoDoLink = "aceito" | "ativo" | "expirado" | "revogado";

export function situacaoDoLink(l: Pick<LinkDoPatrocinador, "revogado_em" | "expira_em" | "aceite_em">, hoje: string): SituacaoDoLink {
  if (l.revogado_em) return "revogado";
  if (l.aceite_em) return "aceito";
  if (l.expira_em < hoje) return "expirado";
  return "ativo";
}

export function textoDasVisitas(l: Pick<LinkDoPatrocinador, "visualizacoes" | "visto_em">): string {
  if (!l.visualizacoes) return "Ainda não aberto";
  return `${l.visualizacoes} ${l.visualizacoes === 1 ? "visita" : "visitas"}, a última em ${diaEmBrasilia(l.visto_em)}`;
}

export const enderecoDoRelatorio = (origem: string, token: string) => `${origem.replace(/\/$/, "")}/r/${token}`;

/** O que o formulário do link confere antes de chamar o banco. */
export function erroDoLink(c: { patrocinador: string; expiraEm: string; periodoInicio: string; periodoFim: string; mensagem: string }, hoje: string): string | null {
  if (c.patrocinador.trim().length < 2) return "Informe o patrocinador.";
  if (!c.expiraEm || c.expiraEm <= hoje) return "A validade precisa ser uma data futura.";
  const umAno = new Date(`${hoje}T12:00:00Z`);
  umAno.setUTCDate(umAno.getUTCDate() + 366);
  if (c.expiraEm > umAno.toISOString().slice(0, 10)) return "A validade vai até um ano.";
  if (c.periodoInicio && c.periodoFim && c.periodoFim < c.periodoInicio) return "O fim do período não vem antes do início.";
  if (c.mensagem.length > 2000) return "A mensagem tem até 2.000 caracteres.";
  return null;
}
