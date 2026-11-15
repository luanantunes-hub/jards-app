// O histórico da data (plano do módulo, PD1.6): transforma as linhas de `producao_historico` em frases
// curtas ("Mudou a situação de opcao para confirmada"). Sem tela e sem banco.

import type { AcaoDoHistorico } from "@/lib/producao/estados";

export type LinhaDoHistorico = {
  id: number; entidade: string; acao: AcaoDoHistorico; campo: string | null; antes: string | null; depois: string | null; quando: string;
};

const COISA: Record<string, string> = {
  producao_datas: "a data",
  producao_blocos: "um bloco do dia",
  producao_escalas: "uma escala",
  producao_cartoes_dia: "um cartão de viagem ou hospedagem",
  producao_tarefas: "uma tarefa",
  // A linha do tempo da organização (PD8.4) mostra todas as tabelas com histórico.
  producao_obras: "uma obra", producao_temporadas: "uma temporada", producao_notas: "uma nota", producao_modelos_dia: "um modelo de dia",
  producao_espacos: "um espaço", producao_salas: "uma sala", producao_pautas: "uma pauta", producao_sessoes: "uma sessão da programação",
  producao_itens: "um item do inventário", producao_plantas: "uma planta", producao_riders: "um rider", producao_equipamentos: "um equipamento",
  producao_licencas: "uma licença", producao_setores: "um setor da plateia", producao_setor_cotas: "uma cota de plateia", producao_expografia: "uma obra na exposição", producao_borderos: "um borderô",
  producao_pessoas: "uma pessoa da equipe", producao_vinculos: "um vínculo da equipe", producao_turnos: "um turno", producao_funcoes: "uma permissão",
  producao_voluntarios: "um voluntário", producao_veiculos: "um veículo", producao_deslocamentos: "um deslocamento", producao_hospedagens: "uma hospedagem",
  producao_convites: "um convite de presença", producao_convidados: "um convidado", producao_credencial_tipos: "um tipo de credencial",
  producao_acessibilidade: "um recurso de acessibilidade", producao_visitas_horarios: "um horário de visita", producao_visitas_agendamentos: "um agendamento de visita",
  producao_turmas: "uma turma", producao_turma_aulas: "uma aula", producao_matriculas: "uma matrícula",
  producao_acertos: "um acerto técnico", producao_modelos_acerto: "um modelo de acerto", producao_sites: "um site", producao_site_paginas: "uma página de site",
  producao_arquivos: "um arquivo", producao_ocorrencias: "uma ocorrência",
};

const CAMPO: Record<string, string> = {
  situacao: "a situação", data: "o dia", data_fim: "o último dia", uf: "o estado", fuso: "o fuso", titulo: "o título", tipo: "o tipo",
  inicio: "o início", fim: "o fim", exibicao: "a forma da hora", confirmado: "a confirmação", notas: "as notas", capacidade: "a capacidade",
  funcao: "a função", chamada: "a chamada", saida: "a saída", confirmacao: "a resposta", endereco: "o endereço", prazo: "o prazo",
  prazo_dias: "o prazo em dias", responsavel_pessoa_id: "quem faz", espaco_id: "o espaço", sala_id: "a sala", ordem: "a ordem",
  nome: "o nome", lugares: "os lugares", quantidade: "a quantidade", pessoas: "as pessoas", resposta: "a resposta", categoria: "a categoria",
  vagas: "as vagas", presentes: "quantos vieram", certificado_emitido_em: "o certificado", pessoa_id: "a pessoa", hotel: "o hotel", dia: "o dia",
  grupo: "o grupo", capacidade_carga_kg: "a carga", arquivado: "o arquivamento", iniciado_em: "quando começou", terminado_em: "quando terminou",
};

export function rotuloDaEntidade(entidade: string): string {
  return COISA[entidade] ?? "um registro";
}

const FORMATO_DA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** O valor como a pessoa lê: dia "17/11/2026", momento "13/11/2026 19:30" (horário de Brasília), "true" e "false" como "sim" e "não". O resto fica como veio. */
export function valorLegivel(texto: string): string {
  if (texto === "true") return "sim";
  if (texto === "false") return "não";
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(texto)) {
    const momento = new Date(texto);
    if (!Number.isNaN(momento.getTime())) return FORMATO_DA_HORA.format(momento).replace(",", "");
  }
  return texto;
}

function valor(texto: string | null): string {
  return texto === null || texto === "" ? "vazio" : valorLegivel(texto);
}

/** "Criou uma tarefa: Assinar o contrato", "Mudou a situação de aberta para feita", "Apagou um bloco do dia: Abertura". */
export function fraseDoHistorico(linha: Pick<LinhaDoHistorico, "entidade" | "acao" | "campo" | "antes" | "depois">): string {
  const coisa = rotuloDaEntidade(linha.entidade);
  if (linha.acao === "criou") return linha.depois ? `Criou ${coisa}: ${valorLegivel(linha.depois)}` : `Criou ${coisa}`;
  if (linha.acao === "apagou") return linha.antes ? `Apagou ${coisa}: ${valorLegivel(linha.antes)}` : `Apagou ${coisa}`;
  const campo = linha.campo ? (CAMPO[linha.campo] ?? `o campo ${linha.campo.replace(/_/g, " ")}`) : "algo";
  const onde = linha.entidade === "producao_datas" ? "" : ` em ${coisa}`;
  return `Mudou ${campo}${onde} de ${valor(linha.antes)} para ${valor(linha.depois)}`;
}
