// As credenciais dos convidados e a leitura na porta (plano do módulo, PD7.3, primeiro corte): o código, a resposta da porta e a
// presença da sessão. Sem tela e sem banco.

import type { ResultadoDaLeitura } from "@/lib/producao/estados";

/** O código da credencial: 16 letras e números (0-9 e A-F). Escrito em grupos de 4 para ler e ditar. */
export function formatarCodigo(codigo: string): string {
  return (codigo.match(/.{1,4}/g) ?? []).join("-");
}

/** Lê o que a pessoa digitou ou colou: tira traço, espaço e o resto, ignora a caixa; devolve o código ou null se não tem 16 letras e números. */
export function lerCodigo(texto: string): string | null {
  const limpo = texto.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  return /^[0-9A-F]{16}$/.test(limpo) ? limpo : null;
}

export type RespostaDaPorta = {
  resultado: ResultadoDaLeitura; motivo: string | null; nome: string | null; afiliacao: string | null; tipo: string | null;
  lugares: number | null; entradas: number | null; restantes: number | null;
};

const RESULTADOS: readonly string[] = ["permitido", "ja_entrou", "negado"];
const texto = (valor: unknown) => (typeof valor === "string" ? valor : null);
const numero = (valor: unknown) => (typeof valor === "number" ? valor : null);

/** Confere a resposta de `fn_producao_porta_ler` (jsonb): se não vier como esperado, devolve null e a tela mostra um erro em vez de liberar. */
export function lerRespostaDaPorta(dado: unknown): RespostaDaPorta | null {
  if (!dado || typeof dado !== "object" || Array.isArray(dado)) return null;
  const d = dado as Record<string, unknown>;
  if (typeof d.resultado !== "string" || !RESULTADOS.includes(d.resultado)) return null;
  return {
    resultado: d.resultado as ResultadoDaLeitura, motivo: texto(d.motivo), nome: texto(d.nome), afiliacao: texto(d.afiliacao), tipo: texto(d.tipo),
    lugares: numero(d.lugares), entradas: numero(d.entradas), restantes: numero(d.restantes),
  };
}

export type Tom = "bom" | "atencao" | "ruim";

/** O que a porta mostra: o título grande, o detalhe e o tom (verde, âmbar ou vermelho). */
export function textoDaPorta(resposta: RespostaDaPorta): { titulo: string; detalhe: string; tom: Tom } {
  const quem = [resposta.nome, resposta.afiliacao].filter(Boolean).join(" · ");
  if (resposta.resultado === "permitido") {
    const restantes = resposta.restantes ?? 0;
    return { titulo: "Pode entrar", tom: "bom", detalhe: `${quem}${resposta.tipo ? ` (${resposta.tipo})` : ""}. ${restantes === 0 ? "Todos os lugares deste convite entraram." : `Ainda ${restantes === 1 ? "falta 1 pessoa" : `faltam ${restantes} pessoas`} deste convite.`}` };
  }
  if (resposta.resultado === "ja_entrou") {
    return { titulo: "Já entrou", tom: "atencao", detalhe: `${quem}. Os ${resposta.lugares ?? 0} ${resposta.lugares === 1 ? "lugar" : "lugares"} deste convite já foram usados.` };
  }
  const motivos: Record<string, string> = {
    desconhecida: "Esse código não existe para esta sessão. Confira a sessão escolhida e o código.",
    revogada: `A credencial de ${resposta.nome ?? "este convidado"} foi cancelada.`,
    nao_confirmado: `${resposta.nome ?? "O convidado"} não está confirmado(a) para esta sessão.`,
  };
  return { titulo: "Não pode entrar", tom: "ruim", detalhe: motivos[resposta.motivo ?? ""] ?? "Credencial não aceita." };
}

/** A presença da sessão: lugares que já entraram e lugares confirmados. */
export function presencaDaSessao(convidados: readonly { id: string; quantidade: number; situacao: string }[], credenciais: readonly { convidado_id: string; entradas: number; revogada_em: string | null }[]): { entraram: number; confirmados: number; comCredencial: number; semCredencial: number } {
  const confirmados = convidados.filter(c => c.situacao === "confirmado");
  const comCredencial = new Set(credenciais.filter(k => k.revogada_em === null).map(k => k.convidado_id));
  return {
    entraram: credenciais.reduce((soma, k) => soma + k.entradas, 0),
    confirmados: confirmados.reduce((soma, c) => soma + c.quantidade, 0),
    comCredencial: confirmados.filter(c => comCredencial.has(c.id)).length,
    semCredencial: confirmados.filter(c => !comCredencial.has(c.id)).length,
  };
}

/** O texto que a produção manda a cada convidado com a credencial dele. */
export function mensagemDaCredencial(campos: { nome: string; sessao: string; codigo: string; lugares: number; url?: string }): string {
  const primeiro = campos.nome.trim().split(/\s+/)[0] ?? campos.nome;
  const vale = `(vale para ${campos.lugares} ${campos.lugares === 1 ? "pessoa" : "pessoas"})`;
  if (campos.url) return `Oi, ${primeiro}! Sua credencial para ${campos.sessao} ${vale}: ${campos.url}\nMostre o QR da página na entrada. Se a câmera falhar, o código é ${formatarCodigo(campos.codigo)}.`;
  return `Oi, ${primeiro}! Sua credencial para ${campos.sessao}: ${formatarCodigo(campos.codigo)} ${vale}. Mostre este código na entrada.`;
}
