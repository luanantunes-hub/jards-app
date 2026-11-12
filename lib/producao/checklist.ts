// O checklist de transporte (plano do módulo, PD6.3): os documentos que cada tipo de deslocamento costuma pedir, o que
// preencher a partir do que a data leva, a soma de peso e volume contra a capacidade do veículo e o resumo das conferências.
// Sem tela e sem banco.

import { volumeM3, pesoTotalKg } from "@/lib/producao/inventario";
import type { ContratacaoDoVeiculo, SituacaoDaConferencia, TipoDeDeslocamento } from "@/lib/producao/estados";

export type FaseDaConferencia = "saida" | "volta";

/** O texto de cada situação, na saída ("Foi") e na volta ("Voltou"). */
export const ROTULO_DA_CONFERENCIA: Record<FaseDaConferencia, Record<SituacaoDaConferencia, string>> = {
  saida: { pendente: "Pendente", conferido: "Foi", faltou: "Faltou", avariado: "Avariado" },
  volta: { pendente: "Pendente", conferido: "Voltou", faltou: "Faltou", avariado: "Avariado" },
};

export type LeituraDaLinha = { ok: true; nome: string; quantidade: number } | { ok: false; erro: string };

/** A linha digitada como o banco aceita (nome até 200; quantidade inteira de 1 a 99.999; vazio vira 1). */
export function lerLinhaDoChecklist(c: { nome: string; quantidade: string }): LeituraDaLinha {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Escreva o que vai." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  const texto = c.quantidade.trim() === "" ? "1" : c.quantidade.trim();
  const quantidade = Number(texto);
  if (!/^\d+$/.test(texto) || quantidade < 1 || quantidade > 99999) return { ok: false, erro: "A quantidade é um número inteiro de 1 a 99.999." };
  return { ok: true, nome, quantidade };
}

/**
 * Os documentos que o deslocamento costuma pedir. Van, carro, caminhão e ônibus: a CNH do motorista e o documento do veículo; o
 * caminhão leva a nota de remessa ou a declaração de conteúdo; o ônibus e o veículo fretado pedem a licença da ANTT e a lista de
 * passageiros; voo, trem e balsa pedem as passagens e a identificação de quem viaja. A produção edita a lista à vontade.
 */
export function documentosSugeridos(tipo: TipoDeDeslocamento, contratacao: ContratacaoDoVeiculo | null): string[] {
  if (tipo === "aviao" || tipo === "trem" || tipo === "balsa") return ["Passagens ou bilhetes", "Documento de identificação de quem viaja"];
  if (tipo === "outro") return [];
  const documentos = ["CNH do motorista (na categoria do veículo)", "Documento do veículo"];
  if (tipo === "caminhao") documentos.push("Nota de remessa ou declaração de conteúdo");
  if (tipo === "onibus" || contratacao === "fretado_combustivel_incluso") documentos.push("Licença da ANTT do fretamento", "Lista de passageiros");
  return documentos;
}

type LigacaoDaData = { item_id: string; nome: string; quantidade: number };

/** O que a data leva e ainda não está no checklist (um item do inventário entra uma vez só). */
export function itensParaPreencher(ligacoes: readonly LigacaoDaData[], jaNoChecklist: ReadonlySet<string>): LigacaoDaData[] {
  return ligacoes.filter(ligacao => !jaNoChecklist.has(ligacao.item_id));
}

/** Os documentos sugeridos que ainda não estão no checklist (sem diferenciar maiúsculas). */
export function documentosParaPreencher(sugeridos: readonly string[], nomesNoChecklist: readonly string[]): string[] {
  const existentes = new Set(nomesNoChecklist.map(nome => nome.trim().toLocaleLowerCase("pt-BR")));
  return sugeridos.filter(nome => !existentes.has(nome.trim().toLocaleLowerCase("pt-BR")));
}

type Medidas = { comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null };
export type LinhaParaTotal = { tipo: "item" | "documento"; quantidade: number; medidas: Medidas | null };

/** Peso (kg) e volume (m³) do que vai; documentos não entram; item sem medida ou sem peso fica fora e é contado em `semMedidas`. */
export function totaisDoChecklist(linhas: readonly LinhaParaTotal[]): { pesoKg: number; volumeM3: number; semMedidas: number } {
  let peso = 0, volume = 0, semMedidas = 0;
  for (const linha of linhas) {
    if (linha.tipo !== "item") continue;
    const base = { quantidade: linha.quantidade, comprimento_cm: linha.medidas?.comprimento_cm ?? null, largura_cm: linha.medidas?.largura_cm ?? null, altura_cm: linha.medidas?.altura_cm ?? null, peso_kg: linha.medidas?.peso_kg ?? null, dono: "producao" as const };
    const v = volumeM3(base), p = pesoTotalKg(base);
    if (v === null || p === null) semMedidas++;
    volume += v ?? 0;
    peso += p ?? 0;
  }
  const arredondar = (n: number) => Math.round(n * 1000) / 1000;
  return { pesoKg: arredondar(peso), volumeM3: arredondar(volume), semMedidas };
}

const numero = (n: number, casas: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

/** Os avisos de capacidade: a carga passa do que o veículo leva em peso ou em volume (sem a capacidade cadastrada, não há aviso). */
export function avisosDeCapacidade(totais: { pesoKg: number; volumeM3: number }, veiculo: { capacidade_carga_kg: number | null; capacidade_volume_m3: number | null } | null): string[] {
  if (!veiculo) return [];
  const avisos: string[] = [];
  if (veiculo.capacidade_carga_kg !== null && totais.pesoKg > veiculo.capacidade_carga_kg) avisos.push(`A carga pesa ${numero(totais.pesoKg, 1)} kg e o veículo leva ${numero(veiculo.capacidade_carga_kg, 0)} kg.`);
  if (veiculo.capacidade_volume_m3 !== null && totais.volumeM3 > veiculo.capacidade_volume_m3) avisos.push(`A carga ocupa ${numero(totais.volumeM3, 2)} m³ e o veículo leva ${numero(veiculo.capacidade_volume_m3, 2)} m³.`);
  return avisos;
}

export type ResumoDaConferencia = { total: number; conferidos: number; faltaram: number; avariados: number; pendentes: number; completa: boolean };

/** Quantas linhas foram conferidas, faltaram, vieram avariadas ou ainda estão pendentes, na saída ou na volta. */
export function resumoDaConferencia(linhas: readonly { saida: SituacaoDaConferencia; volta: SituacaoDaConferencia }[], fase: FaseDaConferencia): ResumoDaConferencia {
  const situacoes = linhas.map(linha => linha[fase]);
  const conta = (situacao: SituacaoDaConferencia) => situacoes.filter(atual => atual === situacao).length;
  const pendentes = conta("pendente");
  return { total: linhas.length, conferidos: conta("conferido"), faltaram: conta("faltou"), avariados: conta("avariado"), pendentes, completa: linhas.length > 0 && pendentes === 0 };
}

/** "3 de 5 conferidos · 1 faltou · 1 avariado", ou "nada a conferir". */
export function textoDoResumo(resumo: ResumoDaConferencia): string {
  if (resumo.total === 0) return "nada a conferir";
  const partes = [`${resumo.conferidos} de ${resumo.total} conferidos`];
  if (resumo.faltaram > 0) partes.push(resumo.faltaram === 1 ? "1 faltou" : `${resumo.faltaram} faltaram`);
  if (resumo.avariados > 0) partes.push(resumo.avariados === 1 ? "1 avariado" : `${resumo.avariados} avariados`);
  return partes.join(" · ");
}

export type DeslocamentoParaCarga = { id: string; veiculo_id: string | null; rotulo: string; dia: string };
export type LinhaParaCarga = { deslocamento_id: string; tipo: "item" | "documento"; quantidade: number; item_id: string | null };
export type VeiculoParaCarga = { id: string; nome: string; capacidade_carga_kg: number | null; capacidade_volume_m3: number | null };
export type CargaDoDeslocamento = { id: string; rotulo: string; dia: string; unidades: number; pesoKg: number; volumeM3: number; semMedidas: number; avisos: string[] };
export type CargaDoVeiculo = { veiculoId: string | null; nome: string; deslocamentos: CargaDoDeslocamento[] };

/**
 * A carga de cada veículo (PD6.12): para cada deslocamento com itens no checklist, a quantidade, o peso e o volume contra a
 * capacidade do veículo dele. Os deslocamentos sem veículo ficam num grupo "Sem veículo" (por último). Documentos não contam como
 * carga. Os veículos saem por nome e os deslocamentos por dia.
 */
export function cargaPorVeiculo(
  deslocamentos: readonly DeslocamentoParaCarga[], linhas: readonly LinhaParaCarga[], medidas: ReadonlyMap<string, Medidas>, veiculos: ReadonlyMap<string, VeiculoParaCarga>,
): CargaDoVeiculo[] {
  const grupos = new Map<string, CargaDoVeiculo>();
  for (const deslocamento of deslocamentos) {
    const doDeslocamento = linhas.filter(linha => linha.deslocamento_id === deslocamento.id && linha.tipo === "item");
    if (doDeslocamento.length === 0) continue;
    const veiculo = deslocamento.veiculo_id ? veiculos.get(deslocamento.veiculo_id) ?? null : null;
    const totais = totaisDoChecklist(doDeslocamento.map(linha => ({ tipo: linha.tipo, quantidade: linha.quantidade, medidas: linha.item_id ? medidas.get(linha.item_id) ?? null : null })));
    const chave = veiculo?.id ?? "sem-veiculo";
    const grupo = grupos.get(chave) ?? { veiculoId: veiculo?.id ?? null, nome: veiculo?.nome ?? "Sem veículo", deslocamentos: [] };
    grupo.deslocamentos.push({
      id: deslocamento.id, rotulo: deslocamento.rotulo, dia: deslocamento.dia, unidades: doDeslocamento.reduce((soma, linha) => soma + linha.quantidade, 0),
      pesoKg: totais.pesoKg, volumeM3: totais.volumeM3, semMedidas: totais.semMedidas, avisos: avisosDeCapacidade(totais, veiculo),
    });
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map(grupo => ({ ...grupo, deslocamentos: [...grupo.deslocamentos].sort((a, b) => a.dia.localeCompare(b.dia) || a.rotulo.localeCompare(b.rotulo, "pt-BR")) }))
    .sort((a, b) => (a.veiculoId === null ? 1 : 0) - (b.veiculoId === null ? 1 : 0) || a.nome.localeCompare(b.nome, "pt-BR"));
}
