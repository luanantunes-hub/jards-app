// O rider estruturado (plano do módulo, PD2.5): as linhas do rider nascem do mapa de palco (medidas, canais e energia),
// sem redigitar, e depois se editam. Sem tela e sem banco.

import type { SecaoDoRider } from "@/lib/producao/estados";
import { cargaDeEnergia, listaDeCanais, type ObjetoDePalco } from "@/lib/producao/palco";

export const ROTULO_DA_SECAO: Record<SecaoDoRider, string> = {
  palco: "Palco", som: "Som", luz: "Luz", energia: "Energia", camarim: "Camarim", catering: "Catering", geral: "Geral",
};

export type LinhaDoRider = { secao: SecaoDoRider; texto: string; quantidade: number | null; obrigatorio: boolean; ordem: number };
export type RiderGerado = { nome: string; palco_largura_min_m: number; palco_profundidade_min_m: number; itens: LinhaDoRider[] };

const numero = (n: number) => n.toLocaleString("pt-BR");
const metros = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * O rider a partir da planta e dos objetos dela. Palco: as medidas mínimas (as da planta), os praticáveis e monitores
 * (agrupados) e os instrumentos em cena. Som: a mesa com o total de canais e quais canais são de quem. Energia: a carga
 * total, por fase e por circuito. Camarim, catering e luz ficam vazios: o que não está no desenho a pessoa escreve.
 */
export function gerarRiderDaPlanta(
  planta: { nome: string; largura_m: number; profundidade_m: number },
  objetos: readonly (ObjetoDePalco & { x_m?: number })[],
): RiderGerado {
  const itens: LinhaDoRider[] = [];
  const proximaOrdem = new Map<SecaoDoRider, number>();
  const poe = (secao: SecaoDoRider, texto: string, quantidade: number | null, obrigatorio: boolean) => {
    const ordem = proximaOrdem.get(secao) ?? 0;
    proximaOrdem.set(secao, ordem + 10);
    itens.push({ secao, texto: texto.slice(0, 500), quantidade, obrigatorio, ordem });
  };

  poe("palco", `Palco com no mínimo ${metros(planta.largura_m)} m de largura por ${metros(planta.profundidade_m)} m de profundidade`, null, true);
  const agrupar = (tipo: "praticavel" | "monitor") => {
    const grupos = new Map<string, number>();
    for (const objeto of objetos.filter(item => item.tipo === tipo)) grupos.set(objeto.rotulo, (grupos.get(objeto.rotulo) ?? 0) + 1);
    return [...grupos];
  };
  for (const [rotulo, quantidade] of agrupar("praticavel")) poe("palco", rotulo, quantidade, false);
  for (const [rotulo, quantidade] of agrupar("monitor")) poe("palco", rotulo, quantidade, false);
  const instrumentos = objetos.filter(objeto => objeto.tipo === "instrumento").map(objeto => objeto.rotulo);
  if (instrumentos.length > 0) poe("palco", `Em cena: ${[...new Set(instrumentos)].join(", ")}`, null, true);

  const canais = listaDeCanais(objetos);
  if (canais.total > 0) {
    poe("som", `Mesa de som com no mínimo ${canais.total} canais de entrada`, null, true);
    const faixas = new Map<string, { rotulo: string; de: number; ate: number }>();
    for (const linha of canais.linhas) {
      const faixa = faixas.get(linha.objetoId);
      faixas.set(linha.objetoId, faixa ? { ...faixa, de: Math.min(faixa.de, linha.canal), ate: Math.max(faixa.ate, linha.canal) } : { rotulo: linha.rotulo, de: linha.canal, ate: linha.canal });
    }
    for (const faixa of [...faixas.values()].sort((a, b) => a.de - b.de)) poe("som", `${faixa.de === faixa.ate ? `Canal ${faixa.de}` : `Canais ${faixa.de} a ${faixa.ate}`}: ${faixa.rotulo}`, null, true);
  }

  const energia = cargaDeEnergia(objetos);
  if (energia.totalW > 0) {
    poe("energia", `Carga prevista de ${numero(energia.totalW)} W (cerca de ${numero(Math.round(energia.totalW / energia.tensaoV))} A a ${energia.tensaoV} V)`, null, true);
    for (const fase of ["R", "S", "T"] as const) if (energia.porFase[fase] > 0) poe("energia", `Fase ${fase}: ${numero(energia.porFase[fase])} W`, null, true);
    for (const linha of energia.linhas) poe("energia", `${linha.circuito}${linha.fase ? ` (fase ${linha.fase})` : ""}: ${numero(linha.potenciaW)} W, cerca de ${numero(linha.correnteA)} A`, null, true);
  }
  const pontos = objetos.filter(objeto => objeto.tipo === "energia").length;
  if (pontos > 0) poe("energia", "Pontos de energia no palco, nas posições da planta", pontos, true);

  return { nome: `Rider · ${planta.nome}`.slice(0, 200), palco_largura_min_m: planta.largura_m, palco_profundidade_min_m: planta.profundidade_m, itens };
}

export type LeituraDaLinha =
  | { ok: true; linha: { secao: SecaoDoRider; texto: string; quantidade: number | null; obrigatorio: boolean } }
  | { ok: false; erro: string };

const SECOES: readonly string[] = Object.keys(ROTULO_DA_SECAO);

/** A linha do rider como o banco aceita: texto de 1 a 500 letras e quantidade inteira de 1 a 9.999 (ou vazia). */
export function lerLinhaDoRider(campos: { secao: string; texto: string; quantidade: string; obrigatorio: boolean }): LeituraDaLinha {
  if (!SECOES.includes(campos.secao)) return { ok: false, erro: "Escolha a seção." };
  const texto = campos.texto.trim();
  if (texto === "") return { ok: false, erro: "Escreva o que a casa precisa providenciar." };
  if (texto.length > 500) return { ok: false, erro: "O texto pode ter até 500 letras." };
  const bruta = campos.quantidade.trim();
  let quantidade: number | null = null;
  if (bruta !== "") {
    if (!/^\d{1,4}$/.test(bruta) || Number(bruta) < 1) return { ok: false, erro: "A quantidade é um número inteiro de 1 a 9.999." };
    quantidade = Number(bruta);
  }
  return { ok: true, linha: { secao: campos.secao as SecaoDoRider, texto, quantidade, obrigatorio: campos.obrigatorio } };
}
