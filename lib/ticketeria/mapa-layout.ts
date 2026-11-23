// O motor do desenho do mapa de assentos (M1 do estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.1): o mapa é descrito por PARÂMETROS (blocos, corredores,
// curvatura, ângulo, regra de numeração) e a posição de cada lugar sai de uma função pura. Os lugares continuam com a identidade de sempre (setor, fileira, número);
// o que muda aqui é só o desenho. Sem banco, sem tela e sem import de servidor: roda nos testes (tests/ticketeria-mapa-layout.test.ts).
//
// Unidade: 1 = a distância entre o centro de dois lugares vizinhos. O eixo y cresce para BAIXO (como no SVG); o palco fica no alto, a primeira fileira perto dele.
// Ângulo: em graus, no sentido horário, em torno do centro da primeira fileira do bloco.

import { MAX_FILEIRAS, MAX_LUGARES_NA_FILEIRA, MAX_LUGARES_NO_SETOR, proximoNomeDeFileira, type FileiraDoMapa } from "@/lib/ticketeria/mapa";

/** Como os lugares de uma fileira são numerados, olhando da plateia para o palco (o lado esquerdo do desenho é o esquerdo de quem senta). */
export type Numeracao = "esq-dir" | "dir-esq" | "centro-fora";
export const NUMERACOES: readonly Numeracao[] = ["esq-dir", "dir-esq", "centro-fora"];
export const NUMERACAO_EM_TEXTO: Record<Numeracao, string> = {
  "esq-dir": "Da esquerda para a direita",
  "dir-esq": "Da direita para a esquerda",
  "centro-fora": "Ímpares à direita e pares à esquerda, a partir do centro",
};

export type FileiraDoBloco = {
  /** 1 a 4 letras ou números, maiúsculos (a mesma regra do banco). */
  nome: string;
  lugares: number;
  /** Depois de quantos lugares (contando da esquerda) há um corredor nesta fileira; vale mais que o do bloco. */
  corredores?: number[];
};

export type Bloco = {
  id: string;
  /** O setor a que o bloco pertence (a unidade de preço e de ingresso); null enquanto o layout é de um setor só. */
  setor: string | null;
  /** Onde fica o centro da primeira fileira, e o quanto o bloco gira. */
  x: number;
  y: number;
  angulo: number;
  /** Raio da curva da primeira fileira, em lugares; null = fileiras retas. As outras fileiras são concêntricas (raio + espaço entre fileiras). */
  raio: number | null;
  espacoFileira: number;
  larguraCorredor: number;
  numeracao: Numeracao;
  /** O número do primeiro lugar (uma fileira que passa por vários blocos continua a contagem do bloco anterior). */
  primeiroNumero: number;
  /** Corredores de todas as fileiras do bloco que não dizem outra coisa. */
  corredores?: number[];
  fileiras: FileiraDoBloco[];
};

/** `centralizado`: o palco fica no meio dos blocos (arena), em vez de em cima deles; o editor o mantém no centro quando o desenho muda. */
export type Palco = { x: number; y: number; largura: number; altura: number; rotulo: string; centralizado?: boolean };

export type Layout = { versao: 1; blocos: Bloco[]; palco: Palco | null };

export const MAX_BLOCOS = 30;
export const ESPACO_PADRAO_FILEIRA = 1.25;
export const LARGURA_PADRAO_CORREDOR = 1.2;

export function blocoNovo(parcial: Partial<Bloco> & Pick<Bloco, "id" | "fileiras">): Bloco {
  return {
    setor: null, x: 0, y: 0, angulo: 0, raio: null, espacoFileira: ESPACO_PADRAO_FILEIRA, larguraCorredor: LARGURA_PADRAO_CORREDOR,
    numeracao: "esq-dir", primeiroNumero: 1, ...parcial,
  };
}

// ─── Numeração ──────────────────────────────────────────────────────────────

/** O número de cada lugar de uma fileira de `n`, na ordem em que aparecem no desenho (da esquerda para a direita). */
export function numerosDaFileira(n: number, numeracao: Numeracao, primeiro = 1): number[] {
  const saida: number[] = [];
  const centro = (n - 1) / 2;
  const meio = Math.ceil(centro);
  for (let i = 0; i < n; i++) {
    let k: number;
    if (numeracao === "esq-dir") k = i + 1;
    else if (numeracao === "dir-esq") k = n - i;
    else if (i >= centro) k = 2 * (i - meio) + 1; // à direita: 1, 3, 5...
    else k = 2 * (meio - i); // à esquerda: 2, 4, 6...
    saida.push(primeiro - 1 + k);
  }
  return saida;
}

// ─── A conferência ──────────────────────────────────────────────────────────

export type ErroDoLayout =
  | "sem_blocos" | "blocos_demais" | "fileiras_demais" | "fileira_vazia" | "lugares_demais" | "nome_invalido" | "corredor_invalido"
  | "raio_pequeno" | "numero_invalido" | "lugar_repetido" | "setor_grande_demais" | "numero_fora_do_limite" | "blocos_sobrepostos";

const NOME_DE_FILEIRA = /^[A-Z0-9]{1,4}$/;

/** Quanto a fileira se espalha em ângulo (o maior ângulo, de cada lado) com o raio dado; passar de 90° é uma fileira que dá a volta. */
function anguloMaximo(n: number, larguraCorredor: number, corredores: number, raio: number, ultimaFileira: number): number {
  const largura = (n - 1) + corredores * larguraCorredor;
  return (largura / 2 / (raio + ultimaFileira)) * (180 / Math.PI);
}

/** Os problemas do layout (vazia = serve). Mesmas regras do banco para fileira e lugar; os de desenho são daqui. */
export function conferirLayout(layout: Layout): ErroDoLayout[] {
  const erros = new Set<ErroDoLayout>();
  if (layout.blocos.length === 0) erros.add("sem_blocos");
  if (layout.blocos.length > MAX_BLOCOS) erros.add("blocos_demais");
  const usados = new Set<string>();
  const porSetor = new Map<string, number>();
  for (const b of layout.blocos) {
    if (b.fileiras.length === 0) erros.add("fileira_vazia");
    if (b.fileiras.length > MAX_FILEIRAS) erros.add("fileiras_demais");
    if (!Number.isInteger(b.primeiroNumero) || b.primeiroNumero < 1) erros.add("numero_invalido");
    if (b.raio !== null && !(b.raio > 0)) erros.add("raio_pequeno");
    for (const [r, f] of b.fileiras.entries()) {
      if (!NOME_DE_FILEIRA.test(f.nome)) erros.add("nome_invalido");
      if (!Number.isInteger(f.lugares) || f.lugares < 1) erros.add("fileira_vazia");
      if (f.lugares > MAX_LUGARES_NA_FILEIRA) erros.add("lugares_demais");
      const cs = f.corredores ?? b.corredores ?? [];
      if (cs.some(c => !Number.isInteger(c) || c < 1 || c >= f.lugares)) erros.add("corredor_invalido");
      if (b.raio !== null && b.raio > 0 && anguloMaximo(f.lugares, b.larguraCorredor, new Set(cs).size, b.raio, r * b.espacoFileira) > 90) erros.add("raio_pequeno");
      if (Number.isInteger(f.lugares) && f.lugares >= 1 && f.lugares <= MAX_LUGARES_NA_FILEIRA && Number.isInteger(b.primeiroNumero) && b.primeiroNumero >= 1) {
        if (b.primeiroNumero + f.lugares - 1 > 999) erros.add("numero_fora_do_limite");
        for (const n of numerosDaFileira(f.lugares, b.numeracao, b.primeiroNumero)) {
          const chave = `${b.setor ?? ""}|${f.nome}|${n}`;
          if (usados.has(chave)) erros.add("lugar_repetido");
          usados.add(chave);
        }
        porSetor.set(b.setor ?? "", (porSetor.get(b.setor ?? "") ?? 0) + f.lugares);
      }
    }
  }
  if ([...porSetor.values()].some(total => total > MAX_LUGARES_NO_SETOR)) erros.add("setor_grande_demais");
  // O banco guarda o mapa por fileira (setor, nome): uma fileira que passa por vários blocos soma os lugares deles (até 80), e um setor tem até 60 fileiras.
  const lugaresPorFileira = new Map<string, number>();
  const nomesPorSetor = new Map<string, Set<string>>();
  for (const b of layout.blocos) {
    for (const f of b.fileiras) {
      if (!Number.isInteger(f.lugares) || f.lugares < 1) continue;
      const chave = `${b.setor ?? ""}|${f.nome}`;
      lugaresPorFileira.set(chave, (lugaresPorFileira.get(chave) ?? 0) + f.lugares);
      const nomes = nomesPorSetor.get(b.setor ?? "") ?? new Set<string>();
      nomes.add(f.nome);
      nomesPorSetor.set(b.setor ?? "", nomes);
    }
  }
  if ([...lugaresPorFileira.values()].some(n => n > MAX_LUGARES_NA_FILEIRA)) erros.add("lugares_demais");
  if ([...nomesPorSetor.values()].some(nomes => nomes.size > MAX_FILEIRAS)) erros.add("fileiras_demais");
  // O desenho só se calcula quando o resto está certo (com erro, a posição pode não fazer sentido).
  if (erros.size === 0 && lugaresSeSobrepoem(calcularLayout(layout).lugares)) erros.add("blocos_sobrepostos");
  return [...erros];
}

/** Dois lugares a menos de 0,8 de distância (o lado do lugar é 0,84): um bloco em cima do outro. Grade de 1x1, então custa um passo por lugar. */
export function lugaresSeSobrepoem(lugares: readonly { x: number; y: number }[]): boolean {
  const grade = new Map<string, { x: number; y: number }[]>();
  for (const l of lugares) {
    const cx = Math.floor(l.x), cy = Math.floor(l.y);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if ((grade.get(`${cx + dx}|${cy + dy}`) ?? []).some(o => Math.hypot(o.x - l.x, o.y - l.y) < 0.8)) return true;
    }
    const chave = `${cx}|${cy}`;
    const lista = grade.get(chave);
    if (lista) lista.push(l); else grade.set(chave, [l]);
  }
  return false;
}

// ─── O cálculo ──────────────────────────────────────────────────────────────

export type LugarPosicionado = { bloco: string; setor: string | null; fileira: string; numero: number; indice: number; x: number; y: number };
export type Caixa = { x0: number; y0: number; x1: number; y1: number };
export type LayoutCalculado = { lugares: LugarPosicionado[]; caixa: Caixa };

/** Arredonda para 1/10.000 de lugar: o desenho não muda e as contas dos testes ficam estáveis. */
const arredonda = (v: number) => Math.round(v * 10000) / 10000;

/** Onde fica cada lugar de uma fileira, antes de girar e deslocar o bloco: x ao longo da fileira, y a profundidade dela. */
function posicoesDaFileira(n: number, corredores: readonly number[], larguraCorredor: number, raio: number | null, profundidade: number): { x: number; y: number }[] {
  const cortes = [...new Set(corredores.filter(c => c >= 1 && c < n))];
  const longo = Array.from({ length: n }, (_, i) => i + cortes.filter(c => c <= i).length * larguraCorredor);
  const largura = longo[n - 1];
  return longo.map(u0 => {
    const u = u0 - largura / 2;
    if (raio === null) return { x: u, y: profundidade };
    // As fileiras são arcos concêntricos, com o centro "atrás do palco": a fileira k tem raio (raio + k·espaço) e a primeira passa por y = 0.
    const r = raio + profundidade;
    const teta = u / r;
    return { x: r * Math.sin(teta), y: r * Math.cos(teta) - raio };
  });
}

/** A posição de todos os lugares do layout (confira com `conferirLayout` antes: um layout com erro pode dar posição sem sentido). */
export function calcularLayout(layout: Layout): LayoutCalculado {
  const lugares: LugarPosicionado[] = [];
  for (const b of layout.blocos) {
    const a = (b.angulo * Math.PI) / 180;
    const cos = Math.cos(a), sen = Math.sin(a);
    b.fileiras.forEach((f, k) => {
      const pontos = posicoesDaFileira(f.lugares, f.corredores ?? b.corredores ?? [], b.larguraCorredor, b.raio, k * b.espacoFileira);
      const numeros = numerosDaFileira(f.lugares, b.numeracao, b.primeiroNumero);
      pontos.forEach((p, i) => {
        lugares.push({
          bloco: b.id, setor: b.setor, fileira: f.nome, numero: numeros[i], indice: i,
          x: arredonda(b.x + p.x * cos - p.y * sen), y: arredonda(b.y + p.x * sen + p.y * cos),
        });
      });
    });
  }
  const xs = lugares.map(l => l.x), ys = lugares.map(l => l.y);
  let caixa: Caixa = lugares.length
    ? { x0: Math.min(...xs) - 0.5, y0: Math.min(...ys) - 0.5, x1: Math.max(...xs) + 0.5, y1: Math.max(...ys) + 0.5 }
    : { x0: 0, y0: 0, x1: 0, y1: 0 };
  const p = layout.palco;
  if (p) caixa = { x0: Math.min(caixa.x0, p.x - p.largura / 2), y0: Math.min(caixa.y0, p.y - p.altura / 2), x1: Math.max(caixa.x1, p.x + p.largura / 2), y1: Math.max(caixa.y1, p.y + p.altura / 2) };
  return { lugares, caixa };
}

// ─── O mapa de hoje vira um layout ─────────────────────────────────────────

/**
 * O mapa que já existe (fileiras com lugares 1, 2, 3... e `vaos` por número) como um bloco só, com os mesmos números, na mesma ordem e com os mesmos corredores.
 * null se algum mapa tem número fora da sequência 1..n (então não cabe como bloco; o editor de hoje nunca gera isso).
 */
export function layoutDoMapa(fileiras: readonly FileiraDoMapa[], palco: string | null = "Palco"): Layout | null {
  const lista: FileiraDoBloco[] = [];
  for (const f of fileiras) {
    if (!f.assentos.every((a, i) => a.numero === i + 1)) return null;
    const corredores = (f.vaos ?? []).filter(n => n >= 1 && n < f.assentos.length);
    lista.push({ nome: f.nome, lugares: f.assentos.length, ...(corredores.length ? { corredores } : {}) });
  }
  const bloco = blocoNovo({ id: "b1", fileiras: lista, y: 0 });
  return { versao: 1, blocos: [bloco], palco: palco === null ? null : palcoAcima([bloco], palco) };
}

/** Um palco centrado em cima dos blocos, com a largura do mais largo (a largura de um bloco reto; o de curva usa a caixa dos lugares). */
export function palcoAcima(blocos: readonly Bloco[], rotulo = "Palco"): Palco {
  const { caixa } = calcularLayout({ versao: 1, blocos: [...blocos], palco: null });
  return { x: (caixa.x0 + caixa.x1) / 2, y: caixa.y0 - 2.5, largura: Math.max(6, (caixa.x1 - caixa.x0) * 0.7), altura: 1.6, rotulo };
}

// ─── Modelos para começar ───────────────────────────────────────────────────

/** Plateia reta com um corredor no meio (o desenho de hoje). */
export function modeloCorredorCentral(fileiras: number, lugares: number): Layout {
  const nomes = nomesDeFileira(fileiras);
  const bloco = blocoNovo({ id: "b1", fileiras: nomes.map(nome => ({ nome, lugares })), corredores: lugares >= 6 ? [Math.floor(lugares / 2)] : [] });
  return { versao: 1, blocos: [bloco], palco: palcoAcima([bloco]) };
}

/**
 * Três blocos lado a lado (esquerda, centro e direita), com um corredor entre eles. Cada fileira passa pelos três blocos e a numeração continua
 * (esquerda 1..a, centro a+1..a+b, direita a+b+1..), então o lugar de cada um tem um número só na fileira.
 */
export function modeloTresBlocos(fileiras: number, laterais: number, centro: number): Layout {
  const nomes = nomesDeFileira(fileiras).map(nome => ({ nome, lugares: 0 }));
  const corredor = 2.4;
  const meia = (centro - 1) / 2;
  const centroDaLateral = meia + corredor + (laterais - 1) / 2;
  const bloco = (id: string, x: number, primeiroNumero: number, lugares: number) =>
    blocoNovo({ id, x, primeiroNumero, fileiras: nomes.map(f => ({ ...f, lugares })) });
  const blocos = [bloco("esq", -centroDaLateral, 1, laterais), bloco("centro", 0, laterais + 1, centro), bloco("dir", centroDaLateral, laterais + centro + 1, laterais)];
  return { versao: 1, blocos, palco: palcoAcima(blocos) };
}

/** Leque: as fileiras são arcos em volta do palco e cada uma tem `aumento` lugares a mais que a da frente. */
export function modeloLeque(fileiras: number, primeira: number, aumento: number, raio = 10): Layout {
  const lista = nomesDeFileira(fileiras).map((nome, k) => ({ nome, lugares: Math.min(MAX_LUGARES_NA_FILEIRA, primeira + k * aumento) }));
  const bloco = blocoNovo({ id: "b1", fileiras: lista, raio });
  return { versao: 1, blocos: [bloco], palco: palcoAcima([bloco]) };
}

/**
 * Plateia e balcão: dois blocos, o da frente (a plateia, com corredor no meio) e, atrás dele, o balcão (menos fileiras, mesma largura). O palco fica em cima da plateia.
 * As fileiras do balcão continuam o nome das da plateia (A..H, depois I..L).
 */
export function modeloPlateiaEBalcao(fileiras: number, lugares: number, fileirasDoBalcao: number): Layout {
  const nomes = nomesDeFileira(fileiras + fileirasDoBalcao);
  const corredores = lugares >= 6 ? [Math.floor(lugares / 2)] : [];
  const plateia = blocoNovo({ id: "plateia", fileiras: nomes.slice(0, fileiras).map(nome => ({ nome, lugares })), corredores });
  const balcao = blocoNovo({ id: "balcao", y: (fileiras - 1) * ESPACO_PADRAO_FILEIRA + 4, fileiras: nomes.slice(fileiras).map(nome => ({ nome, lugares })), corredores });
  const blocos = [plateia, balcao];
  return { versao: 1, blocos, palco: palcoAcima(blocos) };
}

/** Continental: fileiras longas, sem corredor no meio (a saída é pelas pontas), num bloco só. */
export function modeloContinental(fileiras: number, lugares: number): Layout {
  const bloco = blocoNovo({ id: "b1", fileiras: nomesDeFileira(fileiras).map(nome => ({ nome, lugares })) });
  return { versao: 1, blocos: [bloco], palco: palcoAcima([bloco]) };
}

/**
 * Arena: o palco no meio e quatro blocos em volta, de frente para ele (frente e fundo com `lugares` por fileira, as laterais com `laterais`). Os blocos de cima, da esquerda e da
 * direita vêm girados (180°, 90° e -90°) para a primeira fileira ficar junto ao palco. As fileiras têm nomes seguidos pelos quatro blocos.
 */
export function modeloArena(fileiras: number, lugares: number, laterais: number): Layout {
  const nomes = nomesDeFileira(fileiras * 4);
  const grupo = (i: number, n: number) => nomes.slice(i * fileiras, (i + 1) * fileiras).map(nome => ({ nome, lugares: n }));
  const altura = Math.max(3, laterais - 1); // o palco é tão alto quanto as laterais são largas
  const folga = 2.5;
  const baixo = blocoNovo({ id: "frente", y: altura / 2 + folga, fileiras: grupo(0, lugares) });
  const cima = blocoNovo({ id: "fundo", y: -(altura / 2 + folga), angulo: 180, fileiras: grupo(1, lugares) });
  const esquerda = blocoNovo({ id: "esquerda", x: -(lugares / 2 + folga), angulo: 90, fileiras: grupo(2, laterais) });
  const direita = blocoNovo({ id: "direita", x: lugares / 2 + folga, angulo: -90, fileiras: grupo(3, laterais) });
  return { versao: 1, blocos: [baixo, cima, esquerda, direita], palco: { x: 0, y: 0, largura: Math.max(6, lugares - 1), altura, rotulo: "Palco", centralizado: true } };
}

/** A, B, C... Z, AA, AB... (o mesmo caminho do editor de hoje). */
function nomesDeFileira(n: number): string[] {
  const nomes: string[] = [];
  let atual = "";
  for (let i = 0; i < n; i++) {
    atual = proximoNomeDeFileira(atual);
    nomes.push(atual);
  }
  return nomes;
}

// ─── Do banco para o desenho e de volta ─────────────────────────────────────

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const numero = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const inteiro = (v: unknown, min: number, max: number): v is number => numero(v, min, max) && Number.isInteger(v);
const listaDeInteiros = (v: unknown): number[] | null | "erro" => {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length > 40 || !v.every(n => inteiro(n, 1, 79))) return "erro";
  return v as number[];
};

/**
 * O layout que o banco guarda (ticketeria_setores.layout) ou que a compra recebe, conferido; null se não é um layout que se desenha (formato, limites do banco ou
 * qualquer erro de `conferirLayout`: bloco em cima de bloco, número repetido...). Quem recebe null desenha o mapa como lista de fileiras, que é o que sempre vale.
 */
export function lerLayout(resposta: unknown): Layout | null {
  const r = objeto(resposta);
  if (!r || r.versao !== 1 || !Array.isArray(r.blocos) || r.blocos.length < 1 || r.blocos.length > MAX_BLOCOS) return null;
  const blocos: Bloco[] = [];
  for (const bruto of r.blocos) {
    const b = objeto(bruto);
    if (!b || typeof b.id !== "string" || b.id.length < 1 || b.id.length > 30) return null;
    if (b.setor !== undefined && b.setor !== null) return null;
    if (!numero(b.x, -500, 500) || !numero(b.y, -500, 500) || !numero(b.angulo, -360, 360)) return null;
    if (b.raio !== undefined && b.raio !== null && !numero(b.raio, 0.5, 1000)) return null;
    if (!numero(b.espacoFileira, 0.5, 5) || !numero(b.larguraCorredor, 0, 6)) return null;
    if (!NUMERACOES.includes(b.numeracao as Numeracao) || !inteiro(b.primeiroNumero, 1, 999)) return null;
    const corredores = listaDeInteiros(b.corredores);
    if (corredores === "erro" || !Array.isArray(b.fileiras) || b.fileiras.length < 1 || b.fileiras.length > MAX_FILEIRAS) return null;
    const fileiras: FileiraDoBloco[] = [];
    for (const fb of b.fileiras) {
      const f = objeto(fb);
      if (!f || typeof f.nome !== "string" || !inteiro(f.lugares, 1, MAX_LUGARES_NA_FILEIRA)) return null;
      const cs = listaDeInteiros(f.corredores);
      if (cs === "erro") return null;
      fileiras.push({ nome: f.nome, lugares: f.lugares, ...(cs ? { corredores: cs } : {}) });
    }
    blocos.push({
      id: b.id, setor: null, x: b.x, y: b.y, angulo: b.angulo, raio: typeof b.raio === "number" ? b.raio : null, espacoFileira: b.espacoFileira, larguraCorredor: b.larguraCorredor,
      numeracao: b.numeracao as Numeracao, primeiroNumero: b.primeiroNumero, ...(corredores ? { corredores } : {}), fileiras,
    });
  }
  let palco: Palco | null = null;
  const p = objeto(r.palco);
  if (r.palco !== undefined && r.palco !== null) {
    if (!p || !numero(p.x, -1000, 1000) || !numero(p.y, -1000, 1000) || !numero(p.largura, 1, 1000) || !numero(p.altura, 0.5, 100) || typeof p.rotulo !== "string" || p.rotulo.length < 1 || p.rotulo.length > 30) return null;
    palco = { x: p.x, y: p.y, largura: p.largura, altura: p.altura, rotulo: p.rotulo, ...(p.centralizado === true ? { centralizado: true } : {}) };
  }
  const layout: Layout = { versao: 1, blocos, palco };
  return conferirLayout(layout).length === 0 ? layout : null;
}

/**
 * Os lugares que o layout descreve, como o mapa de fileiras que a venda e o banco conhecem (fileira, número, todos livres): a ordem das fileiras é a da primeira vez que aparecem
 * no layout, e os lugares de cada uma, por número. É o que se manda como `p_fileiras` junto com o layout.
 */
export function mapaDoLayout(layout: Layout): FileiraDoMapa[] {
  const porFileira = new Map<string, number[]>();
  for (const l of calcularLayout(layout).lugares) {
    const lista = porFileira.get(l.fileira);
    if (lista) lista.push(l.numero); else porFileira.set(l.fileira, [l.numero]);
  }
  return [...porFileira.entries()].map(([nome, numeros]) => ({ nome, assentos: numeros.sort((a, b) => a - b).map(n => ({ numero: n, estado: "livre" as const })) }));
}

/** Passa o bloqueio e o tipo de cada lugar de um mapa antigo para um mapa novo (pela fileira e pelo número); lugar que não existia antes fica como veio. */
export function comEstadosDoMapa(novo: readonly FileiraDoMapa[], antigo: readonly FileiraDoMapa[]): FileiraDoMapa[] {
  const antes = new Map<string, FileiraDoMapa["assentos"][number]>();
  for (const f of antigo) for (const a of f.assentos) antes.set(`${f.nome}|${a.numero}`, a);
  return novo.map(f => ({ ...f, assentos: f.assentos.map(a => {
    const velho = antes.get(`${f.nome}|${a.numero}`);
    return velho ? { ...a, estado: velho.estado === "bloqueado" || velho.estado === "ocupado" ? velho.estado : a.estado, ...(velho.tipo ? { tipo: velho.tipo } : {}) } : a;
  }) }));
}
