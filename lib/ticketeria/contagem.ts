// A conta da contagem regressiva do site: quantos dias, horas e minutos faltam para um instante. Sem tela e sem servidor (roda no navegador e nos testes).

export type PartesDaContagem = { dias: number; horas: number; minutos: number };

/** O que falta de `agora` até `alvo` (ambos em milissegundos), arredondando os minutos para BAIXO; nulo se o instante já passou (ou chegou). */
export function partesDaContagem(alvo: number, agora: number): PartesDaContagem | null {
  if (!Number.isFinite(alvo) || !Number.isFinite(agora) || alvo <= agora) return null;
  const minutosTotais = Math.floor((alvo - agora) / 60_000);
  return { dias: Math.floor(minutosTotais / 1440), horas: Math.floor((minutosTotais % 1440) / 60), minutos: minutosTotais % 60 };
}

/** A hora do servidor em milissegundos: a página a passa ao site, para a primeira pintura da contagem bater com a do navegador. */
export const agoraDoServidor = (): number => Date.now();
