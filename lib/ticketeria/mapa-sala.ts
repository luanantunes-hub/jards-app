// O mapa da SALA INTEIRA (M3 do estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.2 item 6): cada setor continua com o seu desenho em blocos (ticketeria_setores.layout) e a
// sala guarda só ONDE cada setor fica e a cor dele (ticketeria_salas.planta). A conta aqui junta tudo num desenho só: os blocos de cada setor, deslocados para o lugar do setor
// na sala, com o id do setor em cada bloco. Os lugares seguem com a identidade de sempre (setor, fileira, número); nada do que se desenha aqui muda um lugar vendido.
// Sem banco e sem imports de servidor (tests/ticketeria-mapa-sala.test.ts).

import { calcularLayout, lugaresSeSobrepoem, palcoAcima, type Layout, type Palco, lerLayout } from "@/lib/ticketeria/mapa-layout";
import { encaixa } from "@/lib/ticketeria/mapa-layout-editor";

/** As cores dos setores, em ordem (lilás, laranja, verde, azul-petróleo, magenta, ocre, azul, oliva): distintas entre si e escuras o bastante para texto branco e para borda sobre branco. */
export const CORES_DOS_SETORES: readonly string[] = ["#6450D2", "#D9480F", "#2E8932", "#0B7285", "#B02A6B", "#8A6D00", "#364FC7", "#5C940D"];

export const MAX_SETORES_NA_PLANTA = 40;
const LIMITE_DE_COORDENADA = 2000;
/** O espaço, em lugares, entre um setor e o seguinte quando a sala se arruma sozinha. */
export const ESPACO_ENTRE_SETORES = 4;

export type SetorNaPlanta = { setor: string; x: number; y: number; cor: string };
/** `palco`: o palco da sala; null deixa a sala sem palco desenhado. */
export type Planta = { versao: 1; setores: SetorNaPlanta[]; palco: Palco | null };
/** Um setor numerado que tem desenho em blocos: o que a sala sabe dele. */
export type SetorDesenhado = { id: string; nome: string; layout: Layout };

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
    vistos.add(s.setor);
    setores.push({ setor: s.setor, x: s.x, y: s.y, cor: s.cor });
  }
  let palco: Palco | null = null;
  if (r.palco !== undefined && r.palco !== null) {
    const p = objeto(r.palco);
    if (!p || !numero(p.x, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) || !numero(p.y, -LIMITE_DE_COORDENADA, LIMITE_DE_COORDENADA) || !numero(p.largura, 1, 2000) || !numero(p.altura, 0.5, 100) || typeof p.rotulo !== "string" || p.rotulo.length < 1 || p.rotulo.length > 30) return null;
    palco = { x: p.x, y: p.y, largura: p.largura, altura: p.altura, rotulo: p.rotulo };
  }
  return { versao: 1, setores, palco };
}

/** O que a compra recebe da sala: a planta e o desenho de cada setor dela (só os que se desenham). null se não vem nada que se entenda. */
export function lerSalaDoMapa(resposta: unknown): { planta: Planta; setores: SetorDesenhado[]; /** O setor do ingresso que a pessoa está comprando. */ atual: string } | null {
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
  return setores.some(s => s.id === r.atual) ? { planta, setores, atual: r.atual } : null; // sem o setor da compra desenhado, não há mapa da sala para ela
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
export function comporSala(planta: Planta, setores: readonly SetorDesenhado[]): { layout: Layout; cores: Map<string, string> } {
  const cores = new Map<string, string>();
  const blocos = planta.setores.flatMap(entrada => {
    const setor = setores.find(s => s.id === entrada.setor);
    if (!setor) return [];
    cores.set(setor.id, entrada.cor);
    return setor.layout.blocos.map(b => ({ ...b, id: idDoBlocoNaSala(setor.id, b.id), setor: setor.id, x: b.x + entrada.x, y: b.y + entrada.y }));
  });
  return { layout: { versao: 1, blocos, palco: planta.palco }, cores };
}

/** O retângulo (do desenho do próprio setor) que o setor ocupa, sem palco. */
function caixaDoSetor(s: SetorDesenhado) {
  return calcularLayout({ ...s.layout, palco: null }).caixa;
}

/** O palco da sala em cima de tudo o que está desenhado (o rótulo é mantido). */
export function comPalcoDaSala(planta: Planta, setores: readonly SetorDesenhado[]): Planta {
  const { layout } = comporSala(planta, setores);
  if (layout.blocos.length === 0) return planta;
  return { ...planta, palco: palcoAcima(layout.blocos, planta.palco?.rotulo ?? "Palco") };
}

/**
 * A sala arrumada sozinha: os setores um embaixo do outro, na ordem dada (o primeiro mais perto do palco), centrados, cada um com uma cor da lista. O ponto de partida
 * de quem abre o mapa da sala pela primeira vez.
 */
export function plantaAutomatica(setores: readonly SetorDesenhado[], rotuloDoPalco = "Palco"): Planta {
  let topo = 0;
  const entradas: SetorNaPlanta[] = setores.slice(0, MAX_SETORES_NA_PLANTA).map((s, i) => {
    const c = caixaDoSetor(s);
    const entrada = { setor: s.id, x: semMenosZero(encaixa(-(c.x0 + c.x1) / 2)), y: semMenosZero(encaixa(topo - c.y0)), cor: CORES_DOS_SETORES[i % CORES_DOS_SETORES.length] };
    topo += c.y1 - c.y0 + ESPACO_ENTRE_SETORES;
    return entrada;
  });
  const planta: Planta = { versao: 1, setores: entradas, palco: null };
  const { layout } = comporSala(planta, setores);
  return { ...planta, palco: layout.blocos.length > 0 ? palcoAcima(layout.blocos, setores[0]?.layout.palco?.rotulo ?? rotuloDoPalco) : null };
}

/**
 * A planta que já existe posta em dia com os setores de hoje: o setor que sumiu sai, o que ganhou desenho entra embaixo de tudo (com a próxima cor livre).
 * Sem planta, a sala se arruma sozinha.
 */
export function completarPlanta(planta: Planta | null, setores: readonly SetorDesenhado[]): Planta {
  if (!planta) return plantaAutomatica(setores);
  const ids = new Set(setores.map(s => s.id));
  const mantidos = planta.setores.filter(e => ids.has(e.setor));
  const novos = setores.filter(s => !mantidos.some(e => e.setor === s.id));
  if (novos.length === 0 && mantidos.length === planta.setores.length) return planta;
  const { layout } = comporSala({ ...planta, setores: mantidos }, setores);
  let topo = layout.blocos.length > 0 ? calcularLayout({ ...layout, palco: null }).caixa.y1 + ESPACO_ENTRE_SETORES : 0;
  const entradas = [...mantidos];
  for (const s of novos) {
    if (entradas.length >= MAX_SETORES_NA_PLANTA) break;
    const c = caixaDoSetor(s);
    const usadas = new Set(entradas.map(e => e.cor));
    const cor = CORES_DOS_SETORES.find(x => !usadas.has(x)) ?? CORES_DOS_SETORES[entradas.length % CORES_DOS_SETORES.length];
    entradas.push({ setor: s.id, x: semMenosZero(encaixa(-(c.x0 + c.x1) / 2)), y: semMenosZero(encaixa(topo - c.y0)), cor });
    topo += c.y1 - c.y0 + ESPACO_ENTRE_SETORES;
  }
  return comPalcoDaSala({ ...planta, setores: entradas }, setores);
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

/** Os problemas da planta (vazia = serve): nenhum setor, ou setores em cima um do outro. */
export function conferirPlanta(planta: Planta, setores: readonly SetorDesenhado[]): ErroDaPlanta[] {
  const { layout } = comporSala(planta, setores);
  if (layout.blocos.length === 0) return ["sem_setores"];
  return lugaresSeSobrepoem(calcularLayout(layout).lugares) ? ["setores_sobrepostos"] : [];
}
