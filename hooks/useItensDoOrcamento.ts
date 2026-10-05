"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { itensDaArvore, montarArvore, type GrupoCusto, type NoOrcamento } from "@/lib/prestacao/orcamento";

export type ItemDoOrcamento = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  /** Agrupadores acima do item, do mais alto ao mais próximo. */
  caminho: string[];
  grupo: GrupoCusto | null;
  aprovado: number;
  vigente: number;
};

/**
 * Itens (folhas) da versão em uso do orçamento em árvore (P1.6), na ordem da
 * árvore. Telas que ligam comprovantes a itens ou comparam executado com
 * orçamento usam esta lista; a aba Orçamento monta a árvore inteira.
 */
export function useItensDoOrcamento(prestacaoId: string, recarga = 0): { itens: ItemDoOrcamento[]; carregado: boolean } {
  const supabase = useMemo(() => createClient(), []);
  const [lidos, setLidos] = useState<{ chave: string; itens: ItemDoOrcamento[] } | null>(null);
  const chave = `${prestacaoId}:${recarga}`;

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do orçamento ainda não estão no tipo Database
    (supabase as any)
      .from("prestacao_orcamento_nos")
      .select("*, versao:prestacao_orcamento_versoes!inner(ativa)")
      .eq("prestacao_id", prestacaoId)
      .eq("versao.ativa", true)
      .then(({ data }: { data: NoOrcamento[] | null }) => {
        if (!ativo) return;
        const itens = itensDaArvore(montarArvore(data ?? [], []).raizes).map(linha => ({
          id: linha.no.id,
          codigo: linha.no.codigo,
          nome: linha.no.nome,
          descricao: linha.no.descricao,
          caminho: linha.caminho,
          grupo: linha.grupo,
          aprovado: linha.totais.aprovado,
          vigente: linha.totais.vigente,
        }));
        setLidos({ chave, itens });
      });
    return () => { ativo = false; };
  }, [supabase, prestacaoId, chave]);

  return lidos?.chave === chave ? { itens: lidos.itens, carregado: true } : { itens: [], carregado: false };
}
