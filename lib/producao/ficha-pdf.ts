// A ficha do espaço e a ficha técnica das salas em um PDF para mandar a quem vai ocupar o espaço (PD3.5, primeiro
// corte). Só monta o documento (`DocumentoDoPdf`); quem gera o arquivo é `montarPdf`. Sem tela e sem banco.

import type { DocumentoDoPdf, LogoDoPdf, SecaoDoPdf } from "@/lib/producao/pdf-texto";
import { resumoDaFichaDaSala, type FichaDaSala, type FichaDoEspaco } from "@/lib/producao/ficha";
import type { PlantaParaPdf } from "@/lib/producao/planta-desenho";

const metros = (n: number | null | undefined) => (n == null ? null : `${n.toLocaleString("pt-BR")} m`);

export type EspacoParaPdf = { nome: string; tipo: string; uf: string | null; endereco: string | null; capacidade: number | null };
export type SalaParaPdf = { nome: string; capacidade: number | null; ficha: Partial<FichaDaSala> | null; planta?: PlantaParaPdf | null };

/** O documento: o espaço (com o contato, se houver) e uma seção por sala, só com o que está preenchido, com a planta da sala quando ela tem uma. */
export function documentoDaFicha(espaco: EspacoParaPdf, ficha: Partial<FichaDoEspaco> | null, salas: readonly SalaParaPdf[], equipamentos: readonly { nome: string; quantidade: number; sala: string | null }[] = []): DocumentoDoPdf {
  const secoes: SecaoDoPdf[] = [];
  const doEspaco = [
    ficha?.funcionamento ? `Funcionamento: ${ficha.funcionamento}` : null,
    ficha?.acessibilidade ? `Acessibilidade: ${ficha.acessibilidade}` : null,
    ficha?.carga_descarga ? `Carga e descarga: ${ficha.carga_descarga}` : null,
    metros(ficha?.doca_altura_m) ? `Altura da doca: ${metros(ficha?.doca_altura_m)}` : null,
    metros(ficha?.veiculo_max_m) ? `Veículo máximo: ${metros(ficha?.veiculo_max_m)} de comprimento` : null,
    ficha && (ficha.contato_nome || ficha.contato_telefone || ficha.contato_email) ? `Contato: ${[ficha.contato_nome, ficha.contato_telefone, ficha.contato_email].filter(Boolean).join(" · ")}` : null,
  ].filter((linha): linha is string => linha !== null);
  secoes.push({ titulo: "O espaço", linhas: doEspaco });

  for (const sala of salas) {
    const linhas = resumoDaFichaDaSala(sala.ficha ?? {});
    if (sala.ficha?.notas) linhas.push(`Notas: ${sala.ficha.notas}`);
    secoes.push({ titulo: `${sala.nome}${sala.capacidade ? ` · ${sala.capacidade.toLocaleString("pt-BR")} lugares` : ""}`, linhas, ...(sala.planta ? { planta: sala.planta } : {}) });
  }

  if (equipamentos.length > 0) {
    secoes.push({ titulo: "Equipamentos da casa (em uso)", linhas: equipamentos.map(item => `${item.quantidade > 1 ? `${item.quantidade.toLocaleString("pt-BR")} × ` : ""}${item.nome}${item.sala ? ` (${item.sala})` : ""}`) });
  }

  return {
    logoUrl: ficha?.logo_url ?? undefined,
    titulo: `Ficha técnica · ${espaco.nome}`,
    subtitulo: [espaco.tipo, espaco.uf, espaco.capacidade ? `${espaco.capacidade.toLocaleString("pt-BR")} lugares` : null, espaco.endereco].filter(Boolean).join(" · "),
    secoes,
    rodape: "Ficha técnica · Jards",
  };
}

/** Baixa o logo para desenhar no PDF. Sem endereço, com formato que o PDF não desenha ou com falha de rede, devolve nada: o PDF sai sem o logo. */
export async function logoParaOPdf(url: string | null | undefined): Promise<LogoDoPdf | undefined> {
  if (!url) return undefined;
  const tipo = /\.png$/i.test(url) ? "png" : /\.jpe?g$/i.test(url) ? "jpg" : null;
  if (!tipo) return undefined;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return undefined;
    return { bytes: new Uint8Array(await resposta.arrayBuffer()), tipo };
  } catch {
    return undefined;
  }
}
