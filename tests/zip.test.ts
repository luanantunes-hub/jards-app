import assert from "node:assert/strict";
import test from "node:test";
import { crc32, partesDoZip } from "../lib/zip";

const juntar = (partes: Uint8Array[]) => {
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of partes) { total.set(p, i); i += p.length; }
  return total;
};

/** Lê o ZIP pelo diretório central, como os descompactadores fazem. */
function lerZip(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fim = zip.length - 22;
  assert.equal(v.getUint32(fim, true), 0x06054b50);
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const arquivos: { nome: string; dados: Uint8Array; crc: number; flags: number }[] = [];
  for (let n = 0; n < total; n++) {
    assert.equal(v.getUint32(p, true), 0x02014b50);
    const flags = v.getUint16(p + 8, true);
    const crc = v.getUint32(p + 16, true);
    const tamanho = v.getUint32(p + 20, true);
    const tamNome = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + tamNome));
    assert.equal(v.getUint32(local, true), 0x04034b50);
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    arquivos.push({ nome, dados: zip.subarray(inicio, inicio + tamanho), crc, flags });
    p += 46 + tamNome;
  }
  return arquivos;
}

test("CRC-32 do ZIP", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
  const tudo = new TextEncoder().encode("prestação de contas");
  assert.equal(crc32(tudo.subarray(5), crc32(tudo.subarray(0, 5))), crc32(tudo));
});

test("ZIP: arquivos guardados como estão, com nome em UTF-8", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4 teste");
  const csv = new TextEncoder().encode("arquivo;origem\r\nmanifesto;ção\r\n");
  const zip = juntar(partesDoZip([
    { nome: "comprovantes/001_nota.pdf", dados: pdf, data: new Date(2026, 9, 7, 10, 30) },
    { nome: "manifesto-ação.csv", dados: csv },
  ]));
  const lidos = lerZip(zip);
  assert.deepEqual(lidos.map(a => a.nome), ["comprovantes/001_nota.pdf", "manifesto-ação.csv"]);
  assert.deepEqual([...lidos[0].dados], [...pdf]);
  assert.deepEqual([...lidos[1].dados], [...csv]);
  assert.equal(lidos[0].crc, crc32(pdf));
  assert.equal(lidos[1].flags & 0x0800, 0x0800);
});

test("ZIP: recusa nome repetido, vazio ou que sobe de pasta", () => {
  const d = new Uint8Array([1]);
  assert.throws(() => partesDoZip([{ nome: "a.pdf", dados: d }, { nome: "a.pdf", dados: d }]), /Nome repetido/);
  assert.throws(() => partesDoZip([{ nome: "../a.pdf", dados: d }]), /Nome inválido/);
  assert.throws(() => partesDoZip([{ nome: "", dados: d }]), /Nome inválido/);
  // Vazio é um ZIP válido, só com o fim.
  assert.equal(juntar(partesDoZip([])).length, 22);
});
