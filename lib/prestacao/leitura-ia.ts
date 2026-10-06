// Leitura por IA no app (P2.10b): a leitura da função extrair-comprovante vira
// o mesmo documento que o XML gera (lib/prestacao/documento-fiscal.ts), para
// passar pelas mesmas conferências, e os motivos que a IA apontou ganham o
// título do catálogo e a fonte da regra do regime. Guardados na despesa
// (motivos_ia), viram achados a revisar no motor de checagens, nunca
// bloqueio: a IA sugere e a pessoa decide. Sem React e sem Supabase.

import { lerChaveAcesso } from "./despesas";
import type { AvisoDoDocumento, DocumentoFiscalLido } from "./documento-fiscal";
import { definida, type RegimeNormativo } from "./regimes";
import {
  fonteDaChecagem,
  justificativaDaDespesa,
  novoAchado,
  severidadeDaChecagem,
  tituloDaChecagem,
  type Achado,
  type DespesaDoEstado,
  type FonteDoAchado,
} from "./checagens/catalogo";
import {
  MOTIVOS_DA_LEITURA,
  type LeituraDoComprovante,
  type MotivoLido,
} from "@/supabase/functions/_shared/leitura-documento";

/** Os motivos guardados na despesa, conferidos: código conhecido e texto. */
export function motivosDaIa(valor: unknown): MotivoLido[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((m): m is MotivoLido => Boolean(m) && typeof m === "object" && typeof m.codigo === "string" && m.codigo in MOTIVOS_DA_LEITURA && typeof m.texto === "string")
    .map(m => ({ codigo: m.codigo, texto: m.texto, ...(m.vedada ? { vedada: m.vedada } : {}) }));
}

/** Fonte do motivo: a vedada do regime, para despesa vedada; senão, a regra do catálogo. */
export function fonteDoMotivo(regime: RegimeNormativo | null, motivo: MotivoLido): FonteDoAchado | null {
  if (motivo.codigo === "DESPESA_VEDADA" && regime && motivo.vedada) {
    const despesas = definida(regime.despesas);
    const vedada = despesas?.vedadas.find(v => v.codigo === motivo.vedada);
    if (vedada) return { ...vedada.fonte, regra: { codigo: vedada.codigo, descricao: vedada.descricao } };
  }
  return fonteDaChecagem(regime, motivo.codigo);
}

export type MotivoParaMostrar = MotivoLido & { titulo: string; fonte: FonteDoAchado | null };

export function motivosParaMostrar(motivos: readonly MotivoLido[], regime: RegimeNormativo | null): MotivoParaMostrar[] {
  return motivos.map(m => ({ ...m, titulo: tituloDaChecagem(m.codigo), fonte: fonteDoMotivo(regime, m) }));
}

/** "IN 29/2026, art. 33, V". */
export function citacaoDaFonte(fonte: FonteDoAchado | null): string | null {
  return fonte ? [fonte.documento, fonte.dispositivo].filter(Boolean).join(", ") : null;
}

/** Os motivos da IA viram achados a revisar da despesa; a severidade do regime vale, mas no máximo alerta. */
export function achadosDaLeituraIa(despesa: DespesaDoEstado, regime: RegimeNormativo | null): Achado[] {
  return motivosDaIa(despesa.motivos_ia).map(motivo => {
    const doRegime = severidadeDaChecagem(regime, motivo.codigo, "alerta");
    const severidade = doRegime === "bloqueio" ? "alerta" : doRegime;
    return novoAchado(regime, {
      codigo: motivo.codigo,
      severidade,
      resultado: "revisar",
      entidade: { tipo: "despesa", id: despesa.id },
      ref: motivo.vedada ? `ia:${motivo.vedada}` : "ia",
      mensagem: `Leitura por IA: ${motivo.texto}`,
      fonte: fonteDoMotivo(regime, motivo),
      dados: { despesa: despesa.nome_arquivo, origem: "ia", vedada: motivo.vedada ?? null },
      justificativa: justificativaDaDespesa(despesa, severidade),
    });
  });
}

/** A leitura da IA no formato do documento lido do XML, com o que conferir dela. */
export function documentoDaLeituraIa(leitura: LeituraDoComprovante): { documento: DocumentoFiscalLido; avisos: AvisoDoDocumento[] } {
  const avisos: AvisoDoDocumento[] = [];
  let chave = leitura.chave_acesso;
  if (chave) {
    const lida = lerChaveAcesso(chave);
    if (!lida?.ok) {
      avisos.push({ nivel: "info", texto: `A chave de acesso lida pela IA não confere (${lida?.ok === false ? lida.motivo.replace(/\.$/, "") : "vazia"}); digite a chave na despesa.` });
      chave = null;
    }
  }
  return {
    documento: {
      formato: "ia",
      tipo: leitura.tipo ?? "outro",
      modelo: null,
      numero: leitura.numero_documento,
      serie: leitura.serie,
      chave,
      emissao: leitura.data_doc,
      valor: leitura.valor,
      liquidoInformado: null,
      retencoes: leitura.retencoes,
      emitente: leitura.emitente,
      tomador: leitura.tomador,
      descricao: leitura.descricao_servico,
      textos: leitura.descricao_servico ? [leitura.descricao_servico] : [],
      identificadorVisto: leitura.identificador_no_documento,
      autorizada: null,
      situacao: null,
    },
    avisos,
  };
}
