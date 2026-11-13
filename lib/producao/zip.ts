// Um escritor de .zip mínimo, sem compressão ("armazenado"), para o pacote do dinheiro (PD5.7): as planilhas são pequenas e o formato é o que qualquer sistema abre.
// Sem biblioteca e sem rede; tudo em memória. Nomes em UTF-8 (bit 11), data de modificação no formato do DOS, CRC-32 de cada arquivo e o diretório central no fim.

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

/** O CRC-32 (o do zip, do gzip e do PNG) de uma sequência de bytes. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ArquivoDoZip = { nome: string; conteudo: string | Uint8Array };

/** Um nome de arquivo seguro: sem barras, sem caracteres de controle ou reservados, sem pontos no começo, até 80 letras. O que sobrar vazio vira "arquivo". */
export function nomeDeArquivoSeguro(nome: string): string {
  const limpo = nome.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/^[.\s]+/, "").slice(0, 80).trim();
  return limpo === "" ? "arquivo" : limpo;
}

function dataDoDos(data: Date): { hora: number; dia: number } {
  const ano = Math.min(Math.max(data.getFullYear(), 1980), 2107);
  return { hora: (data.getHours() << 11) | (data.getMinutes() << 5) | (data.getSeconds() >> 1), dia: ((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate() };
}

const u16 = (visao: DataView, posicao: number, valor: number) => visao.setUint16(posicao, valor, true);
const u32 = (visao: DataView, posicao: number, valor: number) => visao.setUint32(posicao, valor >>> 0, true);

/**
 * Monta o .zip com os arquivos, na ordem dada. Nomes repetidos ganham " (2)", " (3)"... antes da extensão. Sem compressão, sem criptografia e sem pastas.
 * Limite do formato simples: 65.535 arquivos e 4 GB; o pacote do dinheiro tem poucos kilobytes.
 */
export function montarZip(arquivos: readonly ArquivoDoZip[], agora: Date = new Date()): Uint8Array {
  const codificador = new TextEncoder();
  const usados = new Set<string>();
  const itens = arquivos.map(arquivo => {
    const base = nomeDeArquivoSeguro(arquivo.nome);
    let nome = base;
    for (let n = 2; usados.has(nome.toLowerCase()); n += 1) {
      const ponto = base.lastIndexOf(".");
      nome = ponto > 0 ? `${base.slice(0, ponto)} (${n})${base.slice(ponto)}` : `${base} (${n})`;
    }
    usados.add(nome.toLowerCase());
    const dados = typeof arquivo.conteudo === "string" ? codificador.encode(arquivo.conteudo) : arquivo.conteudo;
    return { nome: codificador.encode(nome), dados, crc: crc32(dados) };
  });
  const { hora, dia } = dataDoDos(agora);
  const tamanhoDosLocais = itens.reduce((soma, item) => soma + 30 + item.nome.length + item.dados.length, 0);
  const tamanhoDoCentral = itens.reduce((soma, item) => soma + 46 + item.nome.length, 0);
  const saida = new Uint8Array(tamanhoDosLocais + tamanhoDoCentral + 22);
  const visao = new DataView(saida.buffer);
  const deslocamentos: number[] = [];
  let posicao = 0;
  for (const item of itens) {
    deslocamentos.push(posicao);
    u32(visao, posicao, 0x04034b50); u16(visao, posicao + 4, 20); u16(visao, posicao + 6, 0x0800); u16(visao, posicao + 8, 0);
    u16(visao, posicao + 10, hora); u16(visao, posicao + 12, dia); u32(visao, posicao + 14, item.crc);
    u32(visao, posicao + 18, item.dados.length); u32(visao, posicao + 22, item.dados.length); u16(visao, posicao + 26, item.nome.length); u16(visao, posicao + 28, 0);
    saida.set(item.nome, posicao + 30);
    saida.set(item.dados, posicao + 30 + item.nome.length);
    posicao += 30 + item.nome.length + item.dados.length;
  }
  const inicioDoCentral = posicao;
  itens.forEach((item, indice) => {
    u32(visao, posicao, 0x02014b50); u16(visao, posicao + 4, 20); u16(visao, posicao + 6, 20); u16(visao, posicao + 8, 0x0800); u16(visao, posicao + 10, 0);
    u16(visao, posicao + 12, hora); u16(visao, posicao + 14, dia); u32(visao, posicao + 16, item.crc);
    u32(visao, posicao + 20, item.dados.length); u32(visao, posicao + 24, item.dados.length); u16(visao, posicao + 28, item.nome.length);
    u16(visao, posicao + 30, 0); u16(visao, posicao + 32, 0); u16(visao, posicao + 34, 0); u16(visao, posicao + 36, 0); u32(visao, posicao + 38, 0); u32(visao, posicao + 42, deslocamentos[indice]);
    saida.set(item.nome, posicao + 46);
    posicao += 46 + item.nome.length;
  });
  u32(visao, posicao, 0x06054b50); u16(visao, posicao + 4, 0); u16(visao, posicao + 6, 0); u16(visao, posicao + 8, itens.length); u16(visao, posicao + 10, itens.length);
  u32(visao, posicao + 12, tamanhoDoCentral); u32(visao, posicao + 16, inicioDoCentral); u16(visao, posicao + 20, 0);
  return saida;
}
