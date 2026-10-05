"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoFornecedor, PrestacaoFornecedorDocumento } from "@/lib/supabase/types";

export type DocumentoResumido = Pick<PrestacaoFornecedorDocumento, "fornecedor_id" | "tipo" | "created_at">;

/**
 * Fornecedores da organização (P2.3) e o tipo e a data dos comprovantes de
 * cada um (P2.3b), para ligar despesas e conferir cartão CNPJ e certidão.
 */
export function useFornecedoresDaOrganizacao(organizationId: string | null): {
  fornecedores: PrestacaoFornecedor[];
  documentosDe: (fornecedorId: string | null | undefined) => DocumentoResumido[];
  carregado: boolean;
  recarregar: () => void;
} {
  const supabase = useMemo(() => createClient(), []);
  const [dados, setDados] = useState<{ org: string; fornecedores: PrestacaoFornecedor[]; documentos: DocumentoResumido[] } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas ainda não estão no tipo Database
    const tabela = (nome: string) => (supabase as any).from(nome);
    Promise.all([
      tabela("prestacao_fornecedores").select("*").eq("organization_id", organizationId),
      tabela("prestacao_fornecedor_documentos").select("fornecedor_id, tipo, created_at").eq("organization_id", organizationId),
    ]).then(([f, d]: { data: unknown[] | null }[]) => {
      if (!ativo) return;
      setDados({
        org: organizationId,
        fornecedores: (f.data ?? []) as PrestacaoFornecedor[],
        documentos: (d.data ?? []) as DocumentoResumido[],
      });
    });
    return () => { ativo = false; };
  }, [organizationId, supabase, versao]);

  const atuais = dados?.org === organizationId ? dados : null;
  const porFornecedor = useMemo(() => {
    const mapa = new Map<string, DocumentoResumido[]>();
    for (const doc of atuais?.documentos ?? []) mapa.set(doc.fornecedor_id, [...(mapa.get(doc.fornecedor_id) ?? []), doc]);
    return mapa;
  }, [atuais]);
  const documentosDe = useCallback((id: string | null | undefined) => (id ? porFornecedor.get(id) ?? [] : []), [porFornecedor]);
  const recarregar = useCallback(() => setVersao(v => v + 1), []);

  return { fornecedores: atuais?.fornecedores ?? [], documentosDe, carregado: atuais !== null, recarregar };
}
