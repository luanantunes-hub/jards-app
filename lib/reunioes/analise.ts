export type TrechoDaTranscricao = {
  id: string;
  falante: string | null;
  texto: string;
  inicio_ms: number;
  fim_ms: number | null;
};

export type Falante = { nome: string; ms: number; falas: number; parcela: number };

export type EstatisticasDaReuniao = {
  falantes: Falante[];
  perguntas: number;
  palavrasPorMinuto: number | null;
  maiorFala: { falante: string; ms: number } | null;
  duracaoFaladaMs: number;
};

const SEM_NOME = "Sem nome";

export function duracaoDoTrecho(trecho: Pick<TrechoDaTranscricao, "inicio_ms" | "fim_ms">): number {
  return Math.max(0, (trecho.fim_ms ?? trecho.inicio_ms) - trecho.inicio_ms);
}

export function ehPergunta(texto: string): boolean {
  return texto.includes("?");
}

function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function estatisticasDaReuniao(trechos: readonly TrechoDaTranscricao[]): EstatisticasDaReuniao {
  const porFalante = new Map<string, { ms: number; falas: number }>();
  let duracaoFaladaMs = 0;
  let palavras = 0;
  let perguntas = 0;
  let maiorFala: EstatisticasDaReuniao["maiorFala"] = null;

  for (const trecho of trechos) {
    const nome = trecho.falante?.trim() || SEM_NOME;
    const ms = duracaoDoTrecho(trecho);
    const atual = porFalante.get(nome) ?? { ms: 0, falas: 0 };
    porFalante.set(nome, { ms: atual.ms + ms, falas: atual.falas + 1 });
    duracaoFaladaMs += ms;
    palavras += contarPalavras(trecho.texto);
    if (ehPergunta(trecho.texto)) perguntas += 1;
    if (!maiorFala || ms > maiorFala.ms) maiorFala = { falante: nome, ms };
  }

  const falantes = [...porFalante.entries()]
    .map(([nome, { ms, falas }]) => ({ nome, ms, falas, parcela: duracaoFaladaMs > 0 ? ms / duracaoFaladaMs : 0 }))
    .sort((a, b) => b.ms - a.ms || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    falantes,
    perguntas,
    palavrasPorMinuto: duracaoFaladaMs > 0 ? Math.round(palavras / (duracaoFaladaMs / 60000)) : null,
    maiorFala: maiorFala && maiorFala.ms > 0 ? maiorFala : null,
    duracaoFaladaMs,
  };
}

/** Parcelas inteiras que somam 100, para a lista de quem falou não mostrar 99% ou 101%. */
export function parcelasEmPorcentagem(parcelas: readonly number[]): number[] {
  const brutas = parcelas.map(p => p * 100);
  const inteiras = brutas.map(Math.floor);
  const total = parcelas.reduce((soma, p) => soma + p, 0);
  if (total === 0) return inteiras;
  let falta = 100 - inteiras.reduce((soma, n) => soma + n, 0);
  const ordem = brutas.map((b, i) => ({ i, resto: b - Math.floor(b) })).sort((a, b) => b.resto - a.resto);
  for (const { i } of ordem) {
    if (falta <= 0) break;
    inteiras[i] += 1;
    falta -= 1;
  }
  return inteiras;
}

export type BlocoDoResumo =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "titulo"; texto: string }
  | { tipo: "lista"; itens: string[] };

const TITULO = /^\*\*(.+?)\*\*:?$|^#{1,6}\s+(.+)$/;
const ITEM = /^[-*•]\s+(.+)$/;
const TITULO_DE_PROXIMOS_PASSOS = /^(pr[óo]ximos passos|itens de a[çc][ãa]o|encaminhamentos)$/i;

/**
 * O resumo da IA vem em markdown simples (títulos em negrito e listas). Separa os
 * próximos passos para a coluna lateral e devolve o resto em blocos legíveis.
 */
export function separarResumo(resumo: string): { blocos: BlocoDoResumo[]; proximosPassos: string[] } {
  const blocos: BlocoDoResumo[] = [];
  const proximosPassos: string[] = [];
  let dentroDosPassos = false;

  for (const linhaBruta of resumo.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha) continue;

    const titulo = linha.match(TITULO);
    if (titulo) {
      const texto = (titulo[1] ?? titulo[2]).trim().replace(/:$/, "");
      dentroDosPassos = TITULO_DE_PROXIMOS_PASSOS.test(texto);
      if (!dentroDosPassos) blocos.push({ tipo: "titulo", texto });
      continue;
    }

    const item = linha.match(ITEM);
    if (item) {
      const texto = item[1].trim();
      if (dentroDosPassos) { proximosPassos.push(texto); continue; }
      const ultimo = blocos[blocos.length - 1];
      if (ultimo?.tipo === "lista") ultimo.itens.push(texto);
      else blocos.push({ tipo: "lista", itens: [texto] });
      continue;
    }

    dentroDosPassos = false;
    blocos.push({ tipo: "paragrafo", texto: linha });
  }

  return { blocos, proximosPassos };
}

/** Trechos de `**negrito**` dentro de uma linha do resumo. */
export function partesEmNegrito(texto: string): { texto: string; negrito: boolean }[] {
  return texto.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(parte =>
    parte.startsWith("**") && parte.endsWith("**")
      ? { texto: parte.slice(2, -2), negrito: true }
      : { texto: parte, negrito: false },
  );
}

export type FaixaDoMapa = { inicioMs: number; falante: string | null; intensidade: number; trechoIds: string[] };

/**
 * Divide a conversa em faixas de tempo iguais. Cada faixa fica com quem mais falou
 * nela e com a densidade de palavras (0–1), que vira a altura da barra no mapa.
 */
export function mapaDaConversa(trechos: readonly TrechoDaTranscricao[], faixas: number): FaixaDoMapa[] {
  const fim = trechos.reduce((maior, t) => Math.max(maior, t.fim_ms ?? t.inicio_ms), 0);
  if (fim <= 0 || faixas <= 0) return [];
  const passo = fim / faixas;

  const resultado = Array.from({ length: faixas }, (_, i) => ({
    inicioMs: Math.round(i * passo),
    palavras: 0,
    porFalante: new Map<string, number>(),
    trechoIds: [] as string[],
  }));

  for (const trecho of trechos) {
    const inicio = trecho.inicio_ms;
    const termino = Math.max(inicio + 1, trecho.fim_ms ?? inicio + 1);
    const palavrasPorMs = contarPalavras(trecho.texto) / (termino - inicio);
    const nome = trecho.falante?.trim() || SEM_NOME;
    const primeira = Math.min(faixas - 1, Math.floor(inicio / passo));
    const ultima = Math.min(faixas - 1, Math.floor((termino - 1) / passo));
    for (let i = primeira; i <= ultima; i++) {
      const sobreposicao = Math.min(termino, (i + 1) * passo) - Math.max(inicio, i * passo);
      if (sobreposicao <= 0) continue;
      const faixa = resultado[i];
      faixa.palavras += palavrasPorMs * sobreposicao;
      faixa.porFalante.set(nome, (faixa.porFalante.get(nome) ?? 0) + sobreposicao);
      faixa.trechoIds.push(trecho.id);
    }
  }

  const maximo = Math.max(...resultado.map(f => f.palavras), 0);
  return resultado.map(f => {
    let falante: string | null = null;
    let maiorTempo = 0;
    for (const [nome, ms] of f.porFalante) if (ms > maiorTempo) { falante = nome; maiorTempo = ms; }
    return { inicioMs: f.inicioMs, falante, intensidade: maximo > 0 ? f.palavras / maximo : 0, trechoIds: f.trechoIds };
  });
}

export function formatarTimestamp(ms: number): string {
  const totalSegundos = Math.floor(ms / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const mmss = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  return horas > 0 ? `${horas}:${mmss}` : mmss;
}

export function formatarDuracao(ms: number): string {
  const minutos = Math.round(ms / 60000);
  if (minutos < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}
