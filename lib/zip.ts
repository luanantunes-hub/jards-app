// ZIP sem compressão (método "store"), para montar pacotes no navegador sem
// dependência. PDF e imagens já vêm comprimidos; guardar como estão é rápido e
// não pesa no tamanho. Nomes em UTF-8 (bit 11). Sem ZIP64: até 65.535
// arquivos e 4 GB no total.

export type ArquivoDoZip = { nome: string; dados: Uint8Array; data?: Date };

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (polinômio do ZIP); `anterior` continua um cálculo em partes. */
export function crc32(dados: Uint8Array, anterior = 0): number {
  let c = (anterior ^ 0xffffffff) >>> 0;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Hora e data no formato do DOS, como o ZIP guarda. */
function horaDos(d: Date): { hora: number; data: number } {
  const ano = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const LIMITE = 0xffffffff;

/**
 * As partes do arquivo ZIP, na ordem: cabeçalho e dados de cada arquivo, o
 * diretório central e o fim. Os dados entram sem cópia; juntas, as partes
 * formam o ZIP (no navegador, `new Blob(partes)`).
 */
export function partesDoZip(arquivos: readonly ArquivoDoZip[]): Uint8Array[] {
  if (arquivos.length > 0xffff) throw new Error("O pacote passa de 65.535 arquivos.");
  const utf8 = new TextEncoder();
  const vistos = new Set<string>();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let posicao = 0;

  for (const a of arquivos) {
    const nome = a.nome.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!nome || nome.split("/").some(p => p === ".." || p === "")) throw new Error(`Nome inválido no pacote: "${a.nome}".`);
    if (vistos.has(nome)) throw new Error(`Nome repetido no pacote: "${nome}".`);
    vistos.add(nome);
    if (a.dados.length > LIMITE || posicao > LIMITE) throw new Error("O pacote passa de 4 GB.");
    const bytesDoNome = utf8.encode(nome);
    const crc = crc32(a.dados);
    const { hora, data } = horaDos(a.data ?? new Date());

    const local = new Uint8Array(30 + bytesDoNome.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);
    l.setUint16(8, 0, true);
    l.setUint16(10, hora, true);
    l.setUint16(12, data, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, a.dados.length, true);
    l.setUint32(22, a.dados.length, true);
    l.setUint16(26, bytesDoNome.length, true);
    l.setUint16(28, 0, true);
    local.set(bytesDoNome, 30);

    const c = new Uint8Array(46 + bytesDoNome.length);
    const v = new DataView(c.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 0x0800, true);
    v.setUint16(10, 0, true);
    v.setUint16(12, hora, true);
    v.setUint16(14, data, true);
    v.setUint32(16, crc, true);
    v.setUint32(20, a.dados.length, true);
    v.setUint32(24, a.dados.length, true);
    v.setUint16(28, bytesDoNome.length, true);
    // extra, comentário, disco, atributos internos e externos: zero.
    v.setUint32(42, posicao, true);
    c.set(bytesDoNome, 46);

    partes.push(local, a.dados);
    central.push(c);
    posicao += local.length + a.dados.length;
  }

  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  if (posicao > LIMITE) throw new Error("O pacote passa de 4 GB.");
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, arquivos.length, true);
  f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamanhoCentral, true);
  f.setUint32(16, posicao, true);
  return [...partes, ...central, fim];
}

/** Descomprime "deflate" cru (método 8 do ZIP) pelo DecompressionStream do navegador e do Node. */
async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/**
 * Lê os arquivos de um ZIP pelo diretório central (store e deflate), para
 * abrir modelos .xlsx no navegador. Sem ZIP64 e sem criptografia.
 */
export async function lerZip(zip: Uint8Array): Promise<Map<string, Uint8Array>> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let fim = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("O arquivo não é um ZIP.");
  const quantidade = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const latin1 = new TextDecoder("latin1");
  const utf8 = new TextDecoder();
  const arquivos = new Map<string, Uint8Array>();
  for (let n = 0; n < quantidade; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Diretório do ZIP corrompido.");
    const bandeiras = v.getUint16(p + 8, true);
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const tamanhoNome = v.getUint16(p + 28, true);
    const tamanhoExtra = v.getUint16(p + 30, true);
    const tamanhoComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const bytesDoNome = zip.subarray(p + 46, p + 46 + tamanhoNome);
    const nome = (bandeiras & 0x0800 ? utf8 : latin1).decode(bytesDoNome);
    p += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
    if (bandeiras & 1) throw new Error(`"${nome}" está criptografado no ZIP.`);
    if (v.getUint32(local, true) !== 0x04034b50) throw new Error(`Cabeçalho de "${nome}" corrompido no ZIP.`);
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const dados = zip.subarray(inicio, inicio + comprimido);
    if (nome.endsWith("/")) continue;
    if (metodo === 0) arquivos.set(nome, dados);
    else if (metodo === 8) arquivos.set(nome, await inflar(dados));
    else throw new Error(`"${nome}" usa um método de compressão sem suporte (${metodo}).`);
  }
  return arquivos;
}
