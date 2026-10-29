// Filtros das negociações e das inscrições que valem nas três visões (lista,
// kanban e potencial): responsável, tipo de patrocínio e projeto. A etapa não
// entra aqui: no kanban as colunas já são as etapas, então o filtro de etapa
// fica só na lista e no potencial.
//
// Cada filtro olha os "marcadores" do item (a pessoa, a lei, o projeto). As
// opções saem dos itens carregados, com a contagem, e "sem" aparece quando
// algum item não tem o marcador.

export const TODOS = "todos";
export const SEM = "sem";

export type Marcador = { valor: string; nome: string };
export type OpcaoDeFiltro = { valor: string; nome: string; quantos: number };

/** Opções do filtro: só o que aparece nos itens, em ordem alfabética, e "sem" no fim. */
export function opcoesDoFiltro<T>(
  itens: readonly T[],
  marcadores: (item: T) => readonly Marcador[],
  rotuloSem: string,
): OpcaoDeFiltro[] {
  const porValor = new Map<string, OpcaoDeFiltro>();
  let semMarcador = 0;
  for (const item of itens) {
    const doItem = marcadores(item);
    if (doItem.length === 0) semMarcador += 1;
    // O mesmo marcador duas vezes no item (captador e supervisor iguais) conta uma vez.
    for (const valor of new Set(doItem.map(m => m.valor))) {
      const marcador = doItem.find(m => m.valor === valor)!;
      const atual = porValor.get(valor);
      if (atual) atual.quantos += 1;
      else porValor.set(valor, { valor, nome: marcador.nome, quantos: 1 });
    }
  }
  const opcoes = [...porValor.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return semMarcador > 0 ? [...opcoes, { valor: SEM, nome: rotuloSem, quantos: semMarcador }] : opcoes;
}

export function passaNoFiltro<T>(item: T, filtro: string, marcadores: (item: T) => readonly Marcador[]): boolean {
  if (filtro === TODOS) return true;
  const doItem = marcadores(item);
  if (filtro === SEM) return doItem.length === 0;
  return doItem.some(m => m.valor === filtro);
}

/**
 * O filtro só aparece quando há escolha: duas opções ou mais. Um filtro já
 * aplicado continua visível, para a pessoa conseguir desfazer.
 */
export function mostraFiltro(opcoes: readonly OpcaoDeFiltro[], filtro: string): boolean {
  return opcoes.length > 1 || filtro !== TODOS;
}
