// O relatório de fim de temporada (plano do módulo, PD9.6, primeiro corte): números da temporada tirados do que a produção já registrou (datas,
// praças, equipe, estrada, convites e ocorrências), e o texto para colar num e-mail ou numa proposta. Sem tela e sem banco. Público e custo por
// espectador entram quando o borderô existir (PD7.4): este relatório não inventa o que ainda não foi registrado.

import type { GravidadeDaOcorrencia, SituacaoDaData, SituacaoDoVoluntario, RespostaDoConvite } from "@/lib/producao/estados";

export type DataDoRelatorio = { id: string; data: string; tipo: string; situacao: SituacaoDaData; uf: string | null; municipio_ibge: string | null; espaco_id: string | null };
export type OcorrenciaDoRelatorio = { data_id: string; gravidade: GravidadeDaOcorrencia; resolvida: boolean };
export type EscalaDoRelatorio = { pessoa_id: string; data_id: string };
export type DeslocamentoDoRelatorio = { odometro_saida_km: number | null; odometro_chegada_km: number | null };
export type ConviteDoRelatorio = { resposta: RespostaDoConvite };
export type VoluntarioDoRelatorio = { situacao: SituacaoDoVoluntario };

export type Relatorio = {
  periodo: { inicio: string | null; fim: string | null };
  datas: { total: number; realizadas: number; confirmadas: number; opcoes: number; canceladas: number; apresentacoes: number; apresentacoesRealizadas: number };
  pracas: { total: number; estados: number };
  equipe: { pessoas: number; escalas: number };
  estrada: { deslocamentos: number; km: number; comOdometro: number };
  convites: { vao: number; naoVao: number; semResposta: number };
  voluntarios: { aprovados: number; inscritos: number };
  ocorrencias: { total: number; abertas: number; altas: number; medias: number; baixas: number };
};

/** A chave da praça de uma data: o município, senão o espaço, senão só o estado. Sem nenhum dos três a data não conta como praça. */
export function chaveDaPraca(data: Pick<DataDoRelatorio, "municipio_ibge" | "espaco_id" | "uf">): string | null {
  if (data.municipio_ibge) return `m:${data.municipio_ibge}`;
  if (data.espaco_id) return `e:${data.espaco_id}`;
  if (data.uf) return `u:${data.uf}`;
  return null;
}

const conta = <T,>(lista: readonly T[], teste: (item: T) => boolean) => lista.filter(teste).length;

/**
 * Os números da temporada. Datas canceladas ficam fora das praças, da equipe, das ocorrências e da estrada (só aparecem na contagem de
 * datas). A estrada soma só os deslocamentos com os dois odômetros e a chegada maior que a saída.
 */
export function montarRelatorio(campos: {
  datas: readonly DataDoRelatorio[]; ocorrencias: readonly OcorrenciaDoRelatorio[]; escalas: readonly EscalaDoRelatorio[];
  deslocamentos: readonly DeslocamentoDoRelatorio[]; convites: readonly ConviteDoRelatorio[]; voluntarios: readonly VoluntarioDoRelatorio[];
}): Relatorio {
  const vivas = campos.datas.filter(data => data.situacao !== "cancelada");
  const idsVivos = new Set(vivas.map(data => data.id));
  const dias = vivas.map(data => data.data).sort();
  const chaves = new Set(vivas.map(chaveDaPraca).filter((chave): chave is string => chave !== null));
  const estados = new Set(vivas.map(data => data.uf).filter((uf): uf is string => !!uf));
  const escalas = campos.escalas.filter(escala => idsVivos.has(escala.data_id));
  const ocorrencias = campos.ocorrencias.filter(ocorrencia => idsVivos.has(ocorrencia.data_id));
  const comOdometro = campos.deslocamentos.filter(item => item.odometro_saida_km !== null && item.odometro_chegada_km !== null && item.odometro_chegada_km > item.odometro_saida_km);
  return {
    periodo: { inicio: dias[0] ?? null, fim: dias[dias.length - 1] ?? null },
    datas: {
      total: campos.datas.length, realizadas: conta(campos.datas, d => d.situacao === "realizada"), confirmadas: conta(campos.datas, d => d.situacao === "confirmada"),
      opcoes: conta(campos.datas, d => d.situacao === "opcao"), canceladas: conta(campos.datas, d => d.situacao === "cancelada"),
      apresentacoes: conta(vivas, d => d.tipo === "apresentacao"), apresentacoesRealizadas: conta(vivas, d => d.tipo === "apresentacao" && d.situacao === "realizada"),
    },
    pracas: { total: chaves.size, estados: estados.size },
    equipe: { pessoas: new Set(escalas.map(escala => escala.pessoa_id)).size, escalas: escalas.length },
    estrada: { deslocamentos: campos.deslocamentos.length, km: comOdometro.reduce((soma, item) => soma + ((item.odometro_chegada_km as number) - (item.odometro_saida_km as number)), 0), comOdometro: comOdometro.length },
    convites: { vao: conta(campos.convites, c => c.resposta === "vou"), naoVao: conta(campos.convites, c => c.resposta === "nao_vou"), semResposta: conta(campos.convites, c => c.resposta === "pendente") },
    voluntarios: { aprovados: conta(campos.voluntarios, v => v.situacao === "aprovado"), inscritos: conta(campos.voluntarios, v => v.situacao === "inscrito") },
    ocorrencias: {
      total: ocorrencias.length, abertas: conta(ocorrencias, o => !o.resolvida), altas: conta(ocorrencias, o => o.gravidade === "alta"),
      medias: conta(ocorrencias, o => o.gravidade === "media"), baixas: conta(ocorrencias, o => o.gravidade === "baixa"),
    },
  };
}

const plural = (n: number, singular: string, pluralDaPalavra: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : pluralDaPalavra}`;
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** O texto do relatório para colar num e-mail ou numa proposta (só o que foi registrado; o que está zerado fica de fora). */
export function textoDoRelatorio(titulo: string, relatorio: Relatorio): string {
  const linhas = [`Relatório de temporada: ${titulo}`];
  if (relatorio.periodo.inicio) linhas.push(`Período: ${dia(relatorio.periodo.inicio)}${relatorio.periodo.fim && relatorio.periodo.fim !== relatorio.periodo.inicio ? ` a ${dia(relatorio.periodo.fim)}` : ""}`);
  const { datas, pracas, equipe, estrada, convites, voluntarios, ocorrencias } = relatorio;
  if (datas.apresentacoes > 0) linhas.push(`Apresentações: ${datas.apresentacoesRealizadas} realizadas de ${datas.apresentacoes} previstas`);
  linhas.push(`Datas: ${datas.total} (${datas.realizadas} realizadas, ${datas.confirmadas} confirmadas, ${datas.opcoes} em opção, ${datas.canceladas} canceladas)`);
  if (pracas.total > 0) linhas.push(`Praças: ${plural(pracas.total, "praça", "praças")}${pracas.estados > 0 ? ` em ${plural(pracas.estados, "estado", "estados")}` : ""}`);
  if (equipe.pessoas > 0) linhas.push(`Equipe: ${plural(equipe.pessoas, "pessoa escalada", "pessoas escaladas")} em ${plural(equipe.escalas, "escala", "escalas")}`);
  if (estrada.comOdometro > 0) linhas.push(`Estrada: ${Math.round(estrada.km).toLocaleString("pt-BR")} km rodados em ${plural(estrada.comOdometro, "deslocamento", "deslocamentos")} com odômetro registrado`);
  if (convites.vao + convites.naoVao + convites.semResposta > 0) linhas.push(`Convites: ${convites.vao} ${convites.vao === 1 ? "confirmou" : "confirmaram"} presença, ${convites.naoVao} não vão, ${convites.semResposta} sem resposta`);
  if (voluntarios.aprovados > 0) linhas.push(`Voluntários: ${plural(voluntarios.aprovados, "aprovado", "aprovados")}`);
  linhas.push(ocorrencias.total === 0 ? "Ocorrências: nenhuma registrada" : `Ocorrências: ${ocorrencias.total} (${ocorrencias.altas} de gravidade alta, ${ocorrencias.abertas} ainda em aberto)`);
  return linhas.join("\n");
}
