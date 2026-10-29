import { lerDocumentoFiscal, rotuloDoDocumento, type DocumentoFiscalLido, type LeituraFiscal, type ParteDoDocumento } from "@/lib/prestacao/documento-fiscal";
import { mascararDocumento } from "@/lib/mcp/prestacao/despesas";

/** Emitente e tomador como o assistente vê: CPF só pelo miolo, CNPJ inteiro. */
function parte(p: ParteDoDocumento) {
  const digitos = (p.documento ?? "").replace(/\D/g, "");
  return { nome: p.nome, documento: mascararDocumento(digitos.length === 11 ? "pf" : null, p.documento) };
}

/** O que o XML de nota diz, para o assistente conferir com o que a pessoa contou antes de registrar a despesa. */
export function resumoFiscal(leitura: LeituraFiscal) {
  if (!leitura.ok) return { legivel: false as const, motivo: leitura.motivo };
  const d: DocumentoFiscalLido = leitura.documento;
  return {
    legivel: true as const,
    documento: rotuloDoDocumento(d),
    tipo: d.tipo,
    numero: d.numero,
    serie: d.serie,
    chave_de_acesso: d.chave,
    data_de_emissao: d.emissao,
    valor_bruto: d.valor,
    retencoes: d.retencoes,
    emitente: parte(d.emitente),
    tomador: parte(d.tomador),
    descricao: d.descricao ? d.descricao.slice(0, 300) : null,
    autorizada: d.autorizada,
    situacao: d.situacao,
  };
}

/** Lê o XML (se for XML) e devolve o resumo; arquivo de outro tipo não tem resumo fiscal. */
export function resumoFiscalDoArquivo(tipo: string | null, bytes: Buffer): ReturnType<typeof resumoFiscal> | null {
  if (tipo !== "xml") return null;
  return resumoFiscal(lerDocumentoFiscal(bytes.toString("utf8")));
}
