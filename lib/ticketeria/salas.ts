// As salas de um espaço: um cinema tem 2 a 6, um teatro costuma ter uma só. Todo espaço nasce com uma sala ("Sala única"); setor e sessão são de uma sala.
// Funções puras para as telas: quais salas mostrar, como rotular um setor, qual o nome da próxima sala.

export type SalaDoEspaco = { id: string; local_id: string; nome: string; ordem: number; arquivado: boolean };

export const NOME_DA_SALA_PADRAO = "Sala única";

/** As salas em uso de um espaço, na ordem (mais a sala que já está escolhida, mesmo arquivada, para não sumir de quem a usa). */
export function salasDoEspaco(salas: readonly SalaDoEspaco[], localId: string, manter?: string | null): SalaDoEspaco[] {
  return salas.filter(sala => sala.local_id === localId && (!sala.arquivado || sala.id === manter)).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O espaço tem mais de uma sala em uso: só então a sala aparece nas telas (com uma só, ela é o próprio espaço). */
export function temVariasSalas(salas: readonly SalaDoEspaco[], localId: string): boolean {
  return salas.filter(sala => sala.local_id === localId && !sala.arquivado).length > 1;
}

/** "Cinema · Sala 2 · Plateia" (a sala só entra quando o espaço tem várias). */
export function rotuloDoSetor(partes: { espaco?: string | null; sala?: string | null; setor?: string | null; variasSalas: boolean }): string {
  return [partes.espaco ?? "Local", partes.variasSalas ? partes.sala : null, partes.setor].filter(Boolean).join(" · ");
}

/** O nome de uma sala nova: "Sala 2", "Sala 3"... o primeiro número que ainda não existe no espaço. */
export function proximoNomeDeSala(nomes: readonly string[]): string {
  const usados = new Set(nomes.map(nome => nome.trim().toLowerCase()));
  for (let n = Math.max(2, nomes.length + 1); n <= 99; n += 1) if (!usados.has(`sala ${n}`)) return `Sala ${n}`;
  return `Sala ${nomes.length + 1}`;
}

/** Ao ganhar a segunda sala, a "Sala única" passa a se chamar "Sala 1" (só se ainda tem o nome padrão). */
export function nomeDaPrimeiraAoDividir(nome: string): string {
  return nome.trim().toLowerCase() === NOME_DA_SALA_PADRAO.toLowerCase() ? "Sala 1" : nome;
}

/** A sala de uma sessão nova: a escolhida, se for do espaço; senão a primeira em uso. */
export function salaDaSessao(salas: readonly SalaDoEspaco[], localId: string, escolhida?: string | null): string {
  const doEspaco = salasDoEspaco(salas, localId, escolhida);
  return doEspaco.find(sala => sala.id === escolhida)?.id ?? doEspaco[0]?.id ?? "";
}

/** Lê o nome digitado para uma sala. */
export function lerNomeDaSala(texto: string): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = texto.trim();
  if (nome === "") return { ok: false, erro: "Dê um nome à sala." };
  if (nome.length > 120) return { ok: false, erro: "O nome da sala passa de 120 letras." };
  return { ok: true, nome };
}
