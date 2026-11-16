// A linha do tempo da organização (plano do módulo, PD8.4, primeiro corte): tudo o que mudou na produção, do mais novo ao mais velho, filtrado
// por área e por período e lido de página em página. Sem tela e sem banco.

export type AreaDaLinhaDoTempo = { id: string; nome: string; entidades: readonly string[] };

/**
 * As áreas em que as tabelas com histórico se agrupam. Toda tabela da produção com gatilho de histórico precisa estar em exatamente uma
 * (um teste confere contra as migrations): tabela nova sem área não apareceria no filtro.
 */
export const AREAS_DA_LINHA_DO_TEMPO: readonly AreaDaLinhaDoTempo[] = [
  { id: "agenda", nome: "Agenda e temporadas", entidades: ["producao_obras", "producao_temporadas", "producao_datas", "producao_blocos", "producao_tarefas", "producao_notas", "producao_modelos_dia", "producao_cartoes_dia"] },
  { id: "espacos", nome: "Espaços e técnica", entidades: ["producao_espacos", "producao_salas", "producao_pautas", "producao_sessoes", "producao_itens", "producao_plantas", "producao_riders", "producao_equipamentos", "producao_licencas", "producao_setores", "producao_setor_cotas", "producao_expografia"] },
  { id: "equipe", nome: "Equipe", entidades: ["producao_pessoas", "producao_vinculos", "producao_escalas", "producao_turnos", "producao_funcoes", "producao_voluntarios"] },
  { id: "logistica", nome: "Logística", entidades: ["producao_veiculos", "producao_deslocamentos", "producao_hospedagens", "producao_convites"] },
  { id: "publico", nome: "Convidados e público", entidades: ["producao_convidados", "producao_credencial_tipos", "producao_acessibilidade", "producao_visitas_horarios", "producao_visitas_agendamentos", "producao_borderos", "producao_turmas", "producao_turma_aulas", "producao_matriculas"] },
  { id: "acertos", nome: "Acertos, sites e arquivos", entidades: ["producao_acertos", "producao_modelos_acerto", "producao_sites", "producao_site_paginas", "producao_arquivos", "producao_documentos", "producao_ocorrencias"] },
];

/** As entidades de uma área; área vazia ou desconhecida = todas (sem filtro). */
export function entidadesDaArea(areaId: string): readonly string[] | null {
  return AREAS_DA_LINHA_DO_TEMPO.find(area => area.id === areaId)?.entidades ?? null;
}

export const PERIODOS_DA_LINHA_DO_TEMPO = [
  { id: "7", nome: "Últimos 7 dias", dias: 7 }, { id: "30", nome: "Últimos 30 dias", dias: 30 }, { id: "90", nome: "Últimos 90 dias", dias: 90 }, { id: "tudo", nome: "Todo o período", dias: null },
] as const;

/** O instante (ISO) a partir do qual o período vale, ou null para todo o período. */
export function inicioDoPeriodo(periodoId: string, agora: number): string | null {
  const dias = PERIODOS_DA_LINHA_DO_TEMPO.find(periodo => periodo.id === periodoId)?.dias ?? null;
  return dias === null ? null : new Date(agora - dias * 24 * 3600 * 1000).toISOString();
}

/** Quantas linhas vêm de cada vez. A consulta pede uma a mais para saber se há mais páginas. */
export const TAMANHO_DA_PAGINA = 50;

/** O intervalo (inclusivo) que o servidor devolve para a página `pagina` (começa em 0): uma linha a mais que o tamanho, só para saber se continua. */
export function intervaloDaPagina(pagina: number): { de: number; ate: number } {
  const de = Math.max(pagina, 0) * TAMANHO_DA_PAGINA;
  return { de, ate: de + TAMANHO_DA_PAGINA };
}

/** Separa as linhas de uma página: as que se mostram e se há mais (a linha extra pedida a mais indica que sim). */
export function recortarPagina<T>(linhas: readonly T[]): { mostrar: T[]; temMais: boolean } {
  return { mostrar: linhas.slice(0, TAMANHO_DA_PAGINA), temMais: linhas.length > TAMANHO_DA_PAGINA };
}

/** Agrupa as linhas por dia (no horário de quem lê), do mais novo ao mais velho, para a tela mostrar o dia como título. */
export function agruparPorDia<T extends { quando: string }>(linhas: readonly T[]): { dia: string; linhas: T[] }[] {
  const grupos: { dia: string; linhas: T[] }[] = [];
  for (const linha of linhas) {
    const data = new Date(linha.quando);
    const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.linhas.push(linha);
    else grupos.push({ dia, linhas: [linha] });
  }
  return grupos;
}

export type MembroDaLinhaDoTempo = { user_id: string; full_name: string | null };

/** O nome de quem fez a mudança, pelos membros da organização; vazio se a linha não guarda quem (rotina do sistema) ou se a pessoa saiu da organização. */
export function nomeDeQuemFez(quem: string | null | undefined, membros: readonly MembroDaLinhaDoTempo[]): string {
  if (!quem) return "";
  return membros.find(membro => membro.user_id === quem)?.full_name?.trim() ?? "";
}

/** As pessoas do filtro: só quem tem nome, em ordem alfabética. */
export function pessoasDoFiltro(membros: readonly MembroDaLinhaDoTempo[]): { id: string; nome: string }[] {
  return membros
    .filter((membro): membro is { user_id: string; full_name: string } => Boolean(membro.full_name?.trim()))
    .map(membro => ({ id: membro.user_id, nome: membro.full_name.trim() }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
