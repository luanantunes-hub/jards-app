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
