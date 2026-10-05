import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const VERDE = "#2E8932";
const CORAL = "#D94A4A";
const AMBAR = "#B07A14";
const CINZA = "#6B6B6B";

function Etiqueta({ cor, children, title }: { cor: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium"
      style={{ borderColor: cor + "47", color: cor }}
    >
      {children}
    </span>
  );
}

/** Situação na Receita; sem consulta, diz isso em vez de esconder. */
export function EtiquetaSituacao({ fornecedor }: { fornecedor: Pick<PrestacaoFornecedor, "tipo_pessoa" | "situacao_cadastral" | "cnpj_consultado_em"> }) {
  if (fornecedor.tipo_pessoa === "pf" || fornecedor.tipo_pessoa === "estrangeiro") {
    return <span className="whitespace-nowrap text-[0.6875rem] text-black/30" title="CPF e documento estrangeiro não têm consulta pública">Sem consulta</span>;
  }
  if (!fornecedor.situacao_cadastral) return <Etiqueta cor={CINZA}>Não consultado</Etiqueta>;
  const ativa = fornecedor.situacao_cadastral === "ATIVA";
  return <Etiqueta cor={ativa ? VERDE : CORAL}>{ativa ? "Ativa" : fornecedor.situacao_cadastral.charAt(0) + fornecedor.situacao_cadastral.slice(1).toLowerCase()}</Etiqueta>;
}

const SANCOES: Record<NonNullable<PrestacaoFornecedor["sancoes_situacao"]>, { rotulo: string; cor: string; dica: string }> = {
  nada_consta: { rotulo: "Nada consta", cor: VERDE, dica: "Nada consta no TCU, no CNJ (CNIA), no CEIS e no CNEP" },
  consta: { rotulo: "Consta sanção", cor: CORAL, dica: "Consta em pelo menos um cadastro de sanções" },
  a_conferir: { rotulo: "A conferir", cor: AMBAR, dica: "A consulta voltou sem resultado claro" },
  indisponivel: { rotulo: "Não respondeu", cor: CINZA, dica: "A consulta do TCU não respondeu" },
};

export function EtiquetaSancoes({ fornecedor }: { fornecedor: Pick<PrestacaoFornecedor, "tipo_pessoa" | "sancoes_situacao"> }) {
  if (fornecedor.tipo_pessoa === "pf" || fornecedor.tipo_pessoa === "estrangeiro") return <span className="text-[0.6875rem] text-black/30">—</span>;
  if (!fornecedor.sancoes_situacao) return <Etiqueta cor={CINZA}>Não consultado</Etiqueta>;
  const meta = SANCOES[fornecedor.sancoes_situacao];
  return <Etiqueta cor={meta.cor} title={meta.dica}>{meta.rotulo}</Etiqueta>;
}

export function EtiquetaResultadoCertidao({ resultado, situacao }: { resultado: "nada_consta" | "consta" | "a_conferir"; situacao: string | null }) {
  const meta = SANCOES[resultado];
  return <Etiqueta cor={meta.cor} title={situacao ?? undefined}>{meta.rotulo === "Consta sanção" ? "Consta" : meta.rotulo}</Etiqueta>;
}
