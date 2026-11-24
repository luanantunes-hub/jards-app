// O DESENHO DA SALA: a sala se desenha de uma vez, numa tela só (blocos, mesas, camarotes, pistas, o palco e a planta de fundo), e cada bloco é ATRIBUÍDO a um setor, em vez de cada setor ter o seu
// desenho. Aqui só a lógica (sem banco, sem tela): o desenho, a atribuição, a conferência e a conversa com o que o banco já guarda.
//
// Nada novo é guardado: ao salvar, o desenho se DISTRIBUI (cada setor recebe os seus blocos, nas posições da sala, e a sala recebe a planta com as cores, as pistas, o palco e o fundo), e ao abrir
// ele se RECONSTRÓI dessas mesmas peças. Então o mapa do comprador, a reserva, o estoque e o reembolso seguem como estão (lib/ticketeria/mapa-sala.ts).
// Testes em tests/ticketeria-desenho-da-sala.test.ts.

import { proximoNomeDeFileira, type FileiraDoMapa } from "@/lib/ticketeria/mapa";
import { calcularLayout, conferirLayout, layoutDoMapa, mapaDoLayout, type Bloco, type ErroDoLayout, type Layout } from "@/lib/ticketeria/mapa-layout";
import { comPalcoAcima, encaixa } from "@/lib/ticketeria/mapa-layout-editor";
import { AREA_MAXIMA, AREA_MINIMA, CORES_DOS_SETORES, OPACIDADE_MAXIMA_DO_FUNDO, OPACIDADE_MINIMA_DO_FUNDO, OPACIDADE_PADRAO_DO_FUNDO, comporSala, type FundoDaPlanta, type Planta, type SetorDesenhado, type SetorEmPe, type SetorNaPlanta } from "@/lib/ticketeria/mapa-sala";

/** Uma pista (setor sem lugares numerados) no desenho: um retângulo com o canto de cima à esquerda em (x, y). */
export type AreaDoDesenho = { setor: string; x: number; y: number; largura: number; altura: number };

/** A sala inteira: o `Layout` de sempre (blocos, cada um com o `setor` a que pertence, e o palco) mais as pistas, a cor de cada setor e a planta de fundo. */
export type DesenhoDaSala = Layout & { areas: AreaDoDesenho[]; cores: Record<string, string>; fundo?: FundoDaPlanta | null };

/** Um setor da sala, como o desenho o conhece. */
export type SetorDaSala = { id: string; nome: string };

export const ESPACO_ENTRE_PARTES = 4;
const MAX_AREAS = 20;

export const desenhoVazio = (): DesenhoDaSala => ({ versao: 1, blocos: [], palco: null, areas: [], cores: {} });

// ─── Cores ──────────────────────────────────────────────────────────────────

/** Dá a cada setor que ainda não tem uma cor a próxima cor livre da lista (os que já têm ficam como estão). */
export function comCoresCompletas(d: DesenhoDaSala, setores: readonly SetorDaSala[]): DesenhoDaSala {
  const cores = { ...d.cores };
  let mudou = false;
  for (const s of setores) {
    if (cores[s.id]) continue;
    const usadas = new Set(Object.values(cores));
    cores[s.id] = CORES_DOS_SETORES.find(c => !usadas.has(c)) ?? CORES_DOS_SETORES[Object.keys(cores).length % CORES_DOS_SETORES.length];
    mudou = true;
  }
  return mudou ? { ...d, cores } : d;
}

export function comCorDoSetor(d: DesenhoDaSala, setor: string, cor: string): DesenhoDaSala {
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? { ...d, cores: { ...d.cores, [setor]: cor } } : d;
}

// ─── Atribuir o setor ───────────────────────────────────────────────────────

/**
 * Atribui o setor a estes blocos (`null` tira o setor). Se, com isso, dois blocos do mesmo setor passam a ter o mesmo lugar (a mesma fileira com o mesmo número), as fileiras do bloco que veio por
 * último são renomeadas para as próximas livres (A a H num bloco e I a P no seguinte). Blocos que continuam a mesma fileira com números diferentes (esquerda, centro e direita) ficam como estão.
 */
export function atribuirSetor(d: DesenhoDaSala, blocos: readonly string[], setor: string | null): DesenhoDaSala {
  const ids = new Set(blocos);
  if (!d.blocos.some(b => ids.has(b.id) && b.setor !== setor)) return d;
  return resolverConflitos({ ...d, blocos: d.blocos.map(b => (ids.has(b.id) ? { ...b, setor } : b)) });
}

/** Tira dos blocos do mesmo setor os lugares repetidos, renomeando as fileiras do bloco que chegou depois. */
export function resolverConflitos(d: DesenhoDaSala): DesenhoDaSala {
  const lugares = new Map<string, Set<string>>();
  const nomes = new Map<string, Set<string>>();
  let mudou = false;
  const blocos = d.blocos.map(b => {
    if (!b.setor) return b;
    const usados = lugares.get(b.setor) ?? new Set<string>();
    const nomesUsados = nomes.get(b.setor) ?? new Set<string>();
    const chaves = calcularLayout({ versao: 1, blocos: [b], palco: null }).lugares.map(l => `${l.fileira}|${l.numero}`);
    let atual = b;
    if (!b.grupo && chaves.some(c => usados.has(c))) {
      let ultimo = [...nomesUsados].sort((x, y) => x.length - y.length || x.localeCompare(y)).pop() ?? "";
      const renomeadas = b.fileiras.map(f => {
        do ultimo = proximoNomeDeFileira(ultimo); while (nomesUsados.has(ultimo));
        nomesUsados.add(ultimo);
        return { ...f, nome: ultimo };
      });
      atual = { ...b, fileiras: renomeadas };
      mudou = true;
    }
    for (const c of calcularLayout({ versao: 1, blocos: [atual], palco: null }).lugares.map(l => `${l.fileira}|${l.numero}`)) usados.add(c);
    for (const f of atual.fileiras) nomesUsados.add(f.nome);
    lugares.set(b.setor, usados);
    nomes.set(b.setor, nomesUsados);
    return atual;
  });
  return mudou ? { ...d, blocos } : d;
}

// ─── Pistas ─────────────────────────────────────────────────────────────────

/** O tamanho de partida de uma pista: 30 de largura e alta o bastante para a capacidade (cerca de 1,5 pessoa por lugar de área). */
export function areaDePartida(capacidade: number, largura = 30): { largura: number; altura: number } {
  const l = Math.max(20, Math.min(AREA_MAXIMA, Math.round(largura)));
  return { largura: l, altura: Math.max(6, Math.min(40, Math.round(capacidade / l / 1.5))) };
}

/** Uma pista nova para o setor, logo abaixo de tudo o que já está desenhado. Um setor só tem uma pista. */
export function maisUmaPista(d: DesenhoDaSala, setor: string, capacidade: number): DesenhoDaSala {
  if (d.areas.some(a => a.setor === setor) || d.areas.length >= MAX_AREAS) return d;
  const tamanho = areaDePartida(capacidade);
  const caixa = caixaDoDesenho(d);
  return { ...d, areas: [...d.areas, { setor, x: encaixa(-tamanho.largura / 2), y: encaixa(caixa ? caixa.y1 + ESPACO_ENTRE_PARTES : 0), ...tamanho }] };
}

export function tirarPista(d: DesenhoDaSala, setor: string): DesenhoDaSala {
  return d.areas.some(a => a.setor === setor) ? { ...d, areas: d.areas.filter(a => a.setor !== setor) } : d;
}

export function posicionarPista(d: DesenhoDaSala, setor: string, x: number, y: number): DesenhoDaSala {
  return { ...d, areas: d.areas.map(a => (a.setor === setor ? { ...a, x: Math.max(-2000, Math.min(2000, encaixa(x))), y: Math.max(-2000, Math.min(2000, encaixa(y))) } : a)) };
}

export function ajustarPista(d: DesenhoDaSala, setor: string, dl: number, da: number): DesenhoDaSala {
  const limita = (v: number) => Math.max(AREA_MINIMA, Math.min(AREA_MAXIMA, Math.round(v * 2) / 2));
  return { ...d, areas: d.areas.map(a => (a.setor === setor ? { ...a, largura: limita(a.largura + dl), altura: limita(a.altura + da) } : a)) };
}

/** O retângulo que cobre os lugares e as pistas (nulo se não há nada). */
export function caixaDoDesenho(d: DesenhoDaSala): { x0: number; y0: number; x1: number; y1: number } | null {
  const caixas = [...(d.blocos.length > 0 ? [calcularLayout({ ...d, palco: null }).caixa] : []), ...d.areas.map(a => ({ x0: a.x, y0: a.y, x1: a.x + a.largura, y1: a.y + a.altura }))];
  if (caixas.length === 0) return null;
  return { x0: Math.min(...caixas.map(c => c.x0)), y0: Math.min(...caixas.map(c => c.y0)), x1: Math.max(...caixas.map(c => c.x1)), y1: Math.max(...caixas.map(c => c.y1)) };
}

// ─── A conferência ──────────────────────────────────────────────────────────

export type ErroDoDesenho = ErroDoLayout | "vazio" | "bloco_sem_setor" | "setor_desconhecido" | "setor_misto" | "pistas_sobrepostas";

export const ERRO_DO_DESENHO_EM_TEXTO: Record<Exclude<ErroDoDesenho, ErroDoLayout>, string> = {
  vazio: "Desenhe ao menos um bloco ou uma pista.",
  bloco_sem_setor: "Há blocos sem setor. Escolha o setor de cada um (os cinzas).",
  setor_desconhecido: "Um bloco ou uma pista aponta para um setor que não existe mais. Escolha outro setor para ele.",
  setor_misto: "Um setor não pode ter blocos de lugares e uma pista ao mesmo tempo.",
  pistas_sobrepostas: "Há pistas uma em cima da outra, ou em cima de lugares. Afaste-as.",
};

/** Os problemas do desenho (vazia = serve): os do layout, bloco sem setor, setor que não existe, setor com lugares e pista ao mesmo tempo, pistas em cima de outras coisas. */
export function conferirDesenho(d: DesenhoDaSala, setores: readonly SetorDaSala[]): ErroDoDesenho[] {
  if (d.blocos.length === 0 && d.areas.length === 0) return ["vazio"];
  const erros = new Set<ErroDoDesenho>();
  const ids = new Set(setores.map(s => s.id));
  if (d.blocos.some(b => !b.setor)) erros.add("bloco_sem_setor");
  if (d.blocos.some(b => b.setor && !ids.has(b.setor)) || d.areas.some(a => !ids.has(a.setor))) erros.add("setor_desconhecido");
  const comBlocos = new Set(d.blocos.flatMap(b => (b.setor ? [b.setor] : [])));
  if (d.areas.some(a => comBlocos.has(a.setor))) erros.add("setor_misto");
  if (d.blocos.length > 0) for (const e of conferirLayout({ versao: 1, blocos: d.blocos, palco: d.palco })) erros.add(e);
  const lugares = d.blocos.length > 0 ? calcularLayout({ versao: 1, blocos: d.blocos, palco: null }).lugares : [];
  const seCruzam = (a: AreaDoDesenho, b: AreaDoDesenho) => a.x < b.x + b.largura && b.x < a.x + a.largura && a.y < b.y + b.altura && b.y < a.y + a.altura;
  if (d.areas.some((a, i) => d.areas.slice(i + 1).some(b => seCruzam(a, b))) || d.areas.some(a => lugares.some(l => l.x > a.x - 0.5 && l.x < a.x + a.largura + 0.5 && l.y > a.y - 0.5 && l.y < a.y + a.altura + 0.5))) erros.add("pistas_sobrepostas");
  return [...erros];
}

// ─── Salvar: distribuir o desenho ───────────────────────────────────────────

/** O que cada setor com blocos recebe: o layout dele (os blocos dele, nas posições da sala) e as fileiras e lugares que esse layout descreve. */
export type PartePorSetor = { setor: string; layout: Layout; fileiras: FileiraDoMapa[] };

export function distribuirPorSetor(d: DesenhoDaSala): PartePorSetor[] {
  const ordem: string[] = [];
  for (const b of d.blocos) if (b.setor && !ordem.includes(b.setor)) ordem.push(b.setor);
  return ordem.map(setor => {
    const blocos: Bloco[] = d.blocos.filter(b => b.setor === setor).map(b => ({ ...b, setor: null }));
    const layout: Layout = { versao: 1, blocos, palco: null };
    return { setor, layout, fileiras: mapaDoLayout(layout) };
  });
}

/**
 * A planta da sala que acompanha o desenho: os setores com lugares na origem (os blocos já levam as posições da sala), as pistas com o retângulo, as cores, o palco e o fundo. É a mesma
 * planta que o mapa do comprador lê (lib/ticketeria/mapa-sala.ts).
 */
export function plantaDoDesenho(d: DesenhoDaSala): Planta {
  const entradas: SetorNaPlanta[] = [];
  const cor = (setor: string) => d.cores[setor] ?? CORES_DOS_SETORES[entradas.length % CORES_DOS_SETORES.length];
  for (const a of d.areas) entradas.push({ setor: a.setor, x: a.x, y: a.y, cor: cor(a.setor), area: { largura: a.largura, altura: a.altura } });
  for (const b of d.blocos) if (b.setor && !entradas.some(e => e.setor === b.setor)) entradas.push({ setor: b.setor, x: 0, y: 0, cor: cor(b.setor) });
  return { versao: 1, setores: entradas, palco: d.palco, ...(d.fundo ? { fundo: d.fundo } : {}) };
}

// ─── Abrir: reconstruir o desenho ───────────────────────────────────────────

/**
 * O desenho a partir do que o banco guarda: a planta da sala, os setores desenhados em blocos e os setores em pé. Os blocos ganham ids curtos novos (b1, b2...), porque o id do bloco da
 * composição (setor:bloco) passa do limite do banco; nada mais muda.
 */
export function desenhoDaPlanta(planta: Planta, setores: readonly SetorDesenhado[], emPe: readonly SetorEmPe[]): DesenhoDaSala {
  const { layout, cores, areas } = comporSala(planta, setores, emPe);
  const blocos = layout.blocos.map((b, i) => ({ ...b, id: `b${i + 1}` }));
  return {
    versao: 1, blocos, palco: planta.palco,
    areas: areas.map(a => ({ setor: a.setor, x: a.x, y: a.y, largura: a.largura, altura: a.altura })),
    cores: Object.fromEntries(cores), ...(planta.fundo ? { fundo: planta.fundo } : {}),
  };
}

/** Põe no desenho, logo abaixo de tudo, o setor numerado que ainda é só uma lista de fileiras (um bloco só, com as mesmas fileiras). Nada muda se a lista não cabe num bloco. */
export function acrescentarSetorDeFileiras(d: DesenhoDaSala, setor: string, fileiras: readonly FileiraDoMapa[]): DesenhoDaSala {
  const layout = layoutDoMapa(fileiras, null);
  if (!layout || d.blocos.some(b => b.setor === setor)) return d;
  const bloco = layout.blocos[0];
  const caixa = caixaDoDesenho(d);
  const sozinho = calcularLayout({ versao: 1, blocos: [bloco], palco: null }).caixa;
  const novo: Bloco = { ...bloco, id: proximoIdDeBloco(d), setor, x: encaixa(-(sozinho.x0 + sozinho.x1) / 2), y: encaixa((caixa ? caixa.y1 + ESPACO_ENTRE_PARTES : 0) - sozinho.y0) };
  return resolverConflitos({ ...d, blocos: [...d.blocos, novo] });
}

function proximoIdDeBloco(d: DesenhoDaSala): string {
  const usados = new Set(d.blocos.map(b => b.id));
  for (let i = d.blocos.length + 1; ; i++) if (!usados.has(`b${i}`)) return `b${i}`;
}

/** Quantos lugares numerados cada setor tem no desenho (para mostrar na lista de setores). */
export function lugaresPorSetor(d: DesenhoDaSala): Map<string, number> {
  const total = new Map<string, number>();
  for (const l of calcularLayout({ versao: 1, blocos: d.blocos, palco: null }).lugares) if (l.setor) total.set(l.setor, (total.get(l.setor) ?? 0) + 1);
  return total;
}

// ─── O palco e a planta de fundo ────────────────────────────────────────────

/** O palco em cima de tudo o que está desenhado, pistas incluídas (o palco do meio, de uma arena, segue no centro dos blocos). */
export function comPalcoDoDesenho(d: DesenhoDaSala): DesenhoDaSala {
  if (!d.palco) return d;
  if (d.palco.centralizado) return { ...d, ...comPalcoAcima(d) };
  const caixa = caixaDoDesenho(d);
  if (!caixa) return d;
  return { ...d, palco: { ...d.palco, x: (caixa.x0 + caixa.x1) / 2, y: caixa.y0 - 2.5, largura: Math.max(6, (caixa.x1 - caixa.x0) * 0.7), altura: 1.6 } };
}

const limita = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const meio = (v: number) => (Math.round(v * 2) / 2 === 0 ? 0 : Math.round(v * 2) / 2);

/** O fundo recém-escolhido: a imagem (de `larguraPx` x `alturaPx`) cobrindo o desenho com uma folga, centrada nele e com a proporção da imagem. */
export function fundoNovoDoDesenho(caminho: string, larguraPx: number, alturaPx: number, d: DesenhoDaSala): FundoDaPlanta {
  const caixa = caixaDoDesenho(d) ?? { x0: -30, x1: 30, y0: -20, y1: 20 };
  const proporcao = larguraPx > 0 && alturaPx > 0 ? larguraPx / alturaPx : 1.5;
  const largura = limita(Math.max(caixa.x1 - caixa.x0 + 12, (caixa.y1 - caixa.y0 + 12) * proporcao), 20, 4000);
  const altura = largura / proporcao;
  return { caminho, largura: Math.round(largura * 100) / 100, altura: Math.round(altura * 100) / 100, opacidade: OPACIDADE_PADRAO_DO_FUNDO, x: meio((caixa.x0 + caixa.x1) / 2 - largura / 2), y: meio((caixa.y0 + caixa.y1) / 2 - altura / 2) };
}

export function comFundoNoDesenho(d: DesenhoDaSala, fundo: FundoDaPlanta | null): DesenhoDaSala {
  const { fundo: _antigo, ...resto } = d;
  void _antigo;
  return fundo ? { ...resto, fundo } : resto;
}

export function posicionarFundoDoDesenho(d: DesenhoDaSala, x: number, y: number): DesenhoDaSala {
  return d.fundo ? { ...d, fundo: { ...d.fundo, x: limita(meio(x), -2000, 2000), y: limita(meio(y), -2000, 2000) } } : d;
}

/** Aumenta ou diminui o fundo por `fator`, mantendo a proporção e o centro (de 20 a 4.000 lugares de largura). */
export function escalarFundoDoDesenho(d: DesenhoDaSala, fator: number): DesenhoDaSala {
  const f = d.fundo;
  if (!f || !(fator > 0)) return d;
  const largura = limita(f.largura * fator, 20, 4000);
  const altura = f.altura * (largura / f.largura);
  if (altura > 4000 || altura < 1) return d;
  return { ...d, fundo: { ...f, largura: Math.round(largura * 100) / 100, altura: Math.round(altura * 100) / 100, x: meio(f.x + (f.largura - largura) / 2), y: meio(f.y + (f.altura - altura) / 2) } };
}

export function opacidadeDoFundoDoDesenho(d: DesenhoDaSala, opacidade: number): DesenhoDaSala {
  return d.fundo ? { ...d, fundo: { ...d.fundo, opacidade: limita(Math.round(opacidade), OPACIDADE_MINIMA_DO_FUNDO, OPACIDADE_MAXIMA_DO_FUNDO) } } : d;
}

/** Acrescenta ao desenho os blocos de um modelo, à direita de tudo o que já está, sem setor (a pessoa os atribui depois). */
export function acrescentarModelo(d: DesenhoDaSala, modelo: Layout): DesenhoDaSala {
  const dele = calcularLayout({ versao: 1, blocos: modelo.blocos, palco: null }).caixa;
  const caixa = caixaDoDesenho(d);
  const dx = caixa ? encaixa(caixa.x1 + ESPACO_ENTRE_PARTES - dele.x0) : 0;
  const dy = caixa ? encaixa((caixa.y0 + caixa.y1) / 2 - (dele.y0 + dele.y1) / 2) : 0;
  const usados = new Set(d.blocos.map(b => b.id));
  let n = 0;
  const novos = modelo.blocos.map(b => {
    let id: string;
    do id = `b${++n}`; while (usados.has(id));
    usados.add(id);
    return { ...b, id, setor: null, x: Math.max(-500, Math.min(500, b.x + dx)), y: Math.max(-500, Math.min(500, b.y + dy)) };
  });
  const comModelo = { ...d, blocos: [...d.blocos, ...novos], palco: d.palco ?? (modelo.palco ? { ...modelo.palco } : null) };
  return comPalcoDoDesenho(comModelo);
}
