// Obras vedadas (P9.1), quando o regime traz a despesa vedada "obras" (na
// saúde, Anexo LXXXVI-A, art. 26: obras, reformas, ampliações e construções;
// no Anexo LXXXVI, só ampliação e construção, porque a reforma era admitida
// com requisitos). Dois sinais, para revisar:
//  * item do orçamento com nome de obra ("Reforma do ambulatório");
//  * despesa com fornecedor cuja atividade principal é da construção (CNAE
//    41, 42 ou 43), só onde a reforma também é vedada.
// A leitura da nota pela IA (P2.10b) continua apontando a despesa vedada.

import { definida } from "../regimes";
import { ehDespesa } from "../despesas";
import { novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

const FAMILIAS = [
  { chave: "obra", nome: /\bobras?\b/i, termo: /\bobras?\b/i },
  { chave: "reforma", nome: /\breformas?\b/i, termo: /\breformas?\b/i },
  { chave: "ampliacao", nome: /\bampliaç(ão|ões)\b|\bampliac(ao|oes)\b/i, termo: /\bamplia/i },
  { chave: "construcao", nome: /\bconstruç(ão|ões)\b|\bconstruc(ao|oes)\b|\bedificaç(ão|ões)\b|\balvenaria\b/i, termo: /\bconstru/i },
] as const;

/** "Mão de obra" é pessoal, não obra. */
const MAO_DE_OBRA = /m[aã]o[\s-]+de[\s-]+obra/gi;

/** As famílias de obra que a vedada do regime cita ("Obras, reformas, ampliações e construções"). */
export function obrasVedadas(descricao: string): (typeof FAMILIAS)[number]["chave"][] {
  return FAMILIAS.filter(f => f.termo.test(descricao)).map(f => f.chave);
}

/** O nome parece de obra, entre as famílias vedadas. */
export function pareceObra(nome: string, familias: readonly string[]): boolean {
  const limpo = nome.replace(MAO_DE_OBRA, " ");
  return FAMILIAS.some(f => familias.includes(f.chave) && f.nome.test(limpo));
}

/** CNAE da construção: divisões 41 (edifícios), 42 (infraestrutura) e 43 (serviços especializados). */
export const ehCnaeDeConstrucao = (cnae: string | null | undefined) => /^4[123]/.test((cnae ?? "").replace(/\D/g, ""));

const formatarCnae = (cnae: string) => {
  const d = cnae.replace(/\D/g, "");
  return d.length === 7 ? `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}` : cnae;
};

export function checarObras(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const vedada = regime ? definida(regime.despesas)?.vedadas.find(v => v.codigo === "obras") ?? null : null;
  if (!vedada) return [];
  const familias = obrasVedadas(vedada.descricao);
  if (!familias.length) return [];
  const oQue = vedada.descricao.replace(/\.$/, "").toLowerCase();
  const achados: Achado[] = [];

  for (const no of estado.nos ?? []) {
    if (no.tipo !== "item" || !pareceObra(no.nome, familias)) continue;
    achados.push(novoAchado(regime, {
      codigo: "ITEM_DE_OBRA",
      severidade: "alerta",
      entidade: { tipo: "prestacao", id: null },
      ref: no.id,
      mensagem: `O item "${no.nome}" parece obra: ${oQue} são vedadas pelo regime. Tire o item do orçamento ou, se não for obra, dispense com o motivo.`,
      dados: { item: no.nome },
      fonte: { ...vedada.fonte },
    }));
  }

  // O CNAE só distingue a reforma da construção quando as duas são vedadas.
  if (familias.includes("reforma")) {
    const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
    for (const d of estado.despesas) {
      if (d.status === "rejeitado" || !ehDespesa(d.tipo) || !d.fornecedor_id) continue;
      const f = fornecedores.get(d.fornecedor_id);
      if (!f || !ehCnaeDeConstrucao(f.cnae_principal)) continue;
      const nome = f.razao_social || f.nome || f.documento || "O fornecedor";
      const atividade = f.cnae_descricao ? `${f.cnae_descricao.toLowerCase()} (CNAE ${formatarCnae(f.cnae_principal!)})` : `CNAE ${formatarCnae(f.cnae_principal!)}`;
      achados.push(novoAchado(regime, {
        codigo: "DESPESA_DE_OBRA",
        severidade: "alerta",
        entidade: { tipo: "despesa", id: d.id },
        mensagem: `${d.nome_arquivo || "Despesa"}: ${nome} tem como atividade principal ${atividade}, da construção; ${oQue} são vedadas pelo regime. Se o serviço não for obra, dispense com o motivo.`,
        dados: { fornecedor: nome, cnae: f.cnae_principal, despesa: d.nome_arquivo },
        fonte: { ...vedada.fonte },
      }));
    }
  }
  return achados;
}
