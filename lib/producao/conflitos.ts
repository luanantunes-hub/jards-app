// Os conflitos da escala (plano do módulo, PD1.10): a mesma pessoa em dois lugares ao mesmo
// tempo, inclusive entre temporadas. Sem tela e sem banco: a página da data junta as escalas e
// chama isto.
//
// Só entram as escalas que quem consulta vê (o banco aplica o recorte): quem tem o recorte "só
// onde está vinculado" não vê a escala da outra temporada, e o aviso não aparece para ele. Dizer
// "ocupado" a quem não vê a outra temporada pede uma função no banco (fn_producao_conflitos), que
// fica para depois, como o descanso mínimo entre a saída e a próxima chamada e a sala com duas
// confirmações.

export type EscalaComPeriodo = {
  id: string;
  pessoaId: string;
  dataId: string;
  /** O dia da data e o último dia, quando ela dura mais de um (aaaa-mm-dd, no lugar da data). */
  dia: string;
  diaFim: string | null;
  /** A chamada e a saída, em ISO. Sem as duas, a escala ocupa os dias da data inteiros. */
  chamada: string | null;
  saida: string | null;
};

/** As duas escalas se cruzam? Com chamada e saída nas duas, pelo horário (encostar não cruza); senão, pelos dias. */
export function cruzam(a: EscalaComPeriodo, b: EscalaComPeriodo): boolean {
  if (a.chamada && a.saida && b.chamada && b.saida) {
    return Date.parse(a.chamada) < Date.parse(b.saida) && Date.parse(b.chamada) < Date.parse(a.saida);
  }
  return a.dia <= (b.diaFim ?? b.dia) && b.dia <= (a.diaFim ?? a.dia);
}

/**
 * Para cada escala da data, as escalas da mesma pessoa em outras datas que se cruzam com ela, em
 * ordem de dia e de chamada. A própria data não conta: a pessoa tem uma escala só por data.
 */
export function conflitosDasEscalas(daData: readonly EscalaComPeriodo[], outras: readonly EscalaComPeriodo[]): Map<string, EscalaComPeriodo[]> {
  const conflitos = new Map<string, EscalaComPeriodo[]>();
  for (const escala of daData) {
    const batem = outras
      .filter(outra => outra.pessoaId === escala.pessoaId && outra.dataId !== escala.dataId && cruzam(escala, outra))
      .sort((a, b) => a.dia.localeCompare(b.dia) || (a.chamada ?? "").localeCompare(b.chamada ?? ""));
    if (batem.length > 0) conflitos.set(escala.id, batem);
  }
  return conflitos;
}
