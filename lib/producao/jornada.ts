// A jornada do motorista (plano do módulo, PD6.5, primeiro corte): avisa quando um motorista dirige mais de 5h30 sem uma pausa de
// 30 minutos. Só avisa, não impede. Sem tela e sem banco.
//
// A regra: o Código de Trânsito, art. 67-C (com a redação da Lei 13.103/2015), veda ao motorista profissional de transporte
// rodoviário de cargas ou coletivo de passageiros dirigir por mais de cinco horas e meia ininterruptas; depois disso, a pausa é de
// 30 minutos. Ficam de fora, de propósito, o descanso diário de 11 horas e os limites de jornada: não foram confirmados em fonte
// oficial e o STF declarou inconstitucionais partes da Lei 13.103 (ADI 5.322). Quem decide o que vale para a equipe é o jurídico
// ou o sindicato; o aviso é uma referência para o planejamento.

/** Tempo de direção ininterrupto máximo, em minutos (5h30). */
export const LIMITE_DE_DIRECAO_MIN = 5 * 60 + 30;
/** A pausa que reinicia a contagem, em minutos. */
export const PAUSA_MINIMA_MIN = 30;

export type DeslocamentoParaJornada = { id: string; motorista_id: string | null; saida: string | null; chegada: string | null };

const MINUTO = 60_000;

export const duracaoEmTexto = (minutos: number) => {
  const horas = Math.floor(minutos / 60), resto = Math.round(minutos % 60);
  return resto === 0 ? `${horas} h` : horas === 0 ? `${resto} min` : `${horas} h ${resto} min`;
};

/**
 * Para cada motorista, junta os deslocamentos seguidos (o próximo começa menos de 30 minutos depois de o anterior terminar, então
 * não houve pausa que valha) e soma o tempo de direção. Se passa de 5h30, devolve um aviso para cada deslocamento do trecho.
 * Deslocamento sem saída, sem chegada ou sem motorista não entra na conta.
 */
export function avisosDeJornada(itens: readonly DeslocamentoParaJornada[], nomesDePessoa: ReadonlyMap<string, string>): Map<string, string[]> {
  const avisos = new Map<string, string[]>();
  const porMotorista = new Map<string, { id: string; inicio: number; fim: number }[]>();
  for (const item of itens) {
    if (!item.motorista_id || !item.saida || !item.chegada) continue;
    const inicio = Date.parse(item.saida), fim = Date.parse(item.chegada);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) continue;
    porMotorista.set(item.motorista_id, [...(porMotorista.get(item.motorista_id) ?? []), { id: item.id, inicio, fim }]);
  }
  for (const [motorista, lista] of porMotorista) {
    const ordenados = [...lista].sort((a, b) => a.inicio - b.inicio);
    let trecho: typeof ordenados = [];
    const fechar = () => {
      const direcao = trecho.reduce((soma, parte) => soma + (parte.fim - parte.inicio) / MINUTO, 0);
      if (direcao > LIMITE_DE_DIRECAO_MIN) {
        const nome = nomesDePessoa.get(motorista) ?? "O motorista";
        const aviso = `${nome} dirige ${duracaoEmTexto(direcao)} sem uma pausa de ${PAUSA_MINIMA_MIN} minutos; o Código de Trânsito (art. 67-C) veda mais de ${duracaoEmTexto(LIMITE_DE_DIRECAO_MIN)} ininterruptas. Planeje uma parada ou outro motorista.`;
        for (const parte of trecho) avisos.set(parte.id, [...(avisos.get(parte.id) ?? []), aviso]);
      }
      trecho = [];
    };
    for (const parte of ordenados) {
      const anterior = trecho[trecho.length - 1];
      if (anterior && (parte.inicio - anterior.fim) / MINUTO >= PAUSA_MINIMA_MIN) fechar();
      trecho.push(parte);
    }
    fechar();
  }
  return avisos;
}
