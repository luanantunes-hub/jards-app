// As contas do editor do layout do mapa (M1 do estudo ticketeria-mapa-de-assentos-avancado.md): escolher um modelo, ajustar cada bloco (numeração, curva, ângulo, corredor, fileiras,
// posição) e as frases dos erros. Tudo sobre o `Layout` de mapa-layout.ts, sem mudá-lo no lugar: cada função devolve um layout novo. Só lógica (tests/ticketeria-mapa-layout-editor.test.ts).

import { MAX_FILEIRAS, MAX_LUGARES_NA_FILEIRA, proximoNomeDeFileira } from "@/lib/ticketeria/mapa";
import {
  CAMAROTE_MAX, COLUNAS_MAX, MAX_BLOCOS, MESA_MAX, MESA_MIN, blocoNovo, calcularLayout, raioDaMesa, type FormaDoGrupo, type Grupo, modeloArena, modeloContinental, modeloCorredorCentral, modeloLeque, modeloPlateiaEBalcao, modeloTresBlocos, palcoAcima, type Bloco, type ErroDoLayout, type Layout, type Numeracao,
} from "@/lib/ticketeria/mapa-layout";

// ─── Os modelos para começar ────────────────────────────────────────────────

export type ModeloId = "corredor" | "tres-blocos" | "leque" | "balcao" | "continental" | "arena";
export const MODELOS: readonly ModeloId[] = ["corredor", "tres-blocos", "leque", "balcao", "continental", "arena"];

export const MODELO_EM_TEXTO: Record<ModeloId, { nome: string; descricao: string }> = {
  corredor: { nome: "Corredor central", descricao: "Um bloco reto, com um corredor no meio." },
  "tres-blocos": { nome: "Três blocos", descricao: "Esquerda, centro e direita, com dois corredores." },
  leque: { nome: "Leque", descricao: "Fileiras em arco em volta do palco." },
  balcao: { nome: "Plateia e balcão", descricao: "A plateia na frente e o balcão atrás." },
  continental: { nome: "Continental", descricao: "Fileiras longas, sem corredor no meio." },
  arena: { nome: "Arena", descricao: "O palco no meio e blocos em volta." },
};

/** Os números de cada modelo, e o que cada um quer dizer na tela. */
export type ParametrosDoModelo = { fileiras: number; lugares: number; laterais: number; centro: number; primeira: number; aumento: number; balcao: number; largura: number };

export const PARAMETROS_PADRAO: ParametrosDoModelo = { fileiras: 8, lugares: 14, laterais: 8, centro: 14, primeira: 10, aumento: 2, balcao: 4, largura: 30 };

/** Quais números cada modelo usa, com o menor, o maior e o nome na tela. */
export const CAMPOS_DO_MODELO: Record<ModeloId, { campo: keyof ParametrosDoModelo; rotulo: string; min: number; max: number }[]> = {
  corredor: [{ campo: "fileiras", rotulo: "Fileiras", min: 1, max: 40 }, { campo: "lugares", rotulo: "Lugares por fileira", min: 2, max: 60 }],
  "tres-blocos": [{ campo: "fileiras", rotulo: "Fileiras", min: 1, max: 40 }, { campo: "laterais", rotulo: "Lugares de cada lado", min: 2, max: 20 }, { campo: "centro", rotulo: "Lugares no centro", min: 2, max: 40 }],
  leque: [{ campo: "fileiras", rotulo: "Fileiras", min: 2, max: 30 }, { campo: "primeira", rotulo: "Lugares na 1ª fileira", min: 4, max: 40 }, { campo: "aumento", rotulo: "A mais em cada fileira", min: 0, max: 4 }],
  balcao: [{ campo: "fileiras", rotulo: "Fileiras da plateia", min: 1, max: 30 }, { campo: "balcao", rotulo: "Fileiras do balcão", min: 1, max: 20 }, { campo: "lugares", rotulo: "Lugares por fileira", min: 2, max: 60 }],
  continental: [{ campo: "fileiras", rotulo: "Fileiras", min: 1, max: 40 }, { campo: "largura", rotulo: "Lugares por fileira", min: 10, max: 80 }],
  arena: [{ campo: "fileiras", rotulo: "Fileiras de cada lado", min: 1, max: 12 }, { campo: "lugares", rotulo: "Lugares na frente e no fundo", min: 6, max: 40 }, { campo: "laterais", rotulo: "Lugares nas laterais", min: 4, max: 30 }],
};

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

/** O layout de um modelo com os números dados (cada um é trazido para dentro do limite do modelo). */
export function layoutDoModelo(modelo: ModeloId, p: ParametrosDoModelo = PARAMETROS_PADRAO): Layout {
  const v = (campo: keyof ParametrosDoModelo) => {
    const c = CAMPOS_DO_MODELO[modelo].find(x => x.campo === campo)!;
    return entre(p[campo], c.min, c.max);
  };
  if (modelo === "corredor") return modeloCorredorCentral(v("fileiras"), v("lugares"));
  if (modelo === "tres-blocos") return modeloTresBlocos(v("fileiras"), v("laterais"), v("centro"));
  if (modelo === "balcao") return modeloPlateiaEBalcao(v("fileiras"), v("lugares"), v("balcao"));
  if (modelo === "continental") return modeloContinental(v("fileiras"), v("largura"));
  if (modelo === "arena") return modeloArena(v("fileiras"), v("lugares"), v("laterais"));
  // O raio acompanha a largura da fileira mais larga (uma fileira de 54 lugares num raio de 12 daria a volta no palco).
  const larga = Math.min(MAX_LUGARES_NA_FILEIRA, v("primeira") + (v("fileiras") - 1) * v("aumento"));
  return modeloLeque(v("fileiras"), v("primeira"), v("aumento"), Math.max(12, Math.ceil(larga / 2)));
}

// ─── Mexer num bloco ────────────────────────────────────────────────────────

/** Um layout com o palco de novo em cima dos blocos (depois de crescer, girar ou mover). */
export function comPalcoAcima(layout: Layout): Layout {
  const palco = layout.palco;
  if (!palco) return layout;
  if (palco.centralizado) {
    // Palco do meio (arena): fica no centro do que está desenhado, sem mudar de tamanho.
    const { caixa } = calcularLayout({ ...layout, palco: null });
    return { ...layout, palco: { ...palco, x: (caixa.x0 + caixa.x1) / 2, y: (caixa.y0 + caixa.y1) / 2 } };
  }
  return { ...layout, palco: palcoAcima(layout.blocos, palco.rotulo) };
}

function trocaBloco(layout: Layout, id: string, muda: (b: Bloco) => Bloco): Layout {
  if (!layout.blocos.some(b => b.id === id)) return layout;
  return { ...layout, blocos: layout.blocos.map(b => (b.id === id ? muda(b) : b)) };
}

/** Pontos de uma grade de meio lugar: o bloco "encaixa" onde se solta. */
export const encaixa = (v: number) => Math.round(v * 2) / 2;
const limita = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function moverBloco(layout: Layout, id: string, x: number, y: number): Layout {
  return trocaBloco(layout, id, b => ({ ...b, x: limita(encaixa(x), -500, 500), y: limita(encaixa(y), -500, 500) }));
}

export function deslocarBloco(layout: Layout, id: string, dx: number, dy: number): Layout {
  const b = layout.blocos.find(x => x.id === id);
  return b ? moverBloco(layout, id, b.x + dx, b.y + dy) : layout;
}

export function comAngulo(layout: Layout, id: string, angulo: number): Layout {
  return trocaBloco(layout, id, b => ({ ...b, angulo: limita(Math.round(angulo), -360, 360) }));
}

/** O raio da curva (em lugares); null deixa as fileiras retas. */
export function comRaio(layout: Layout, id: string, raio: number | null): Layout {
  return trocaBloco(layout, id, b => ({ ...b, raio: raio === null ? null : limita(Math.round(raio * 2) / 2, 0.5, 1000) }));
}

export function comNumeracao(layout: Layout, id: string, numeracao: Numeracao): Layout {
  return trocaBloco(layout, id, b => ({ ...b, numeracao }));
}

export function comPrimeiroNumero(layout: Layout, id: string, primeiro: number): Layout {
  return trocaBloco(layout, id, b => ({ ...b, primeiroNumero: limita(Math.round(primeiro), 1, 999) }));
}

/** Corredor no meio de cada fileira do bloco (as de 6 lugares ou mais); sem ele, as fileiras vão sem vão. */
export function comCorredorNoMeio(layout: Layout, id: string, ligado: boolean): Layout {
  return trocaBloco(layout, id, b => {
    const { corredores: _bloco, ...resto } = b;
    void _bloco;
    return { ...resto, fileiras: b.fileiras.map(({ corredores: _fileira, ...f }) => { void _fileira; return ligado && f.lugares >= 6 ? { ...f, corredores: [Math.floor(f.lugares / 2)] } : f; }) };
  });
}

/** O bloco tem corredor no meio (alguma fileira com vão)? */
export const temCorredorNoMeio = (b: Bloco) => b.fileiras.some(f => (f.corredores ?? b.corredores ?? []).length > 0);

/**
 * Soma `delta` lugares em todas as fileiras do bloco (as diferenças entre elas ficam). Os blocos que ficam à direita e continuam a contagem das mesmas fileiras
 * (como o centro e a direita de um modelo de três blocos) deslocam o primeiro número, para os números não se repetirem nem pularem.
 */
export function maisLugaresNoBloco(layout: Layout, id: string, delta: number): Layout {
  const alvo = layout.blocos.find(b => b.id === id);
  if (!alvo) return layout;
  const folgaMais = Math.min(...alvo.fileiras.map(f => MAX_LUGARES_NA_FILEIRA - f.lugares));
  const folgaMenos = Math.min(...alvo.fileiras.map(f => f.lugares - 1));
  const aplicado = delta >= 0 ? Math.min(delta, folgaMais) : -Math.min(-delta, folgaMenos);
  if (aplicado === 0) return layout;
  const nomes = new Set(alvo.fileiras.map(f => f.nome));
  return {
    ...layout,
    blocos: layout.blocos.map(b => {
      if (b.id === id) {
        // O corredor (do bloco ou da fileira) volta ao meio da fileira nova; fileira que ficou com menos de 6 lugares fica sem vão.
        const { corredores: _doBloco, ...resto } = b;
        void _doBloco;
        return { ...resto, fileiras: b.fileiras.map(({ corredores: _daFileira, ...f }) => {
          const tinha = (_daFileira ?? b.corredores ?? []).length > 0;
          const lugares = f.lugares + aplicado;
          return { ...f, lugares, ...(tinha && lugares >= 6 ? { corredores: [Math.floor(lugares / 2)] } : {}) };
        }) };
      }
      const continua = b.x > alvo.x && b.primeiroNumero > alvo.primeiroNumero && b.fileiras.some(f => nomes.has(f.nome));
      return continua ? { ...b, primeiroNumero: limita(b.primeiroNumero + aplicado, 1, 999) } : b;
    }),
  };
}

/** Uma fileira a mais no fim do bloco, com os lugares da última. */
export function maisUmaFileira(layout: Layout, id: string): Layout {
  return trocaBloco(layout, id, b => {
    if (b.fileiras.length >= MAX_FILEIRAS) return b;
    const ultima = b.fileiras[b.fileiras.length - 1];
    return { ...b, fileiras: [...b.fileiras, { nome: proximoNomeDeFileira(ultima.nome), lugares: ultima.lugares, ...(ultima.corredores ? { corredores: [...ultima.corredores] } : {}) }] };
  });
}

/** Tira a última fileira do bloco (o bloco guarda ao menos uma). */
export function menosUmaFileira(layout: Layout, id: string): Layout {
  return trocaBloco(layout, id, b => (b.fileiras.length <= 1 ? b : { ...b, fileiras: b.fileiras.slice(0, -1) }));
}

// ─── A alça de girar ────────────────────────────────────────────────────────

/** A que distância do centro da primeira fileira (o pivô do bloco) fica a alça de girar, em lugares. */
export const DISTANCIA_DA_ALCA = 3.2;
/** De quantos em quantos graus a alça encaixa. */
export const PASSO_DA_ALCA = 5;

/** Onde fica a alça de um bloco: acima do pivô, na direção em que o bloco aponta (ela gira junto com ele). */
export function posicaoDaAlca(b: Pick<Bloco, "x" | "y" | "angulo">): { x: number; y: number } {
  const a = (b.angulo * Math.PI) / 180;
  return { x: b.x + Math.sin(a) * DISTANCIA_DA_ALCA, y: b.y - Math.cos(a) * DISTANCIA_DA_ALCA };
}

/**
 * O ângulo do bloco quando a alça está em `ponto`: o ângulo do pivô até o ponto, a partir de "para cima", no sentido horário (o mesmo de `Bloco.angulo`), encaixado de
 * `passo` em `passo` graus e entre -180 e 180. null com o ponto em cima do pivô (não há direção).
 */
export function anguloParaPonto(pivo: { x: number; y: number }, ponto: { x: number; y: number }, passo = PASSO_DA_ALCA): number | null {
  const dx = ponto.x - pivo.x;
  const dy = ponto.y - pivo.y;
  if (Math.hypot(dx, dy) < 0.5) return null;
  const graus = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI) / passo) * passo;
  return graus === 0 ? 0 : graus; // sem -0
}

// ─── Empurrar os vizinhos ───────────────────────────────────────────────────

/** Quanto sobra de espaço, no mínimo, entre a borda de um bloco e a do vizinho (em lugares). O desenho de partida dos modelos deixa 1,56 entre os blocos. */
export const FOLGA_ENTRE_BLOCOS = 1.2;

type Caixa = { x0: number; y0: number; x1: number; y1: number };

/** O retângulo de cada bloco (de ponta a ponta dos lugares, com meio lugar de borda), já com metade da folga de cada lado. */
function caixasDosBlocos(layout: Layout): Map<string, Caixa> {
  const caixas = new Map<string, Caixa>();
  const borda = 0.5 + FOLGA_ENTRE_BLOCOS / 2;
  for (const l of calcularLayout(layout).lugares) {
    const c = caixas.get(l.bloco);
    if (!c) caixas.set(l.bloco, { x0: l.x - borda, y0: l.y - borda, x1: l.x + borda, y1: l.y + borda });
    else { c.x0 = Math.min(c.x0, l.x - borda); c.y0 = Math.min(c.y0, l.y - borda); c.x1 = Math.max(c.x1, l.x + borda); c.y1 = Math.max(c.y1, l.y + borda); }
  }
  return caixas;
}

/**
 * Depois de um bloco crescer (mais lugares, mais fileiras, curva, ângulo), afasta os vizinhos que ele passou a atingir: cada um sai para o lado em que há menos a andar, o mínimo
 * para deixar a folga, e o que foi empurrado empurra o seguinte. Quem não é atingido não se mexe, e o layout que já estava folgado volta o mesmo.
 */
export function empurrarVizinhos(layout: Layout, id: string): Layout {
  if (!layout.blocos.some(b => b.id === id)) return layout;
  let atual = layout;
  const fila = [id];
  for (let voltas = 0; fila.length > 0 && voltas < 400; voltas++) {
    const quem = fila[0];
    const caixas = caixasDosBlocos(atual);
    const a = caixas.get(quem);
    let empurrou = false;
    if (a) {
      for (const [outro, b] of caixas) {
        if (outro === quem) continue;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ox <= 1e-9 || oy <= 1e-9) continue;
        const horizontal = ox <= oy;
        const centro = horizontal ? (b.x0 + b.x1) / 2 - (a.x0 + a.x1) / 2 : (b.y0 + b.y1) / 2 - (a.y0 + a.y1) / 2;
        const distancia = Math.ceil((horizontal ? ox : oy) * 2) / 2 * (centro < 0 ? -1 : 1);
        atual = deslocarBloco(atual, outro, horizontal ? distancia : 0, horizontal ? 0 : distancia);
        fila.push(outro);
        empurrou = true;
        break; // as caixas mudaram: confere de novo
      }
    }
    if (!empurrou) fila.shift();
  }
  return atual === layout ? layout : comPalcoAcima(atual);
}

// ─── Blocos novos e blocos a menos ──────────────────────────────────────────

/** O id que ainda não existe: b1, b2... */
function proximoId(layout: Layout): string {
  const usados = new Set(layout.blocos.map(b => b.id));
  for (let i = layout.blocos.length + 1; ; i++) if (!usados.has(`b${i}`)) return `b${i}`;
}

/**
 * Um bloco novo à direita do desenho, parecido com o último (mesma largura, as fileiras com o mesmo número de lugares). As fileiras ganham nomes novos, depois
 * das que já existem, para não repetir fileira e número.
 */
export function maisUmBloco(layout: Layout): Layout {
  if (layout.blocos.length >= MAX_BLOCOS) return layout;
  const modelo = layout.blocos[layout.blocos.length - 1];
  const maiorX = Math.max(...layout.blocos.map(b => b.x));
  return copiaDoBloco(layout, modelo, maiorX + larguraDoBloco(modelo));
}

const larguraDoBloco = (b: Bloco) => Math.max(...b.fileiras.map(f => f.lugares)) + 3;

/** Um bloco igual ao `modelo` (curva, ângulo, numeração, lugares por fileira) com o centro em `x`; as fileiras ganham nomes que ainda não existem e a contagem recomeça em 1. */
function copiaDoBloco(layout: Layout, modelo: Bloco, x: number): Layout {
  if (layout.blocos.length >= MAX_BLOCOS) return layout;
  const usados = new Set(layout.blocos.flatMap(b => b.fileiras.map(f => f.nome)));
  let nome = layout.blocos.flatMap(b => b.fileiras.map(f => f.nome)).sort((a, b) => a.length - b.length || a.localeCompare(b)).pop() ?? "";
  const fileiras = modelo.fileiras.map(f => {
    do nome = proximoNomeDeFileira(nome); while (usados.has(nome));
    usados.add(nome);
    return { nome, lugares: f.lugares, ...(f.corredores ? { corredores: [...f.corredores] } : {}) };
  });
  const novo = blocoNovo({ ...modelo, id: proximoId(layout), x: limita(x, -500, 500), primeiroNumero: 1, fileiras, ...(modelo.corredores ? { corredores: [...modelo.corredores] } : {}) });
  return comPalcoAcima({ ...layout, blocos: [...layout.blocos, novo] });
}

/** Duplica o bloco escolhido: a cópia sai ao lado dele (o último bloco da lista) e empurra o que estiver no caminho. */
export function duplicarBloco(layout: Layout, id: string): Layout {
  const modelo = layout.blocos.find(b => b.id === id);
  if (!modelo || layout.blocos.length >= MAX_BLOCOS) return layout;
  if (modelo.grupo) return maisUmGrupo(layout, modelo.grupo.forma, modelo.fileiras[0].lugares, { colunas: modelo.grupo.colunas, inteiro: modelo.grupo.inteiro });
  const copia = copiaDoBloco(layout, modelo, modelo.x + larguraDoBloco(modelo));
  return empurrarVizinhos(copia, copia.blocos[copia.blocos.length - 1].id);
}

/** Põe o bloco no meio (na horizontal) dos outros blocos: o balcão atrás do meio da plateia, o centro entre as laterais. Com um bloco só, não há em relação a quê. */
export function centralizarBloco(layout: Layout, id: string): Layout {
  const bloco = layout.blocos.find(b => b.id === id);
  if (!bloco || layout.blocos.length < 2) return layout;
  const dele = calcularLayout({ ...layout, blocos: [bloco], palco: null }).caixa;
  const dosOutros = calcularLayout({ ...layout, blocos: layout.blocos.filter(b => b.id !== id), palco: null }).caixa;
  return deslocarBloco(layout, id, (dosOutros.x0 + dosOutros.x1) / 2 - (dele.x0 + dele.x1) / 2, 0);
}

// ─── Mesas e camarotes ──────────────────────────────────────────────────────

/** O primeiro nome livre de grupo: M1, M2... (mesa) ou C1, C2... (camarote), sem repetir nenhum nome de fileira do setor. */
function proximoNomeDeGrupo(layout: Layout, forma: FormaDoGrupo): string {
  const usados = new Set(layout.blocos.flatMap(b => b.fileiras.map(f => f.nome)));
  const prefixo = forma === "mesa" ? "M" : "C";
  for (let i = 1; ; i++) if (!usados.has(`${prefixo}${i}`)) return `${prefixo}${i}`;
}

export const LUGARES_DA_MESA_DE_PARTIDA = 4;
export const LUGARES_DO_CAMAROTE_DE_PARTIDA = 6;

/**
 * Uma mesa ou um camarote novo, à direita de tudo o que já está desenhado (e empurrando o que estiver no caminho). A mesa nasce com 4 lugares e vende inteira só se `inteiro`; o camarote
 * com 6 lugares em duas filas de 3 e, por padrão, vendendo inteiro.
 */
export function maisUmGrupo(layout: Layout, forma: FormaDoGrupo, lugares?: number, opcoes: { colunas?: number; inteiro?: boolean } = {}): Layout {
  if (layout.blocos.length >= MAX_BLOCOS) return layout;
  const n = Math.max(forma === "mesa" ? MESA_MIN : 1, Math.min(forma === "mesa" ? MESA_MAX : CAMAROTE_MAX, Math.round(lugares ?? (forma === "mesa" ? LUGARES_DA_MESA_DE_PARTIDA : LUGARES_DO_CAMAROTE_DE_PARTIDA))));
  const grupo: Grupo = { forma, inteiro: opcoes.inteiro ?? forma === "camarote", ...(forma === "camarote" ? { colunas: Math.max(1, Math.min(n, COLUNAS_MAX, opcoes.colunas ?? Math.min(n, 3))) } : {}) };
  const { caixa } = calcularLayout({ ...layout, palco: null });
  const meia = forma === "mesa" ? raioDaMesa(n) : ((grupo.colunas ?? 3) * 1.25 + 0.5) / 2;
  const novo = blocoNovo({ id: proximoId(layout), x: limita(Math.round((caixa.x1 + meia + 2) * 2) / 2, -500, 500), y: limita(Math.round(((caixa.y0 + caixa.y1) / 2) * 2) / 2, -500, 500), fileiras: [{ nome: proximoNomeDeGrupo(layout, forma), lugares: n }], grupo });
  const comNovo = comPalcoAcima({ ...layout, blocos: [...layout.blocos, novo] });
  return empurrarVizinhos(comNovo, novo.id);
}

const maisUmaMesa = (layout: Layout) => maisUmGrupo(layout, "mesa");
const maisUmCamarote = (layout: Layout) => maisUmGrupo(layout, "camarote");
export { maisUmaMesa, maisUmCamarote };

/** Muda quantos lugares tem a mesa ou o camarote (mesa de 2 a 12, camarote de 1 a 24); as colunas do camarote nunca passam do número de lugares. */
export function comLugaresDoGrupo(layout: Layout, id: string, lugares: number): Layout {
  return trocaBloco(layout, id, b => {
    if (!b.grupo || b.fileiras.length !== 1) return b;
    const n = Math.max(b.grupo.forma === "mesa" ? MESA_MIN : 1, Math.min(b.grupo.forma === "mesa" ? MESA_MAX : CAMAROTE_MAX, Math.round(lugares)));
    const colunas = b.grupo.colunas === undefined ? undefined : Math.max(1, Math.min(b.grupo.colunas, n));
    return { ...b, fileiras: [{ ...b.fileiras[0], lugares: n }], grupo: { ...b.grupo, ...(colunas !== undefined ? { colunas } : {}) } };
  });
}

/** Quantos lugares por fila tem o camarote (de 1 até o número de lugares, no máximo 12). */
export function comColunasDoGrupo(layout: Layout, id: string, colunas: number): Layout {
  return trocaBloco(layout, id, b => (b.grupo?.forma === "camarote" && b.fileiras.length === 1 ? { ...b, grupo: { ...b.grupo, colunas: Math.max(1, Math.min(b.fileiras[0].lugares, COLUNAS_MAX, Math.round(colunas))) } } : b));
}

/** O grupo só se vende completo (num pedido só)? */
export function comVendaInteira(layout: Layout, id: string, inteiro: boolean): Layout {
  return trocaBloco(layout, id, b => (b.grupo ? { ...b, grupo: { ...b.grupo, inteiro } } : b));
}

export function tirarBloco(layout: Layout, id: string): Layout {
  if (layout.blocos.length <= 1 || !layout.blocos.some(b => b.id === id)) return layout;
  return comPalcoAcima({ ...layout, blocos: layout.blocos.filter(b => b.id !== id) });
}

// ─── Frases ─────────────────────────────────────────────────────────────────

/** O que cada erro do layout quer dizer, em palavras de quem monta o mapa. */
export const ERRO_DO_LAYOUT_EM_TEXTO: Record<ErroDoLayout, string> = {
  sem_blocos: "O desenho precisa de ao menos um bloco.",
  blocos_demais: "São blocos demais. O máximo é 30.",
  fileiras_demais: `O setor tem fileiras demais. O máximo é ${MAX_FILEIRAS}, somando todos os blocos.`,
  fileira_vazia: "Um bloco ficou sem fileira ou sem lugares.",
  lugares_demais: `Uma fileira tem lugares demais. O máximo é ${MAX_LUGARES_NA_FILEIRA}, somando os blocos por onde ela passa.`,
  nome_invalido: "Há uma fileira com nome fora do formato (1 a 4 letras ou números).",
  corredor_invalido: "Há um corredor fora da fileira.",
  raio_pequeno: "A curva está fechada demais para essa fileira: aumente o raio ou diminua os lugares.",
  numero_invalido: "O primeiro número de um bloco não pode ser menor que 1.",
  lugar_repetido: "Há lugares com a mesma fileira e o mesmo número. Ajuste o primeiro número de um dos blocos.",
  setor_grande_demais: "O setor passa de 5.000 lugares.",
  numero_fora_do_limite: "Os números de um bloco passam de 999. Diminua os lugares ou o primeiro número.",
  blocos_sobrepostos: "Há blocos um em cima do outro. Afaste-os.",
  grupo_invalido: `Uma mesa ou um camarote ficou fora do limite: a mesa tem de 2 a ${MESA_MAX} lugares e o camarote de 1 a ${CAMAROTE_MAX}.`,
};
