// O histórico de versões das páginas do site (construtor, passo 4; desenho aprovado pelo dono em 20/11/2026): a leitura da lista, os textos de cada linha (quando, quantos blocos e quais),
// qual é a que está no ar agora e as frases de erro. Só lógica, sem banco e sem tela (roda no navegador e nos testes).

import { blocosDoJson, ROTULO_DO_TIPO_DE_BLOCO, type Bloco, type TipoDeBloco } from "@/lib/ticketeria/site";
import type { OrigemDaVersao } from "@/lib/ticketeria/estados";

const FUSO = "America/Sao_Paulo";
export const MAX_VERSOES_GUARDADAS = 20;

export type VersaoDaLista = { id: string; origem: OrigemDaVersao; blocos: Bloco[]; created_at: string };

/** As linhas da tabela, lidas com cuidado: os blocos passam pela mesma leitura do site (o que não vale some), e as mais novas vêm primeiro. */
export function lerVersoes(linhas: unknown): VersaoDaLista[] {
  if (!Array.isArray(linhas)) return [];
  const lista: VersaoDaLista[] = [];
  for (const x of linhas) {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.created_at !== "string" || (r.origem !== "publicada" && r.origem !== "rascunho_guardado")) continue;
    lista.push({ id: r.id, origem: r.origem, blocos: blocosDoJson(r.blocos), created_at: r.created_at });
  }
  return lista.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, MAX_VERSOES_GUARDADAS);
}

/** "Hoje, 14:02", "Ontem, 10:15" ou "18/11, 16:40", no fuso de Brasília. */
export function quandoDaVersao(iso: string, agora: number = Date.now()): string {
  const dia = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const d = dia(Date.parse(iso));
  if (d === dia(agora)) return `Hoje, ${hora}`;
  if (d === dia(agora - 86_400_000)) return `Ontem, ${hora}`;
  const [, mes, diaDoMes] = d.split("-");
  return `${diaDoMes}/${mes}, ${hora}`;
}

const NOME_CURTO: Partial<Record<TipoDeBloco, string>> = { programacao: "Programação", ingressos: "Ingressos", botao: "Botão", contagem: "Contagem", faq: "Perguntas", colunas: "Colunas" };

/** "6 blocos · Capa, Texto, Ingressos…": quantos blocos e os três primeiros; "página vazia" sem nenhum. */
export function resumoDosBlocos(blocos: readonly Bloco[]): string {
  if (blocos.length === 0) return "página vazia";
  const nomes = blocos.slice(0, 3).map(b => NOME_CURTO[b.tipo] ?? ROTULO_DO_TIPO_DE_BLOCO[b.tipo]);
  return `${blocos.length} ${blocos.length === 1 ? "bloco" : "blocos"} · ${nomes.join(", ")}${blocos.length > 3 ? "…" : ""}`;
}

export type LinhaDaVersao = { id: string; titulo: string; subtitulo: string; noAr: boolean; guardada: boolean };

/** Quais linhas mostrar: a mais nova das publicadas, com os mesmos blocos do que está no ar, leva "NO AR AGORA". */
export function linhasDasVersoes(versoes: readonly VersaoDaLista[], publicadosAgora: readonly Bloco[] | null, agora: number = Date.now()): LinhaDaVersao[] {
  const atual = publicadosAgora === null ? null : JSON.stringify(publicadosAgora);
  const noAr = atual === null ? undefined : versoes.find(v => v.origem === "publicada" && JSON.stringify(v.blocos) === atual)?.id;
  return versoes.map(v => v.origem === "publicada"
    ? { id: v.id, titulo: quandoDaVersao(v.created_at, agora), subtitulo: resumoDosBlocos(v.blocos), noAr: v.id === noAr, guardada: false }
    : { id: v.id, titulo: `Rascunho guardado · ${quandoDaVersao(v.created_at, agora).toLowerCase()}`, subtitulo: `${resumoDosBlocos(v.blocos)} · guardado antes de restaurar outra versão`, noAr: false, guardada: true });
}

/** O erro de restaurar numa frase. */
export function mensagemDoErroDeRestaurar(erro: { code?: string; message?: string }): string {
  if (erro.code === "42501" || erro.message?.includes("sem_permissao")) return "Você não pode mudar este site.";
  if (erro.code === "P0002" || erro.message?.includes("versao_inexistente")) return "Essa versão não existe mais. Feche e abra a lista de novo.";
  return "Não foi possível restaurar. Tente de novo.";
}

/** O aviso depois de restaurar: o que mudou, o que não mudou e onde está o rascunho de antes. */
export function avisoDeRestaurado(quando: string, guardado: boolean): string {
  return `O rascunho agora é a versão de ${quando.toLowerCase()}. O que está no ar não mudou até você publicar.${guardado ? " O rascunho de antes ficou guardado em Versões." : ""}`;
}
