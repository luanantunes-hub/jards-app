// O mapa da SALA INTEIRA (M3 do estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.2 item 6): cada setor continua com o seu desenho em blocos (ticketeria_setores.layout) e a
// sala guarda só ONDE cada setor fica e a cor dele (ticketeria_salas.planta). A conta aqui junta tudo num desenho só: os blocos de cada setor, deslocados para o lugar do setor
// na sala, com o id do setor em cada bloco. Os lugares seguem com a identidade de sempre (setor, fileira, número); nada do que se desenha aqui muda um lugar vendido.
// Sem banco e sem imports de servidor (tests/ticketeria-mapa-sala.test.ts).

import { calcularLayout, lugaresSeSobrepoem, type Layout, type Palco, lerLayout } from "@/lib/ticketeria/mapa-layout";
import { encaixa } from "@/lib/ticketeria/mapa-layout-editor";

/** As cores dos setores, em ordem (lilás, laranja, verde, azul-petróleo, magenta, ocre, azul, oliva): distintas entre si e escuras o bastante para texto branco e para borda sobre branco. */
export const CORES_DOS_SETORES: readonly string[] = ["#6450D2", "#D9480F", "#2E8932", "#0B7285", "#B02A6B", "#8A6D00", "#364FC7", "#5C940D"];

export const MAX_SETORES_NA_PLANTA = 40;
const LIMITE_DE_COORDENADA = 2000;
/** O espaço, em lugares, entre um setor e o seguinte quando a sala se arruma sozinha. */
export const ESPACO_ENTRE_SETORES = 4;

/**
 * Um setor SEM lugares numerados (pista, área em pé) na planta: um retângulo, com o canto de cima à esquerda em (x, y) da entrada e este tamanho (em lugares). Quem entra aqui é só o desenho:
 * o setor continua vendendo por quantidade, dentro da capacidade dele, como sempre.
 */
export type AreaDaPlanta = { largura: number; altura: number };
export const AREA_MINIMA = 2;
export const AREA_MAXIMA = 400;
export type SetorNaPlanta = { setor: string; x: number; y: number; cor: string; area?: AreaDaPlanta };
/**
 * A planta da sala por baixo do desenho (M4): uma imagem da biblioteca de imagens da loja (`caminho` no espaço `ticketeria-site`), com o canto de cima à esquerda em (x, y), do tamanho
 * `largura` x `altura` (em lugares) e com a opacidade de 10 a 100. Só ajuda a pessoa a desenhar e a situar quem compra; não muda lugar nenhum.
 */
export type FundoDaPlanta = { caminho: string; x: number; y: number; largura: number; altura: number; opacidade: number };
/** `palco`: o palco da sala; null deixa a sala sem palco desenhado. */
export type Planta = { versao: 1; setores: SetorNaPlanta[]; palco: Palco | null; fundo?: FundoDaPlanta | null };

export const OPACIDADE_MINIMA_DO_FUNDO = 10;
export const OPACIDADE_MAXIMA_DO_FUNDO = 100;
export const OPACIDADE_PADRAO_DO_FUNDO = 40;
const LIMITE_DE_TAMANHO_DO_FUNDO = 4000;
const CAMINHO_DO_FUNDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$/i;
const ESPACO_DAS_IMAGENS_DO_SITE = "ticketeria-site";

/** O endereço público da imagem do fundo, a partir do endereço do Supabase do projeto (o espaço de arquivos é público). */
export const urlDoFundo = (caminho: string, baseDoSupabase: string) => `${baseDoSupabase.replace(/\/+$/, "")}/storage/v1/object/public/${ESPACO_DAS_IMAGENS_DO_SITE}/${caminho}`;
/** O caminho da imagem a partir do endereço público que a biblioteca devolve (nulo se não é uma imagem dela). */
export function caminhoDoFundoPelaUrl(url: string): string | null {
  const i = url.indexOf(`/${ESPACO_DAS_IMAGENS_DO_SITE}/`);
  const caminho = i < 0 ? "" : url.slice(i + ESPACO_DAS_IMAGENS_DO_SITE.length + 2).split("?")[0];
  return CAMINHO_DO_FUNDO.test(caminho) ? caminho : null;
}
/** Um setor numerado que tem desenho em blocos: o que a sala sabe dele. */
export type SetorDesenhado = { id: string; nome: string; layout: Layout };

/** Um setor em pé (não numerado) da sala: o que a sala sabe dele para desenhá-lo. */
export type SetorEmPe = { id: string; nome: string; capacidade: number };
/** Uma área em pé pronta para desenhar: o nome, o que escrever embaixo dele, a cor e o retângulo. */
export type AreaNoDesenho = { setor: string; nome: string; detalhe: string; cor: string; x: number; y: number; largura: number; altura: number };

/** "Em pé · 800 pessoas". */
export const detalheDaArea = (capacidade: number) => `Em pé · ${capacidade.toLocaleString("pt-BR")} ${capacidade === 1 ? "pessoa" : "pessoas"}`;

export type ErroDaPlanta = "sem_setores" | "setores_sobrepostos";
export const ERRO_DA_PLANTA_EM_TEXTO: Record<ErroDaPlanta, string> = {
  sem_setores: "Nenhum setor desenhado em blocos para pôr no mapa da sala.",
  setores_sobrepostos: "Há setores um em cima do outro. Afaste-os.",
};

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const numero = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const limita = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Sem -0 (o JSON o guarda como 0, e a planta lida do banco tem de ser igual à que se gravou). */
const semMenosZero = (v: number) => (v === 0 ? 0 : v);
const arredondaMeio = (v: number) => semMenosZero(Math.round(v * 2) / 2);

/** A planta que o banco guarda ou que a compra recebe, conferida; null se não é uma planta que se desenha. */
export function lerPlanta(resposta: unknown): Planta | null {
  const r = objeto(resposta);
  if (!r || r.versao !== 1 || !Array.isArray(r.setores) || r.setores.length < 1 || r.setores.length > MAX_SETORES_NA_PLANTA) return null;
  const vistos = new Set<string>();
  const setores: SetorNaPlanta[] = [];
  for (const bruto of r.setores) {
    const s = objeto(bruto);
    if (!s || typeof s.setor !== "string" || s.setor.length < 1 || s.setor.length > 64 || s.setor.includes(":") || vistos.has(s.setor)) return null;
    if (!numero(s.x, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) || !numero(s.y, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA)) return null;
    if (typeof s.cor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(s.cor)) return null;
    let area: AreaDaPlanta | undefined;
    if (s.area !== undefined && s.area !== null) {
      const a = objeto(s.area);
      if (!a || !numero(a.largura, AREA_MINIMA, AREA_MAXIMA) || !numero(a.altura, AREA_MINIMA, AREA_MAXIMA)) return null;
      area = { largura: a.largura, altura: a.altura };
    }
    vistos.add(s.setor);
    setores.push({ setor: s.setor, x: s.x, y: s.y, cor: s.cor, ...(area ? { area } : {}) });
  }
  let palco: Palco | null = null;
  if (r.palco !== undefined && r.palco !== null) {
    const p = objeto(r.palco);
    if (!p || !numero(p.x, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) || !numero(p.y, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) || !numero(p.largura, 1, 2000) || !numero(p.altura, 0.5, 100) || typeof p.rotulo !== "string" || p.rotulo.length < 1 || p.rotulo.length > 30) return null;
    palco = { x: p.x, y: p.y, largura: p.largura, altura: p.altura, rotulo: p.rotulo };
  }
  let fundo: FundoDaPlanta | null = null;
  if (r.fundo !== undefined && r.fundo !== null) {
    const f = objeto(r.fundo);
    if (!f || typeof f.caminho !== "string" || !CAMINHO_DO_FUNDO.test(f.caminho)) return null;
    if (!numero(f.x, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) || !numero(f.y, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA)) return null;
    if (!numero(f.largura, 1, LIMITE_DE_TAMANHO_DO_FUNDO) || !numero(f.altura, 1, LIMITE_DE_TAMANHO_DO_FUNDO)) return null;
    if (!numero(f.opacidade, OPACIDADE_MINIMA_DO_FUNDO, OPACIDADE_MAXIMA_DO_FUNDO) || !Number.isInteger(f.opacidade)) return null;
    fundo = { caminho: f.caminho, x: f.x, y: f.y, largura: f.largura, altura: f.altura, opacidade: f.opacidade };
  }
  return { versao: 1, setores, palco, ...(fundo ? { fundo } : {}) };
}

/** O que a compra recebe da sala: a planta e o desenho de cada setor dela (só os que se desenham). null se não vem nada que se entenda. */
export function lerSalaDoMapa(resposta: unknown): { planta: Planta; setores: SetorDesenhado[]; emPe: SetorEmPe[]; /** O setor do ingresso que a pessoa está comprando. */ atual: string } | null {
  const r = objeto(resposta);
  const planta = r ? lerPlanta(r.planta) : null;
  if (!r || !planta || !Array.isArray(r.setores) || typeof r.atual !== "string") return null;
  const setores: SetorDesenhado[] = [];
  for (const bruto of r.setores) {
    const s = objeto(bruto);
    const layout = s ? lerLayout(s.layout) : null;
    if (!s || typeof s.id !== "string" || typeof s.nome !== "string" || !layout) continue; // um setor que não se entende some do mapa da sala; os outros seguem
    setores.push({ id: s.id, nome: s.nome, layout });
  }
  const emPe: SetorEmPe[] = [];
  for (const bruto of Array.isArray(r.em_pe) ? r.em_pe : []) {
    const e = objeto(bruto);
    if (!e || typeof e.id !== "string" || typeof e.nome !== "string" || typeof e.capacidade !== "number" || !Number.isInteger(e.capacidade) || e.capacidade < 1) continue;
    emPe.push({ id: e.id, nome: e.nome, capacidade: e.capacidade });
  }
  return setores.some(s => s.id === r.atual) ? { planta, setores, emPe, atual: r.atual } : null; // sem o setor da compra desenhado, não há mapa da sala para ela
}

/** O id de um bloco da sala: o do setor e o do bloco dele (o id do setor nunca tem ":"). */
export const idDoBlocoNaSala = (setor: string, bloco: string) => `${setor}:${bloco}`;
export function partesDoBlocoNaSala(id: string): { setor: string; bloco: string } | null {
  const i = id.indexOf(":");
  return i > 0 ? { setor: id.slice(0, i), bloco: id.slice(i + 1) } : null;
}

/**
 * O desenho da sala: os blocos de cada setor da planta (na ordem dela), deslocados para o lugar do setor, e o palco da sala. Setor que a planta cita e que não tem
 * desenho (apagado, ou sem layout) fica de fora, e o desenho dele que a planta não cita também.
 */
export function comporSala(planta: Planta, setores: readonly SetorDesenhado[], emPe: readonly SetorEmPe[] = []): { layout: Layout; cores: Map<string, string>; fundo: FundoDaPlanta | null; areas: AreaNoDesenho[] } {
  const cores = new Map<string, string>();
  const areas: AreaNoDesenho[] = [];
  const blocos = planta.setores.flatMap(entrada => {
    if (entrada.area) {
      const pe = emPe.find(e => e.id === entrada.setor);
      if (!pe) return [];
      cores.set(pe.id, entrada.cor);
      areas.push({ setor: pe.id, nome: pe.nome, detalhe: detalheDaArea(pe.capacidade), cor: entrada.cor, x: entrada.x, y: entrada.y, largura: entrada.area.largura, altura: entrada.area.altura });
      return [];
    }
    const setor = setores.find(s => s.id === entrada.setor);
    if (!setor) return [];
    cores.set(setor.id, entrada.cor);
    return setor.layout.blocos.map(b => ({ ...b, id: idDoBlocoNaSala(setor.id, b.id), setor: setor.id, x: b.x + entrada.x, y: b.y + entrada.y }));
  });
  return { layout: { versao: 1, blocos, palco: planta.palco }, cores, fundo: planta.fundo ?? null, areas };
}

/** O retângulo que cobre os lugares e as áreas em pé (nulo se não há nada desenhado). */
export function caixaDaSala(layout: Layout, areas: readonly AreaNoDesenho[]): { x0: number; y0: number; x1: number; y1: number } | null {
  const caixas = [...(layout.blocos.length > 0 ? [calcularLayout({ ...layout, palco: null }).caixa] : []), ...areas.map(a => ({ x0: a.x, y0: a.y, x1: a.x + a.largura, y1: a.y + a.altura }))];
  if (caixas.length === 0) return null;
  return { x0: Math.min(...caixas.map(c => c.x0)), y0: Math.min(...caixas.map(c => c.y0)), x1: Math.max(...caixas.map(c => c.x1)), y1: Math.max(...caixas.map(c => c.y1)) };
}

/** O palco em cima de uma caixa: centrado, 2,5 acima dela, com 70% da largura (no mínimo 6). */
const palcoSobre = (caixa: { x0: number; y0: number; x1: number; y1: number }, rotulo: string): Palco => ({ x: (caixa.x0 + caixa.x1) / 2, y: caixa.y0 - 2.5, largura: Math.max(6, (caixa.x1 - caixa.x0) * 0.7), altura: 1.6, rotulo });

/** O retângulo (do desenho do próprio setor) que o setor ocupa, sem palco. */
function caixaDoSetor(s: SetorDesenhado) {
  return calcularLayout({ ...s.layout, palco: null }).caixa;
}

/** O palco da sala em cima de tudo o que está desenhado (o rótulo é mantido). */
export function comPalcoDaSala(planta: Planta, setores: readonly SetorDesenhado[], emPe: readonly SetorEmPe[] = []): Planta {
  const { layout, areas } = comporSala(planta, setores, emPe);
  const caixa = caixaDaSala(layout, areas);
  return caixa ? { ...planta, palco: palcoSobre(caixa, planta.palco?.rotulo ?? "Palco") } : planta;
}

/** O tamanho de partida da área de um setor em pé: tão larga quanto o maior setor numerado (ou 30) e alta o bastante para a capacidade (cerca de 1,5 pessoa por lugar de área). */
function areaDePartida(capacidade: number, larguraDeReferencia: number): AreaDaPlanta {
  const largura = limita(Math.round(larguraDeReferencia), 20, AREA_MAXIMA);
  return { largura, altura: limita(Math.round(capacidade / largura / 1.5), 6, 40) };
}

const larguraDoMaiorSetor = (setores: readonly SetorDesenhado[]) => (setores.length > 0 ? Math.max(...setores.map(s => { const c = caixaDoSetor(s); return c.x1 - c.x0; })) : 30);

/**
 * A sala arrumada sozinha: as áreas em pé em cima (perto do palco, como uma pista) e os setores numerados um embaixo do outro, na ordem dada, tudo centrado e cada um com uma cor
 * da lista. O ponto de partida de quem abre o mapa da sala pela primeira vez.
 */
export function plantaAutomatica(setores: readonly SetorDesenhado[], rotuloDoPalco = "Palco", emPe: readonly SetorEmPe[] = []): Planta {
  let topo = 0;
  const referencia = larguraDoMaiorSetor(setores);
  const entradas: SetorNaPlanta[] = [];
  for (const pe of emPe) {
    if (entradas.length >= MAX_SETORES_NA_PLANTA) break;
    const area = areaDePartida(pe.capacidade, referencia);
    entradas.push({ setor: pe.id, x: semMenosZero(encaixa(-area.largura / 2)), y: semMenosZero(encaixa(topo)), cor: CORES_DOS_SETORES[entradas.length % CORES_DOS_SETORES.length], area });
    topo += area.altura + ESPACO_ENTRE_SETORES;
  }
  for (const s of setores) {
    if (entradas.length >= MAX_SETORES_NA_PLANTA) break;
    const c = caixaDoSetor(s);
    entradas.push({ setor: s.id, x: semMenosZero(encaixa(-(c.x0 + c.x1) / 2)), y: semMenosZero(encaixa(topo - c.y0)), cor: CORES_DOS_SETORES[entradas.length % CORES_DOS_SETORES.length] });
    topo += c.y1 - c.y0 + ESPACO_ENTRE_SETORES;
  }
  const planta: Planta = { versao: 1, setores: entradas, palco: null };
  const { layout, areas } = comporSala(planta, setores, emPe);
  const caixa = caixaDaSala(layout, areas);
  return { ...planta, palco: caixa ? palcoSobre(caixa, setores[0]?.layout.palco?.rotulo ?? rotuloDoPalco) : null };
}

/**
 * A planta que já existe posta em dia com os setores de hoje: o setor que sumiu sai, o que apareceu entra embaixo de tudo (com a próxima cor livre), e o que mudou de numerado para em pé
 * (ou o contrário) troca de desenho. Sem planta, a sala se arruma sozinha.
 */
export function completarPlanta(planta: Planta | null, setores: readonly SetorDesenhado[], emPe: readonly SetorEmPe[] = []): Planta {
  if (!planta) return plantaAutomatica(setores, "Palco", emPe);
  const numerados = new Set(setores.map(s => s.id));
  const emPeIds = new Map(emPe.map(e => [e.id, e]));
  const referencia = larguraDoMaiorSetor(setores);
  const mantidos: SetorNaPlanta[] = [];
  for (const e of planta.setores) {
    const pe = emPeIds.get(e.setor);
    if (pe) mantidos.push(e.area ? e : { ...e, area: areaDePartida(pe.capacidade, referencia) });
    else if (numerados.has(e.setor)) { if (e.area) { const { area: _tira, ...resto } = e; void _tira; mantidos.push(resto); } else mantidos.push(e); }
  }
  const aindaFora = [...emPe.filter(e => !mantidos.some(m => m.setor === e.id)).map(e => ({ pe: e, s: null as SetorDesenhado | null })), ...setores.filter(s => !mantidos.some(m => m.setor === s.id)).map(s => ({ pe: null as SetorEmPe | null, s }))];
  if (aindaFora.length === 0 && mantidos.length === planta.setores.length && mantidos.every((e, i) => e === planta.setores[i])) return planta;
  const { layout, areas } = comporSala({ ...planta, setores: mantidos }, setores, emPe);
  const atual = caixaDaSala(layout, areas);
  let topo = atual ? atual.y1 + ESPACO_ENTRE_SETORES : 0;
  const entradas = [...mantidos];
  for (const { pe, s } of aindaFora) {
    if (entradas.length >= MAX_SETORES_NA_PLANTA) break;
    const usadas = new Set(entradas.map(e => e.cor));
    const cor = CORES_DOS_SETORES.find(x => !usadas.has(x)) ?? CORES_DOS_SETORES[entradas.length % CORES_DOS_SETORES.length];
    if (pe) {
      const area = areaDePartida(pe.capacidade, referencia);
      entradas.push({ setor: pe.id, x: semMenosZero(encaixa(-area.largura / 2)), y: semMenosZero(encaixa(topo)), cor, area });
      topo += area.altura + ESPACO_ENTRE_SETORES;
    } else if (s) {
      const c = caixaDoSetor(s);
      entradas.push({ setor: s.id, x: semMenosZero(encaixa(-(c.x0 + c.x1) / 2)), y: semMenosZero(encaixa(topo - c.y0)), cor });
      topo += c.y1 - c.y0 + ESPACO_ENTRE_SETORES;
    }
  }
  return comPalcoDaSala({ ...planta, setores: entradas }, setores, emPe);
}

/** Move o setor inteiro (todos os blocos dele juntos) em `dx` e `dy`, encaixando em meio lugar. */
export function moverSetor(planta: Planta, setor: string, dx: number, dy: number): Planta {
  return { ...planta, setores: planta.setores.map(e => (e.setor === setor ? { ...e, x: semMenosZero(limita(encaixa(e.x + dx), -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA)), y: semMenosZero(limita(encaixa(e.y + dy), -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA)) } : e)) };
}

/** Põe o setor inteiro em (x, y), encaixando em meio lugar: é o que o arraste usa (a posição de partida mais o quanto o ponteiro andou, sempre a partir do começo do gesto). */
export function posicionarSetor(planta: Planta, setor: string, x: number, y: number): Planta {
  return { ...planta, setores: planta.setores.map(e => (e.setor === setor ? { ...e, x: semMenosZero(limita(encaixa(x), -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA)), y: semMenosZero(limita(encaixa(y), -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA)) } : e)) };
}

export function comCorDoSetor(planta: Planta, setor: string, cor: string): Planta {
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? { ...planta, setores: planta.setores.map(e => (e.setor === setor ? { ...e, cor } : e)) } : planta;
}

/** Muda o tamanho da área em pé de um setor (de 2 a 400 lugares de cada lado, em meios lugares). */
export function comTamanhoDaArea(planta: Planta, setor: string, largura: number, altura: number): Planta {
  return { ...planta, setores: planta.setores.map(e => (e.setor === setor && e.area ? { ...e, area: { largura: limita(arredondaMeio(largura), AREA_MINIMA, AREA_MAXIMA), altura: limita(arredondaMeio(altura), AREA_MINIMA, AREA_MAXIMA) } } : e)) };
}

/** Aumenta ou diminui a área em pé em `dl` de largura e `da` de altura. */
export function ajustarArea(planta: Planta, setor: string, dl: number, da: number): Planta {
  const e = planta.setores.find(x => x.setor === setor);
  return e?.area ? comTamanhoDaArea(planta, setor, e.area.largura + dl, e.area.altura + da) : planta;
}

/** Os problemas da planta (vazia = serve): nada desenhado, ou setores em cima um do outro (lugar com lugar, área com área, ou lugar dentro de uma área). */
export function conferirPlanta(planta: Planta, setores: readonly SetorDesenhado[], emPe: readonly SetorEmPe[] = []): ErroDaPlanta[] {
  const { layout, areas } = comporSala(planta, setores, emPe);
  if (layout.blocos.length === 0 && areas.length === 0) return ["sem_setores"];
  const lugares = layout.blocos.length > 0 ? calcularLayout(layout).lugares : [];
  if (lugaresSeSobrepoem(lugares)) return ["setores_sobrepostos"];
  const seCruzam = (a: AreaNoDesenho, b: AreaNoDesenho) => a.x < b.x + b.largura && b.x < a.x + a.largura && a.y < b.y + b.altura && b.y < a.y + a.altura;
  if (areas.some((a, i) => areas.slice(i + 1).some(b => seCruzam(a, b)))) return ["setores_sobrepostos"];
  if (areas.some(a => lugares.some(l => l.x > a.x - 0.5 && l.x < a.x + a.largura + 0.5 && l.y > a.y - 0.5 && l.y < a.y + a.altura + 0.5))) return ["setores_sobrepostos"];
  return [];
}

// ─── A planta de fundo ──────────────────────────────────────────────────────

/**
 * O fundo recém-escolhido: a imagem (de `larguraPx` x `alturaPx` pixels) cobrindo o desenho dos setores com uma folga, centrada nele e com a proporção da imagem. Sem setor desenhado, um
 * retângulo de 60 lugares de largura em volta da origem.
 */
export function fundoNovo(caminho: string, larguraPx: number, alturaPx: number, setores: readonly SetorDesenhado[], planta: Planta, emPe: readonly SetorEmPe[] = []): FundoDaPlanta {
  const { layout, areas } = comporSala(planta, setores, emPe);
  const caixa = caixaDaSala(layout, areas) ?? { x0: -30, x1: 30, y0: -20, y1: 20 };
  const proporcao = larguraPx > 0 && alturaPx > 0 ? larguraPx / alturaPx : 1.5;
  const largura = limita(Math.max(caixa.x1 - caixa.x0 + 12, (caixa.y1 - caixa.y0 + 12) * proporcao), 20, LIMITE_DE_TAMANHO_DO_FUNDO);
  const altura = largura / proporcao;
  return {
    caminho, largura: Math.round(largura * 100) / 100, altura: Math.round(altura * 100) / 100, opacidade: OPACIDADE_PADRAO_DO_FUNDO,
    x: arredondaMeio((caixa.x0 + caixa.x1) / 2 - largura / 2), y: arredondaMeio((caixa.y0 + caixa.y1) / 2 - altura / 2),
  };
}

export function comFundo(planta: Planta, fundo: FundoDaPlanta | null): Planta {
  const { fundo: _antigo, ...resto } = planta;
  void _antigo;
  return fundo ? { ...resto, fundo } : resto;
}

/** O canto de cima à esquerda do fundo em (x, y), encaixado em meio lugar. */
export function posicionarFundo(planta: Planta, x: number, y: number): Planta {
  return planta.fundo ? { ...planta, fundo: { ...planta.fundo, x: limita(arredondaMeio(x), -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA), y: limita(arredondaMeio(y), -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) } } : planta;
}

/** Aumenta ou diminui o fundo por `fator` mantendo a proporção e o centro onde está (de 20 a 4.000 lugares de largura). */
export function escalarFundo(planta: Planta, fator: number): Planta {
  const f = planta.fundo;
  if (!f || !(fator > 0)) return planta;
  const largura = limita(f.largura * fator, 20, LIMITE_DE_TAMANHO_DO_FUNDO);
  const real = largura / f.largura;
  const altura = f.altura * real;
  if (altura > LIMITE_DE_TAMANHO_DO_FUNDO || altura < 1) return planta;
  return { ...planta, fundo: { ...f, largura: Math.round(largura * 100) / 100, altura: Math.round(altura * 100) / 100, x: arredondaMeio(f.x + (f.largura - largura) / 2), y: arredondaMeio(f.y + (f.altura - altura) / 2) } };
}

export function comOpacidadeDoFundo(planta: Planta, opacidade: number): Planta {
  const f = planta.fundo;
  return f ? { ...planta, fundo: { ...f, opacidade: limita(Math.round(opacidade), OPACIDADE_MINIMA_DO_FUNDO, OPACIDADE_MAXIMA_DO_FUNDO) } } : planta;
}
