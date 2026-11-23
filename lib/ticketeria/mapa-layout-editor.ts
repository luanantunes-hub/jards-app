// As contas do editor do layout do mapa (M1 do estudo ticketeria-mapa-de-assentos-avancado.md): escolher um modelo, ajustar cada bloco (numeração, curva, ângulo, corredor, fileiras,
// posição) e as frases dos erros. Tudo sobre o `Layout` de mapa-layout.ts, sem mudá-lo no lugar: cada função devolve um layout novo. Só lógica (tests/ticketeria-mapa-layout-editor.test.ts).

import { MAX_FILEIRAS, MAX_LUGARES_NA_FILEIRA, proximoNomeDeFileira } from "@/lib/ticketeria/mapa";
import {
  MAX_BLOCOS, blocoNovo, calcularLayout, modeloCorredorCentral, modeloLeque, modeloTresBlocos, palcoAcima, type Bloco, type ErroDoLayout, type Layout, type Numeracao,
} from "@/lib/ticketeria/mapa-layout";

// ─── Os modelos para começar ────────────────────────────────────────────────

export type ModeloId = "corredor" | "tres-blocos" | "leque";
export const MODELOS: readonly ModeloId[] = ["corredor", "tres-blocos", "leque"];

export const MODELO_EM_TEXTO: Record<ModeloId, { nome: string; descricao: string }> = {
  corredor: { nome: "Corredor central", descricao: "Um bloco reto, com um corredor no meio." },
  "tres-blocos": { nome: "Três blocos", descricao: "Esquerda, centro e direita, com dois corredores." },
  leque: { nome: "Leque", descricao: "Fileiras em arco em volta do palco." },
};

/** Os números de cada modelo, e o que cada um quer dizer na tela. */
export type ParametrosDoModelo = { fileiras: number; lugares: number; laterais: number; centro: number; primeira: number; aumento: number };

export const PARAMETROS_PADRAO: ParametrosDoModelo = { fileiras: 8, lugares: 14, laterais: 8, centro: 14, primeira: 10, aumento: 2 };

/** Quais números cada modelo usa, com o menor, o maior e o nome na tela. */
export const CAMPOS_DO_MODELO: Record<ModeloId, { campo: keyof ParametrosDoModelo; rotulo: string; min: number; max: number }[]> = {
  corredor: [{ campo: "fileiras", rotulo: "Fileiras", min: 1, max: 40 }, { campo: "lugares", rotulo: "Lugares por fileira", min: 2, max: 60 }],
  "tres-blocos": [{ campo: "fileiras", rotulo: "Fileiras", min: 1, max: 40 }, { campo: "laterais", rotulo: "Lugares de cada lado", min: 2, max: 20 }, { campo: "centro", rotulo: "Lugares no centro", min: 2, max: 40 }],
  leque: [{ campo: "fileiras", rotulo: "Fileiras", min: 2, max: 30 }, { campo: "primeira", rotulo: "Lugares na 1ª fileira", min: 4, max: 40 }, { campo: "aumento", rotulo: "A mais em cada fileira", min: 0, max: 4 }],
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
  // O raio acompanha a largura da fileira mais larga (uma fileira de 54 lugares num raio de 12 daria a volta no palco).
  const larga = Math.min(MAX_LUGARES_NA_FILEIRA, v("primeira") + (v("fileiras") - 1) * v("aumento"));
  return modeloLeque(v("fileiras"), v("primeira"), v("aumento"), Math.max(12, Math.ceil(larga / 2)));
}

// ─── Mexer num bloco ────────────────────────────────────────────────────────

/** Um layout com o palco de novo em cima dos blocos (depois de crescer, girar ou mover). */
export const comPalcoAcima = (layout: Layout): Layout => (layout.palco ? { ...layout, palco: palcoAcima(layout.blocos, layout.palco.rotulo) } : layout);

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
  const usados = new Set(layout.blocos.flatMap(b => b.fileiras.map(f => f.nome)));
  let nome = layout.blocos.flatMap(b => b.fileiras.map(f => f.nome)).sort((a, b) => a.length - b.length || a.localeCompare(b)).pop() ?? "";
  const fileiras = modelo.fileiras.map(f => {
    do nome = proximoNomeDeFileira(nome); while (usados.has(nome));
    usados.add(nome);
    return { nome, lugares: f.lugares, ...(f.corredores ? { corredores: [...f.corredores] } : {}) };
  });
  const maiorX = Math.max(...layout.blocos.map(b => b.x));
  const largura = Math.max(...modelo.fileiras.map(f => f.lugares)) + 3;
  const novo = blocoNovo({ ...modelo, id: proximoId(layout), x: limita(maiorX + largura, -500, 500), primeiroNumero: 1, fileiras, ...(modelo.corredores ? { corredores: [...modelo.corredores] } : {}) });
  return comPalcoAcima({ ...layout, blocos: [...layout.blocos, novo] });
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
};
