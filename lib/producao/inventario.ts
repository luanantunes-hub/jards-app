// O inventário da produção (plano do módulo, PD2.1): conferência do formulário com as regras do banco e os totais
// (volume em m³, peso em kg e valor em R$). Sem tela e sem banco.

import { CATEGORIAS_DO_ITEM, DONOS_DO_ITEM, type CategoriaDoItem, type DonoDoItem } from "@/lib/producao/estados";

export const ROTULO_DA_CATEGORIA: Record<CategoriaDoItem, string> = {
  cenario: "Cenário", figurino: "Figurino", instrumento: "Instrumento", luz: "Luz", som: "Som", video: "Vídeo",
  praticavel: "Praticável", adereco: "Adereço", obra_de_arte: "Obra de arte", outro: "Outro",
};

export const ROTULO_DO_DONO: Record<DonoDoItem, string> = { producao: "Da produção", espaco: "De um espaço", locado: "Locado" };

/** Número digitado ("1.250,5", "40", "0,75"): vazio é nulo; nega o que não é número ou é negativo. */
export function lerNumero(texto: string): number | null | "invalido" {
  const limpo = texto.trim();
  if (limpo === "") return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  if (!/^\d+(\.\d+)?$/.test(normal)) return "invalido";
  const numero = Number(normal);
  return Number.isFinite(numero) ? numero : "invalido";
}

export type ItemLido = {
  nome: string; categoria: CategoriaDoItem; dono: DonoDoItem; espaco_id: string | null; fornecedor: string | null;
  locacao_inicio: string | null; locacao_fim: string | null; quantidade: number;
  comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null;
  serie: string | null; potencia_w: number | null; canais: number | null; notas: string | null;
};
export type LeituraDoItem = { ok: true; item: ItemLido; valor_unitario: number | null; valor_locacao: number | null } | { ok: false; erro: string };

export type CamposDoItem = {
  nome: string; categoria: string; dono: string; espacoId: string; fornecedor: string; locacaoInicio: string; locacaoFim: string; quantidade: string;
  comprimento: string; largura: string; altura: string; peso: string; serie: string; potencia: string; canais: string; notas: string; valorUnitario: string; valorLocacao: string;
};

const texto = (valor: string) => (valor.trim() === "" ? null : valor.trim());

/** O item como o banco aceita (nome até 200, quantidade de 1 a 99.999, canais até 512, locação só no locado…). */
export function lerItem(c: CamposDoItem): LeituraDoItem {
  const nome = c.nome.trim();
  if (nome === "") return { ok: false, erro: "Informe o nome do item." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  if (!(CATEGORIAS_DO_ITEM as readonly string[]).includes(c.categoria)) return { ok: false, erro: "Escolha a categoria." };
  if (!(DONOS_DO_ITEM as readonly string[]).includes(c.dono)) return { ok: false, erro: "Escolha de quem é o item." };
  const quantidade = lerNumero(c.quantidade || "1");
  if (quantidade === "invalido" || quantidade === null || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99999) return { ok: false, erro: "A quantidade é um número inteiro de 1 a 99.999." };
  const medida = (campo: string, rotulo: string, limite = Infinity): number | null | "erro" => {
    const n = lerNumero(campo);
    if (n === "invalido" || (n !== null && n > limite)) return "erro";
    return n;
  };
  const comprimento = medida(c.comprimento, "comprimento"), largura = medida(c.largura, "largura"), altura = medida(c.altura, "altura"), peso = medida(c.peso, "peso");
  if ([comprimento, largura, altura, peso].includes("erro")) return { ok: false, erro: "Dimensões e peso são números positivos (cm e kg)." };
  const potenciaLida = lerNumero(c.potencia), canaisLidos = lerNumero(c.canais);
  if (potenciaLida === "invalido" || (potenciaLida !== null && !Number.isInteger(potenciaLida))) return { ok: false, erro: "A potência (W) é um número inteiro." };
  if (canaisLidos === "invalido" || (canaisLidos !== null && (!Number.isInteger(canaisLidos) || canaisLidos > 512))) return { ok: false, erro: "Os canais são um número inteiro de 0 a 512." };
  const locado = c.dono === "locado";
  const fornecedor = locado ? texto(c.fornecedor) : null;
  if (fornecedor && fornecedor.length > 200) return { ok: false, erro: "O fornecedor pode ter até 200 letras." };
  const inicio = locado ? texto(c.locacaoInicio) : null, fim = locado ? texto(c.locacaoFim) : null;
  if (inicio && fim && fim < inicio) return { ok: false, erro: "A devolução vem antes da retirada." };
  const serie = texto(c.serie);
  if (serie && serie.length > 100) return { ok: false, erro: "A série pode ter até 100 letras." };
  const notas = texto(c.notas);
  if (notas && notas.length > 2000) return { ok: false, erro: "As notas podem ter até 2.000 letras." };
  const valorUnitario = lerNumero(c.valorUnitario), valorLocacao = lerNumero(c.valorLocacao);
  if (valorUnitario === "invalido" || valorLocacao === "invalido") return { ok: false, erro: "O valor é um número positivo (R$)." };
  return {
    ok: true,
    item: {
      nome, categoria: c.categoria as CategoriaDoItem, dono: c.dono as DonoDoItem, espaco_id: c.dono === "espaco" ? texto(c.espacoId) : null, fornecedor,
      locacao_inicio: inicio, locacao_fim: fim, quantidade, comprimento_cm: comprimento as number | null, largura_cm: largura as number | null,
      altura_cm: altura as number | null, peso_kg: peso as number | null, serie, potencia_w: potenciaLida, canais: canaisLidos, notas,
    },
    valor_unitario: valorUnitario, valor_locacao: locado ? valorLocacao : null,
  };
}

export type ItemParaTotal = { quantidade: number; comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null; dono: DonoDoItem };

/** O volume do item em m³ (as três dimensões em cm × a quantidade); nulo se falta alguma dimensão. */
export function volumeM3(item: ItemParaTotal): number | null {
  if (item.comprimento_cm === null || item.largura_cm === null || item.altura_cm === null) return null;
  return (item.comprimento_cm * item.largura_cm * item.altura_cm * item.quantidade) / 1_000_000;
}

export function pesoTotalKg(item: ItemParaTotal): number | null {
  return item.peso_kg === null ? null : item.peso_kg * item.quantidade;
}

export type TotaisDoInventario = { itens: number; unidades: number; volumeM3: number; pesoKg: number; semMedidas: number };

/** Soma os itens; `semMedidas` conta quantos ficaram de fora do volume ou do peso por falta de dimensão ou de peso. */
export function totaisDoInventario(itens: readonly ItemParaTotal[]): TotaisDoInventario {
  let volume = 0, peso = 0, semMedidas = 0;
  for (const item of itens) {
    const v = volumeM3(item), p = pesoTotalKg(item);
    if (v === null || p === null) semMedidas++;
    volume += v ?? 0;
    peso += p ?? 0;
  }
  const arredondar = (n: number) => Math.round(n * 1000) / 1000;
  return { itens: itens.length, unidades: itens.reduce((soma, item) => soma + item.quantidade, 0), volumeM3: arredondar(volume), pesoKg: arredondar(peso), semMedidas };
}

/** O valor do item: valor por unidade × quantidade, mais o custo da locação (se for locado). */
export function valorTotalDoItem(quantidade: number, valores: { valor_unitario: number | null; valor_locacao: number | null } | null): number {
  if (!valores) return 0;
  return (valores.valor_unitario ?? 0) * quantidade + (valores.valor_locacao ?? 0);
}
