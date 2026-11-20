// O retorno de uma marca (plano do módulo, PD9.3, primeiro corte): o que a marca teve de volta nas sessões que apresentou: quantas sessões, quantas já
// aconteceram e quantas estão por vir, e o período. Só leitura, só para a produção: nada disso sai para o parceiro. Sem tela e sem banco.
// O público (que vinha do borderô e da porta) saiu com a T1 da Ticketeria (18/11/2026): a contagem de público passa a ser da Ticketeria.

export type SessaoDoRetorno = { id: string; dia: string; titulo: string };

export type LinhaDoRetorno = { id: string; dia: string; titulo: string; aconteceu: boolean };
export type RetornoDaMarca = {
  sessoes: number; realizadas: number; proximas: number;
  primeiraSessao: string | null; ultimaSessao: string | null;
  linhas: LinhaDoRetorno[];
};

/** Os números da marca. Sessão que já aconteceu é a de hoje ou de antes (`hoje` em AAAA-MM-DD). */
export function retornoDaMarca(sessoes: readonly SessaoDoRetorno[], hoje: string): RetornoDaMarca {
  const linhas = [...sessoes]
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.titulo.localeCompare(b.titulo, "pt-BR"))
    .map(sessao => ({ id: sessao.id, dia: sessao.dia, titulo: sessao.titulo, aconteceu: sessao.dia <= hoje }));
  const realizadas = linhas.filter(linha => linha.aconteceu).length;
  return {
    sessoes: linhas.length, realizadas, proximas: linhas.length - realizadas,
    primeiraSessao: linhas[0]?.dia ?? null, ultimaSessao: linhas[linhas.length - 1]?.dia ?? null,
    linhas,
  };
}

const numero = (n: number) => n.toLocaleString("pt-BR");
const dia = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

/** O texto para colar num e-mail ao patrocinador: só o que foi registrado ("3 sessões apresentadas, 2 já realizadas, 1 por vir"). */
export function textoDoRetorno(nomeDaMarca: string, retorno: RetornoDaMarca): string {
  if (retorno.sessoes === 0) return `${nomeDaMarca}: ainda não apresentou nenhuma sessão.`;
  const partes: string[] = [];
  partes.push(`${numero(retorno.sessoes)} ${retorno.sessoes === 1 ? "sessão apresentada" : "sessões apresentadas"}`);
  if (retorno.realizadas > 0) partes.push(`${numero(retorno.realizadas)} ${retorno.realizadas === 1 ? "já realizada" : "já realizadas"}`);
  if (retorno.proximas > 0) partes.push(`${numero(retorno.proximas)} por vir`);
  const linhas = [`${nomeDaMarca}: ${partes.join(", ")}.`];
  if (retorno.primeiraSessao && retorno.ultimaSessao) linhas.push(retorno.primeiraSessao === retorno.ultimaSessao ? `Dia ${dia(retorno.primeiraSessao)}.` : `De ${dia(retorno.primeiraSessao)} a ${dia(retorno.ultimaSessao)}.`);
  return linhas.join("\n");
}
