// Os veículos da produção (plano do módulo, PD6.1): conferência do formulário com as regras do banco e a situação dos
// documentos (vencido, vence em breve). Sem tela e sem banco.

import {
  CATEGORIAS_DO_VEICULO, COMBUSTIVEIS_DO_VEICULO, CONTRATACOES_DO_VEICULO, TIPOS_DE_DOCUMENTO_DO_VEICULO,
  type CategoriaDoVeiculo, type CombustivelDoVeiculo, type ContratacaoDoVeiculo, type TipoDeDocumentoDoVeiculo,
} from "@/lib/producao/estados";
import { lerNumero } from "@/lib/producao/inventario";
import { somarDias } from "@/lib/producao/agenda";

export const ROTULO_DA_CATEGORIA_DO_VEICULO: Record<CategoriaDoVeiculo, string> = {
  leve: "Carro de passeio", van: "Van", micro_onibus: "Micro-ônibus", onibus: "Ônibus", caminhao: "Caminhão",
};

export const ROTULO_DO_COMBUSTIVEL: Record<CombustivelDoVeiculo, string> = {
  gasolina: "Gasolina", etanol: "Etanol", flex: "Flex", diesel_s10: "Diesel S10", diesel_s500: "Diesel S500",
};

export const ROTULO_DA_CONTRATACAO: Record<ContratacaoDoVeiculo, string> = {
  proprio: "Próprio", locado: "Locado, sem motorista", fretado_combustivel_incluso: "Fretado, com combustível",
};

export const ROTULO_DO_DOCUMENTO_DO_VEICULO: Record<TipoDeDocumentoDoVeiculo, string> = {
  documento_do_veiculo: "Documento do veículo", seguro: "Seguro", antt: "Licença da ANTT", vistoria: "Vistoria", outro: "Outro",
};

/** Placa como o banco guarda: maiúsculas, sem espaço nem hífen. Vale a placa antiga (ABC1234) e a do Mercosul (ABC1D23). */
export function normalizarPlaca(texto: string): string {
  return texto.replace(/[\s-]/g, "").toUpperCase();
}

const FORMATO_DA_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** A placa para mostrar: ABC-1234 na antiga, ABC1D23 no Mercosul. */
export function placaParaExibir(placa: string | null): string {
  if (!placa) return "";
  return /^[A-Z]{3}[0-9]{4}$/.test(placa) ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}

export type VeiculoLido = {
  nome: string; placa: string | null; modelo: string | null; ano: number | null; categoria: CategoriaDoVeiculo; combustivel: CombustivelDoVeiculo;
  contratacao: ContratacaoDoVeiculo; fornecedor: string | null; consumo_km_por_litro: number | null; capacidade_carga_kg: number | null;
  capacidade_volume_m3: number | null; lugares: number | null; notas: string | null;
};
export type LeituraDoVeiculo = { ok: true; veiculo: VeiculoLido } | { ok: false; erro: string };

export type CamposDoVeiculo = {
  nome: string; placa: string; modelo: string; ano: string; categoria: string; combustivel: string; contratacao: string; fornecedor: string;
  consumo: string; carga: string; volume: string; lugares: string; notas: string;
};

const texto = (valor: string) => (valor.trim() === "" ? null : valor.trim());

/** O veículo como o banco aceita (nome até 200, placa válida, ano de 1950 a 2100, consumo de 0,1 a 99, fornecedor só fora do próprio…). */
export function lerVeiculo(c: CamposDoVeiculo): LeituraDoVeiculo {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Dê um nome ao veículo, como \"Van da produção\"." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  if (!(CATEGORIAS_DO_VEICULO as readonly string[]).includes(c.categoria)) return { ok: false, erro: "Escolha o tipo do veículo." };
  if (!(COMBUSTIVEIS_DO_VEICULO as readonly string[]).includes(c.combustivel)) return { ok: false, erro: "Escolha o combustível." };
  if (!(CONTRATACOES_DO_VEICULO as readonly string[]).includes(c.contratacao)) return { ok: false, erro: "Diga se o veículo é próprio, locado ou fretado." };
  const placa = texto(normalizarPlaca(c.placa));
  if (placa && !FORMATO_DA_PLACA.test(placa)) return { ok: false, erro: "A placa tem três letras, um número, uma letra ou número e dois números (ABC1D23 ou ABC-1234)." };
  const modelo = texto(c.modelo);
  if (modelo && modelo.length > 200) return { ok: false, erro: "O modelo pode ter até 200 letras." };
  const anoLido = lerNumero(c.ano);
  if (anoLido === "invalido" || (anoLido !== null && (!Number.isInteger(anoLido) || anoLido < 1950 || anoLido > 2100))) return { ok: false, erro: "O ano é um número de 1950 a 2100." };
  const proprio = c.contratacao === "proprio";
  const fornecedor = proprio ? null : texto(c.fornecedor);
  if (fornecedor && fornecedor.length > 200) return { ok: false, erro: "O fornecedor pode ter até 200 letras." };
  const consumo = lerNumero(c.consumo);
  if (consumo === "invalido" || (consumo !== null && (consumo < 0.1 || consumo > 99))) return { ok: false, erro: "O consumo é em quilômetros por litro, de 0,1 a 99." };
  const carga = lerNumero(c.carga);
  if (carga === "invalido" || (carga !== null && carga > 999999)) return { ok: false, erro: "A capacidade de carga é um número de quilos." };
  const volume = lerNumero(c.volume);
  if (volume === "invalido" || (volume !== null && volume > 9999)) return { ok: false, erro: "O volume de carga é um número de metros cúbicos." };
  const lugares = lerNumero(c.lugares);
  if (lugares === "invalido" || (lugares !== null && (!Number.isInteger(lugares) || lugares < 1 || lugares > 99))) return { ok: false, erro: "Os lugares são um número inteiro de 1 a 99." };
  const notas = texto(c.notas);
  if (notas && notas.length > 2000) return { ok: false, erro: "As notas podem ter até 2.000 letras." };
  return {
    ok: true,
    veiculo: {
      nome, placa, modelo, ano: anoLido, categoria: c.categoria as CategoriaDoVeiculo, combustivel: c.combustivel as CombustivelDoVeiculo,
      contratacao: c.contratacao as ContratacaoDoVeiculo, fornecedor, consumo_km_por_litro: consumo, capacidade_carga_kg: carga,
      capacidade_volume_m3: volume, lugares, notas,
    },
  };
}

export type DocumentoLido = { tipo: TipoDeDocumentoDoVeiculo; numero: string | null; validade: string | null; observacoes: string | null };
export type LeituraDoDocumento = { ok: true; documento: DocumentoLido } | { ok: false; erro: string };

/** O documento do veículo como o banco aceita (número até 100 letras, observações até 1.000, validade em data). */
export function lerDocumentoDoVeiculo(c: { tipo: string; numero: string; validade: string; observacoes: string }): LeituraDoDocumento {
  if (!(TIPOS_DE_DOCUMENTO_DO_VEICULO as readonly string[]).includes(c.tipo)) return { ok: false, erro: "Escolha o tipo do documento." };
  const numero = texto(c.numero);
  if (numero && numero.length > 100) return { ok: false, erro: "O número pode ter até 100 letras." };
  const validade = texto(c.validade);
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return { ok: false, erro: "A validade é uma data." };
  const observacoes = texto(c.observacoes);
  if (observacoes && observacoes.length > 1000) return { ok: false, erro: "As observações podem ter até 1.000 letras." };
  return { ok: true, documento: { tipo: c.tipo as TipoDeDocumentoDoVeiculo, numero, validade, observacoes } };
}

/** Quantos dias antes do fim da validade o documento passa a pedir atenção. */
export const DIAS_DE_AVISO_DO_DOCUMENTO = 30;

export type SituacaoDoDocumento = "sem_validade" | "em_dia" | "vence_em_breve" | "vencido";

/** Vencido (a validade passou), vence em breve (nos próximos 30 dias, hoje incluído), em dia ou sem validade. */
export function situacaoDoDocumento(validade: string | null, hoje: string): SituacaoDoDocumento {
  if (!validade) return "sem_validade";
  if (validade < hoje) return "vencido";
  return validade <= somarDias(hoje, DIAS_DE_AVISO_DO_DOCUMENTO) ? "vence_em_breve" : "em_dia";
}

export type DocumentoParaResumo = { tipo: TipoDeDocumentoDoVeiculo; validade: string | null };

/** O que pede atenção nos documentos de um veículo: quantos vencidos e quantos vencem em breve (o mais próximo da data primeiro). */
export function resumoDosDocumentos(documentos: readonly DocumentoParaResumo[], hoje: string): { vencidos: number; vencemEmBreve: number; proximo: DocumentoParaResumo | null } {
  let vencidos = 0, vencemEmBreve = 0;
  let proximo: DocumentoParaResumo | null = null;
  for (const documento of documentos) {
    const situacao = situacaoDoDocumento(documento.validade, hoje);
    if (situacao === "vencido") vencidos++;
    if (situacao === "vence_em_breve") vencemEmBreve++;
    if ((situacao === "vencido" || situacao === "vence_em_breve") && documento.validade && (!proximo || (proximo.validade && documento.validade < proximo.validade))) proximo = documento;
  }
  return { vencidos, vencemEmBreve, proximo };
}
