"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SEM_PERMISSAO, type AcaoPrestacao, type PermissoesPrestacao } from "@/lib/prestacao/status";

const ACOES: AcaoPrestacao[] = ["editar", "avaliar", "decidir"];

/**
 * O que a pessoa pode fazer nesta prestação, pela mesma função que o banco
 * usa nas regras (auth_prestacao_pode). Enquanto carrega, nada é permitido.
 */
export function usePermissoesPrestacao(prestacaoId: string): PermissoesPrestacao {
  const supabase = useMemo(() => createClient(), []);
  const [carregadas, setCarregadas] = useState<{ prestacaoId: string; permissoes: PermissoesPrestacao } | null>(null);

  const consultar = useCallback(async (): Promise<PermissoesPrestacao> => {
    const respostas = await Promise.all(ACOES.map(acao =>
      supabase.rpc("auth_prestacao_pode" as never, { p_prestacao_id: prestacaoId, p_acao: acao } as never)));
    return Object.fromEntries(ACOES.map((acao, i) => [acao, respostas[i].data === true])) as PermissoesPrestacao;
  }, [prestacaoId, supabase]);

  useEffect(() => {
    let ativo = true;
    consultar().then(permissoes => { if (ativo) setCarregadas({ prestacaoId, permissoes }); });
    return () => { ativo = false; };
  }, [consultar, prestacaoId]);

  if (!carregadas || carregadas.prestacaoId !== prestacaoId) return SEM_PERMISSAO;
  return carregadas.permissoes;
}
