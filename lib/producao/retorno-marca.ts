// O retorno de uma marca (plano do módulo, PD9.3, primeiro corte): o que a marca teve de volta nas sessões que apresentou: quantas sessões, quantas já
// aconteceram, o público (o oficial do borderô: o que a casa contou, senão o que a porta registrou) e quantas entradas passaram pela porta com credencial.
// Só leitura, só para a produção: nada disso sai para o parceiro (o portal e o link do patrocinador vêm depois). Sem tela e sem banco.

import { publicoDoBordero } from "@/lib/producao/bordero";
import type { ResultadoDaLeitura } from "@/lib/producao/estados";

export type SessaoDoRetorno = { id: string; dia: string; titulo: string };
export type BorderoDoRetorno = { sessao_id: string; publico_casa: number | null };
export type LeituraDoRetorno = { sessao_id: string; resultado: ResultadoDaLeitura };

export type LinhaDoRetorno = { id: string; dia: string; titulo: string; aconteceu: boolean; publico: number | null; entradasPelaPorta: number };
export type RetornoDaMarca = {
  sessoes: number; realizadas: number; proximas: number;
  /** Soma do público oficial das sessões que já aconteceram e têm público; quantas dessas têm público e quantas ficaram sem. */
  publico: number; comPublico: number; semPublico: number;
  entradasPelaPorta: number;
  primeiraSessao: string | null; ultimaSessao: string | null;
  linhas: LinhaDoRetorno[];
};

/**
 * Os números da marca. Sessão que já aconteceu é a de hoje ou de antes (`hoje` em AAAA-MM-DD). O público de cada uma vem de `publicoDoBordero` (a casa vale mais
 * que a porta); só entra na soma o que já aconteceu, e a sessão que aconteceu sem público fica contada à parte (nada é inventado). As entradas pela porta contam as
 * leituras "permitido".
 */
export function retornoDaMarca(
  sessoes: readonly SessaoDoRetorno[], borderos: readonly BorderoDoRetorno[], leituras: readonly LeituraDoRetorno[], hoje: string,
): RetornoDaMarca {
  const casa = new Map(borderos.map(bordero => [bordero.sessao_id, bordero.publico_casa]));
  const porta = new Map<string, number>();
  for (const leitura of leituras) if (leitura.resultado === "permitido") porta.set(leitura.sessao_id, (porta.get(leitura.sessao_id) ?? 0) + 1);
  const ordenadas = [...sessoes].sort((a, b) => a.dia.localeCompare(b.dia) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  const linhas = ordenadas.map(sessao => {
    const entradas = porta.get(sessao.id) ?? 0;
    return {
      id: sessao.id, dia: sessao.dia, titulo: sessao.titulo, aconteceu: sessao.dia <= hoje, entradasPelaPorta: entradas,
      // sessão que ainda não aconteceu não tem público para contar, mesmo que alguma leitura de teste exista
      publico: sessao.dia <= hoje ? publicoDoBordero(casa.get(sessao.id) ?? null, entradas).oficial : null,
    };
  });
  const aconteceram = linhas.filter(linha => linha.aconteceu);
  const comPublico = aconteceram.filter(linha => linha.publico !== null);
  return {
    sessoes: linhas.length, realizadas: aconteceram.length, proximas: linhas.length - aconteceram.length,
    publico: comPublico.reduce((soma, linha) => soma + (linha.publico ?? 0), 0), comPublico: comPublico.length, semPublico: aconteceram.length - comPublico.length,
    entradasPelaPorta: aconteceram.reduce((soma, linha) => soma + linha.entradasPelaPorta, 0),
    primeiraSessao: linhas[0]?.dia ?? null, ultimaSessao: linhas[linhas.length - 1]?.dia ?? null,
    linhas,
  };
}

const numero = (n: number) => n.toLocaleString("pt-BR");
const dia = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

/**
 * O texto para colar num e-mail ao patrocinador: só o que foi registrado ("3 sessões, 2 já realizadas, 1.250 pessoas de público"). O que está zerado ou
 * sem registro fica de fora, e o que ainda falta é dito (sessão realizada sem público contado).
 */
export function textoDoRetorno(nomeDaMarca: string, retorno: RetornoDaMarca): string {
  if (retorno.sessoes === 0) return `${nomeDaMarca}: ainda não apresentou nenhuma sessão.`;
  const partes: string[] = [];
  partes.push(`${numero(retorno.sessoes)} ${retorno.sessoes === 1 ? "sessão apresentada" : "sessões apresentadas"}`);
  if (retorno.realizadas > 0) partes.push(`${numero(retorno.realizadas)} ${retorno.realizadas === 1 ? "já realizada" : "já realizadas"}`);
  if (retorno.proximas > 0) partes.push(`${numero(retorno.proximas)} por vir`);
  const linhas = [`${nomeDaMarca}: ${partes.join(", ")}.`];
  if (retorno.primeiraSessao && retorno.ultimaSessao) linhas.push(retorno.primeiraSessao === retorno.ultimaSessao ? `Dia ${dia(retorno.primeiraSessao)}.` : `De ${dia(retorno.primeiraSessao)} a ${dia(retorno.ultimaSessao)}.`);
  if (retorno.comPublico > 0) linhas.push(`Público: ${numero(retorno.publico)} ${retorno.publico === 1 ? "pessoa" : "pessoas"}${retorno.semPublico > 0 ? `, sem contar ${numero(retorno.semPublico)} ${retorno.semPublico === 1 ? "sessão sem público informado" : "sessões sem público informado"}` : ""}.`);
  if (retorno.entradasPelaPorta > 0) linhas.push(`${numero(retorno.entradasPelaPorta)} ${retorno.entradasPelaPorta === 1 ? "entrada" : "entradas"} com credencial na porta.`);
  return linhas.join("\n");
}
