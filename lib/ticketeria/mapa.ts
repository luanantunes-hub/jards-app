// O mapa de assentos de um setor (assentos marcados, etapa 1): as contas do editor (adicionar fileira, mais e menos lugares, bloquear), o resumo, a ida e a volta do
// formato do banco (fn_ticketeria_salvar_mapa e fn_ticketeria_mapa_do_setor) e as frases dos erros. Só lógica: sem banco, sem tela e sem import de servidor.
// As regras de formato são as mesmas do banco: fileira de 1 a 4 letras ou números, até 60 fileiras e 80 lugares por fileira (o banco ainda guarda um teto de 5.000 no setor).

import { ehTipoDeLugar, type TipoDeLugar } from "@/lib/ticketeria/mapa-acessibilidade";

/** `reservado`: lugar de acessibilidade que quem compra, sem declarar a necessidade, ainda não pode escolher (art. 23-A); só aparece no mapa do comprador. */
export type EstadoDoAssento = "livre" | "ocupado" | "selecionado" | "bloqueado" | "reservado";
/** `tipo`: o tipo do lugar (cadeira de rodas, mobilidade reduzida...). Ausente = comum: o banco só traz quando não é comum, e quem não o manda ao salvar não apaga o que está gravado. */
export type AssentoDoMapa = { numero: number; estado: EstadoDoAssento; tipo?: TipoDeLugar };
/** `vaos`: depois de quais lugares (pelo número) há um corredor. */
export type FileiraDoMapa = { nome: string; assentos: AssentoDoMapa[]; vaos?: number[] };

export const MAX_FILEIRAS = 60;
export const MAX_LUGARES_NA_FILEIRA = 80;
export const MAX_LUGARES_NO_SETOR = 5000;
/** O mapa de um setor novo: 5 fileiras de 10 lugares. */
export const FILEIRAS_INICIAIS = 5;
export const LUGARES_INICIAIS = 10;

/** O nome da fileira depois de `atual`: A, B, ... Z, AA, AB, ... ("" começa em A). */
export function proximoNomeDeFileira(atual: string): string {
  if (atual === "") return "A";
  const letras = atual.split("");
  let i = letras.length - 1;
  while (i >= 0) {
    if (letras[i] === "Z") { letras[i] = "A"; i--; } else { letras[i] = String.fromCharCode(letras[i].charCodeAt(0) + 1); return letras.join(""); }
  }
  return "A" + letras.join("");
}

const fileira = (nome: string, quantos: number): FileiraDoMapa => ({ nome, assentos: Array.from({ length: quantos }, (_, i) => ({ numero: i + 1, estado: "livre" as const })) });

/** Um mapa novo: `fileiras` fileiras (A, B, C...) com `lugares` lugares cada, todos livres. */
export function mapaNovo(fileiras: number = FILEIRAS_INICIAIS, lugares: number = LUGARES_INICIAIS): FileiraDoMapa[] {
  const saida: FileiraDoMapa[] = [];
  let nome = "";
  for (let i = 0; i < fileiras; i++) { nome = proximoNomeDeFileira(nome); saida.push(fileira(nome, lugares)); }
  return saida;
}

/** Acrescenta uma fileira com o mesmo tanto de lugares da última (ou 10). Sem efeito no limite de fileiras ou de lugares do setor. */
export function adicionarFileira(mapa: readonly FileiraDoMapa[]): FileiraDoMapa[] {
  const ultima = mapa[mapa.length - 1];
  const quantos = ultima ? ultima.assentos.length : LUGARES_INICIAIS;
  if (mapa.length >= MAX_FILEIRAS || totalDeLugares(mapa) + quantos > MAX_LUGARES_NO_SETOR) return [...mapa];
  return [...mapa, fileira(proximoNomeDeFileira(ultima?.nome ?? ""), quantos)];
}

/** Um lugar a mais no fim da fileira. */
export function maisLugares(mapa: readonly FileiraDoMapa[], nome: string): FileiraDoMapa[] {
  return mapa.map(f => {
    if (f.nome !== nome || f.assentos.length >= MAX_LUGARES_NA_FILEIRA || totalDeLugares(mapa) >= MAX_LUGARES_NO_SETOR) return f;
    return { ...f, assentos: [...f.assentos, { numero: (f.assentos[f.assentos.length - 1]?.numero ?? 0) + 1, estado: "livre" as const }] };
  });
}

/** Um lugar a menos no fim da fileira (a fileira some quando fica sem lugar nenhum). Um lugar já vendido não sai. */
export function menosLugares(mapa: readonly FileiraDoMapa[], nome: string): FileiraDoMapa[] {
  return mapa.flatMap(f => {
    if (f.nome !== nome) return [f];
    const ultimo = f.assentos[f.assentos.length - 1];
    if (!ultimo || ultimo.estado === "ocupado") return [f];
    const assentos = f.assentos.slice(0, -1);
    return assentos.length === 0 ? [] : [{ ...f, assentos }];
  });
}

/** Bloqueia o lugar, ou o libera se já estava bloqueado. Lugar vendido não se mexe. */
export function alternarBloqueio(mapa: readonly FileiraDoMapa[], nome: string, numero: number): FileiraDoMapa[] {
  return mapa.map(f => f.nome !== nome ? f : { ...f, assentos: f.assentos.map(a => a.numero !== numero || a.estado === "ocupado" ? a : { ...a, estado: a.estado === "bloqueado" ? "livre" as const : "bloqueado" as const }) });
}

export const totalDeLugares = (mapa: readonly FileiraDoMapa[]) => mapa.reduce((soma, f) => soma + f.assentos.length, 0);

export type ResumoDoMapa = { fileiras: number; lugares: number; bloqueados: number; aVenda: number; vendidos: number };
export function resumoDoMapa(mapa: readonly FileiraDoMapa[]): ResumoDoMapa {
  let bloqueados = 0;
  let vendidos = 0;
  for (const f of mapa) for (const a of f.assentos) { if (a.estado === "bloqueado") bloqueados++; else if (a.estado === "ocupado") vendidos++; }
  const lugares = totalDeLugares(mapa);
  return { fileiras: mapa.length, lugares, bloqueados, aVenda: lugares - bloqueados, vendidos };
}

/** "8 fileiras · 85 lugares à venda · 5 bloqueados" (sem a parte dos bloqueados quando não há nenhum). */
export function resumoEmTexto(r: Pick<ResumoDoMapa, "fileiras" | "aVenda" | "bloqueados">): string {
  const partes = [`${r.fileiras} ${r.fileiras === 1 ? "fileira" : "fileiras"}`, `${r.aVenda} ${r.aVenda === 1 ? "lugar à venda" : "lugares à venda"}`];
  if (r.bloqueados > 0) partes.push(`${r.bloqueados} ${r.bloqueados === 1 ? "bloqueado" : "bloqueados"}`);
  return partes.join(" · ");
}

/** O corredor no meio de cada fileira de 6 lugares ou mais (depois do lugar do meio); sem ele, as fileiras vão sem vão. */
export function comCorredor(mapa: readonly FileiraDoMapa[], ligado: boolean): FileiraDoMapa[] {
  return mapa.map(f => ({ ...f, vaos: ligado && f.assentos.length >= 6 ? [f.assentos[Math.floor(f.assentos.length / 2) - 1].numero] : undefined }));
}

/** O que a função do banco recebe: fileiras e lugares com o bloqueio de cada um e, quando o lugar tem `tipo` (inclusive "comum", para desfazer um tipo), o tipo. */
export function paraSalvar(mapa: readonly FileiraDoMapa[]): { nome: string; assentos: { numero: number; bloqueado: boolean; tipo?: TipoDeLugar }[] }[] {
  return mapa.map(f => ({ nome: f.nome, assentos: f.assentos.map(a => ({ numero: a.numero, bloqueado: a.estado === "bloqueado", ...(a.tipo ? { tipo: a.tipo } : {}) })) }));
}

/** Troca o tipo de um lugar (`"comum"` desfaz o tipo e é gravado como comum). Lugar que não existe, ou que já foi vendido, não muda. */
export function comTipoNoLugar(mapa: readonly FileiraDoMapa[], nome: string, numero: number, tipo: TipoDeLugar): FileiraDoMapa[] {
  return mapa.map(f => f.nome !== nome ? f : { ...f, assentos: f.assentos.map(a => a.numero !== numero || a.estado === "ocupado" ? a : { ...a, tipo }) });
}

/** O tipo de cada lugar que não é comum, pela chave que o desenho usa (a de `chaveDoLugar`: setor, fileira e número). */
export function tiposDoMapa(fileiras: readonly FileiraDoMapa[], chave: (fileira: string, numero: number) => string): Map<string, TipoDeLugar> {
  const tipos = new Map<string, TipoDeLugar>();
  for (const f of fileiras) for (const a of f.assentos) if (a.tipo && a.tipo !== "comum") tipos.set(chave(f.nome, a.numero), a.tipo);
  return tipos;
}

/** O que o banco devolve (fn_ticketeria_mapa_do_setor), conferido; fileira ou lugar fora do formato é ignorado. */
export function lerMapa(resposta: unknown): FileiraDoMapa[] {
  if (!Array.isArray(resposta)) return [];
  const saida: FileiraDoMapa[] = [];
  for (const bruta of resposta) {
    const f = (bruta && typeof bruta === "object" ? bruta : {}) as { nome?: unknown; assentos?: unknown };
    if (typeof f.nome !== "string" || !Array.isArray(f.assentos)) continue;
    const assentos: AssentoDoMapa[] = [];
    for (const x of f.assentos) {
      const a = (x && typeof x === "object" ? x : {}) as { numero?: unknown; bloqueado?: unknown; tipo?: unknown };
      if (typeof a.numero === "number" && Number.isInteger(a.numero)) {
        assentos.push({ numero: a.numero, estado: a.bloqueado === true ? "bloqueado" : "livre", ...(ehTipoDeLugar(a.tipo) && a.tipo !== "comum" ? { tipo: a.tipo } : {}) });
      }
    }
    if (assentos.length > 0) saida.push({ nome: f.nome, assentos });
  }
  return saida;
}

/** O erro do banco ao salvar o mapa ou ligar os lugares numerados, numa frase. */
export function mensagemDoErroDoMapa(erro: { code?: string; message?: string }): string {
  const m = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode mudar a Ticketeria desta organização.";
  if (m.includes("mapa_sem_lugares")) return "Todos os lugares estão bloqueados. Deixe ao menos um à venda.";
  if (m.includes("mapa_vazio")) return "Monte o mapa antes de ligar os lugares numerados.";
  if (m.includes("setor_com_lugares_vendidos")) return "Este setor tem lugares vendidos para uma sessão que ainda vai acontecer. Não dá para desligar os lugares numerados.";
  if (m.includes("lugar_vendido")) return "Um lugar vendido ou reservado para uma sessão que ainda vai acontecer não pode sair do mapa nem ser bloqueado.";
  if (m.includes("setor_com_vendas")) return "Este setor já tem ingressos vendidos sem lugar marcado para uma sessão que ainda vai acontecer. Os lugares numerados valem para setores sem vendas.";
  if (m.includes("lugares_excedidos")) return "Os ingressos deste setor oferecem mais lugares do que o mapa tem. Diminua as quantidades dos lotes ou aumente o mapa.";
  if (m.includes("setor_arquivado")) return "Esse setor está arquivado. Tire-o do arquivo antes de montar o mapa.";
  if (m.includes("layout_inconsistente")) return "O desenho não bate com os lugares do mapa. Refaça o desenho e salve de novo.";
  if (m.includes("layout_invalido")) return "O desenho do mapa não está no formato aceito.";
  if (m.includes("mapa_invalido")) return "O mapa não está no formato aceito: fileiras de 1 a 4 letras ou números, até 60 fileiras e 80 lugares por fileira.";
  return "Não foi possível salvar o mapa. Tente de novo.";
}

// ─── O mapa na hora de comprar ──────────────────────────────────────────────

/** O mapa de um setor numerado numa sessão, como o comprador o vê: cada lugar livre ou ocupado (o bloqueado também aparece como ocupado). */
/** `layout`: o layout do setor, como veio (confira com `lerLayout` de mapa-layout.ts antes de desenhar); ausente quando o setor é só a lista de fileiras. */
export type MapaDaSessao = { setor: string; corredor: boolean; fileiras: FileiraDoMapa[]; layout?: unknown };

/** A resposta de fn_ticketeria_mapa_da_sessao, conferida; null se veio algo que não se entende. */
export function lerMapaDaSessao(resposta: unknown): MapaDaSessao | null {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as { setor?: unknown; corredor?: unknown; fileiras?: unknown; layout?: unknown };
  if (typeof r.setor !== "string" || !Array.isArray(r.fileiras)) return null;
  const fileiras: FileiraDoMapa[] = [];
  for (const bruta of r.fileiras) {
    const f = (bruta && typeof bruta === "object" ? bruta : {}) as { nome?: unknown; assentos?: unknown };
    if (typeof f.nome !== "string" || !Array.isArray(f.assentos)) return null;
    const assentos: AssentoDoMapa[] = [];
    for (const x of f.assentos) {
      const a = (x && typeof x === "object" ? x : {}) as { numero?: unknown; estado?: unknown; tipo?: unknown };
      if (typeof a.numero !== "number" || !Number.isInteger(a.numero) || (a.estado !== "livre" && a.estado !== "ocupado" && a.estado !== "reservado")) return null;
      assentos.push({ numero: a.numero, estado: a.estado, ...(ehTipoDeLugar(a.tipo) && a.tipo !== "comum" ? { tipo: a.tipo } : {}) });
    }
    fileiras.push({ nome: f.nome, assentos });
  }
  return { setor: r.setor, corredor: r.corredor !== false, fileiras, ...(r.layout && typeof r.layout === "object" ? { layout: r.layout } : {}) };
}

/** "C7": o lugar como a pessoa o vê. */
export const rotuloDoLugar = (fileira: string, numero: number) => `${fileira}${numero}`;

export type LugarEscolhido = { fileira: string; numero: number };

/** Marca no mapa os lugares escolhidos (só os que ainda estão livres). */
export function comEscolhidos(fileiras: readonly FileiraDoMapa[], escolhidos: readonly LugarEscolhido[]): FileiraDoMapa[] {
  return fileiras.map(f => ({ ...f, assentos: f.assentos.map(a => a.estado === "livre" && escolhidos.some(e => e.fileira === f.nome && e.numero === a.numero) ? { ...a, estado: "selecionado" as const } : a) }));
}

/** Escolhe ou solta um lugar, no máximo `max` (ao passar disso o lugar novo não entra). Mantém a ordem em que a pessoa tocou. */
export function alternarEscolha(escolhidos: readonly LugarEscolhido[], fileira: string, numero: number, max: number): LugarEscolhido[] {
  if (escolhidos.some(e => e.fileira === fileira && e.numero === numero)) return escolhidos.filter(e => !(e.fileira === fileira && e.numero === numero));
  return escolhidos.length >= max ? [...escolhidos] : [...escolhidos, { fileira, numero }];
}
