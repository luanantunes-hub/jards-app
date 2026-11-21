// A conta do calendário do mês do onboarding da Ticketeria (escolha do dia, sempre aberto na tela). Datas como texto AAAA-MM-DD, sem fuso:
// "hoje" vem de fora (hojeEmBrasilia). Sem React: roda nos testes (tests/ticketeria-comecar.test.ts).

export const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
/** A semana começa no domingo, como no calendário brasileiro de parede. */
export const INICIAIS_DOS_DIAS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
export const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

const dois = (n: number) => String(n).padStart(2, "0");
export const textoDaData = (ano: number, mes: number, dia: number) => `${ano}-${dois(mes + 1)}-${dois(dia)}`;

/** Ano e mês (0 a 11) de uma data AAAA-MM-DD. */
export function mesDaData(data: string): { ano: number; mes: number } {
  const [ano, mes] = data.split("-").map(Number);
  return { ano, mes: mes - 1 };
}

/** O mês antes ou depois (`passo` de -1 ou 1), virando o ano quando for preciso. */
export function somarMeses(ano: number, mes: number, passo: number): { ano: number; mes: number } {
  const total = ano * 12 + mes + passo;
  return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

export type DiaDoCalendario = { data: string; dia: number; passou: boolean; hoje: boolean };

/** As semanas do mês: cada uma com 7 posições (null onde o dia é de outro mês), a primeira começando no domingo. */
export function semanasDoMes(ano: number, mes: number, hoje: string): (DiaDoCalendario | null)[][] {
  const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const total = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const celulas: (DiaDoCalendario | null)[] = Array.from({ length: primeiro }, () => null);
  for (let dia = 1; dia <= total; dia++) {
    const data = textoDaData(ano, mes, dia);
    celulas.push({ data, dia, passou: data < hoje, hoje: data === hoje });
  }
  while (celulas.length % 7 !== 0) celulas.push(null);
  return Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
}

/** "domingo, 20 de dezembro de 2026". */
export function dataPorExtenso(data: string): string {
  const { ano, mes } = mesDaData(data);
  const dia = Number(data.slice(8, 10));
  const semana = new Date(Date.UTC(ano, mes, dia)).getUTCDay();
  return `${NOMES_DOS_DIAS[semana]}, ${dia} de ${NOMES_DOS_MESES[mes]} de ${ano}`;
}

/** Os dias de `de` até `ate` (AAAA-MM-DD, os dois incluídos), em ordem; vazio se `ate` vem antes de `de`. */
export function diasEntre(de: string, ate: string): string[] {
  const saida: string[] = [];
  const fim = Date.parse(`${ate}T00:00:00Z`);
  for (let t = Date.parse(`${de}T00:00:00Z`); t <= fim && saida.length < 400; t += 86_400_000) saida.push(new Date(t).toISOString().slice(0, 10));
  return saida;
}

/** Marca ou desmarca um dia; com `ate` (o clique com Shift), marca todos os dias de um ao outro (os que já passaram ficam de fora). Devolve a lista em ordem. */
export function alternarDia(datas: readonly string[], dia: string, opcoes: { ate?: string; hoje: string }): string[] {
  const conjunto = new Set(datas);
  if (opcoes.ate && opcoes.ate !== dia) {
    const [de, ate] = dia < opcoes.ate ? [dia, opcoes.ate] : [opcoes.ate, dia];
    for (const d of diasEntre(de, ate)) if (d >= opcoes.hoje) conjunto.add(d);
  } else if (conjunto.has(dia)) conjunto.delete(dia);
  else conjunto.add(dia);
  return [...conjunto].sort();
}

/** "domingo, 20 de dezembro de 2026" para um dia; "3 dias: 20, 21 e 27 de dezembro" para vários (mês a mês quando atravessam meses). */
export function resumoDasDatas(datas: readonly string[]): string {
  const ordenadas = [...datas].sort();
  if (ordenadas.length === 0) return "";
  if (ordenadas.length === 1) return dataPorExtenso(ordenadas[0]);
  const porMes = new Map<string, number[]>();
  for (const d of ordenadas) porMes.set(d.slice(0, 7), [...(porMes.get(d.slice(0, 7)) ?? []), Number(d.slice(8, 10))]);
  const partes = [...porMes.entries()].map(([mes, dias]) => {
    const lista = dias.length > 1 ? `${dias.slice(0, -1).join(", ")} e ${dias[dias.length - 1]}` : String(dias[0]);
    return `${lista} de ${NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1]}`;
  });
  return `${ordenadas.length} dias: ${partes.join(" · ")}`;
}
