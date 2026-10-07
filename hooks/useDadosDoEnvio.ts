"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estadoDaPrestacao } from "@/lib/prestacao/checagens/estado";
import type { ArquivoDoChecklist, ContaDoChecklist, DadosDoChecklist, DevolucaoDoChecklist, MarcacaoDoChecklist } from "@/lib/prestacao/envio";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { EVENTO_VERIFICADA } from "@/lib/prestacao/verificar-cliente";

export type DadosDoEnvio = Omit<DadosDoChecklist, "etapa"> & { verificadaEm: string | null; identificador: string | null };

type Importacao = { conta_id: string; periodo_fim: string | null; saldo_final: number | null; created_at: string };

/**
 * O que o checklist de envio (P4.1) avalia: o estado da prestação que o motor
 * de checagens usa, as verificações, as contas com os extratos, as marcações
 * e os arquivos do checklist, e as devoluções (P4.4). Lê de novo quando uma verificação termina.
 */
export function useDadosDoEnvio(prestacaoId: string): { dados: DadosDoEnvio | null; erro: string; recarregar: () => Promise<void> } {
  const supabase = useMemo(() => createClient(), []);
  const [lidos, setLidos] = useState<{ prestacaoId: string; dados: DadosDoEnvio | null; erro: string } | null>(null);

  const buscar = useCallback(async (): Promise<{ dados: DadosDoEnvio | null; erro: string }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    try {
      const [estado, prestacao, verificacoes, contas, importacoes, marcacoes, arquivos, devolucoes] = await Promise.all([
        estadoDaPrestacao(supabase, prestacaoId),
        db.from("prestacoes_contas").select("verificada_em, titulo, identificador_oficial").eq("id", prestacaoId).maybeSingle(),
        db.from("prestacao_verificacoes").select("check_codigo, status").eq("prestacao_id", prestacaoId).eq("status", "aberta"),
        db.from("prestacao_contas_bancarias").select("id, tipo, apelido, banco, conta, data_encerramento").eq("prestacao_id", prestacaoId).order("created_at"),
        db.from("prestacao_extrato_importacoes").select("conta_id, periodo_fim, saldo_final, created_at").eq("prestacao_id", prestacaoId),
        db.from("prestacao_envio_checklist").select("etapa, tipo, codigo, situacao, justificativa, marcado_por, updated_at").eq("prestacao_id", prestacaoId),
        db.from("prestacao_envio_arquivos").select("id, etapa, codigo, storage_path, nome_arquivo, mime_type, tamanho_bytes, created_at").eq("prestacao_id", prestacaoId).order("created_at"),
        db.from("prestacao_devolucoes").select("motivo, situacao, valor_principal, valor_atualizado, valor_pago, pago_em, storage_path").eq("prestacao_id", prestacaoId),
      ]);
      const falha = prestacao.error ?? verificacoes.error ?? contas.error ?? importacoes.error ?? marcacoes.error ?? arquivos.error ?? devolucoes.error;
      if (falha) return { dados: null, erro: mensagemErroPrestacao(falha, "Não foi possível carregar o checklist de envio") };
      const extratos = (importacoes.data ?? []) as Importacao[];
      return {
        erro: "",
        dados: {
          regime: estado.regime,
          estado,
          verificacoes: verificacoes.data ?? [],
          contas: ((contas.data ?? []) as Omit<ContaDoChecklist, "extratos">[]).map(c => ({
            ...c,
            extratos: extratos.filter(e => e.conta_id === c.id).map(e => ({ ...e, saldo_final: e.saldo_final === null ? null : Number(e.saldo_final) })),
          })),
          marcacoes: (marcacoes.data ?? []) as MarcacaoDoChecklist[],
          arquivos: (arquivos.data ?? []) as ArquivoDoChecklist[],
          devolucoes: (devolucoes.data ?? []) as DevolucaoDoChecklist[],
          verificadaEm: prestacao.data?.verificada_em ?? null,
          identificador: prestacao.data?.identificador_oficial || prestacao.data?.titulo || null,
        },
      };
    } catch (e) {
      return { dados: null, erro: mensagemErroPrestacao({ message: e instanceof Error ? e.message : String(e) }, "Não foi possível carregar o checklist de envio") };
    }
  }, [prestacaoId, supabase]);

  const recarregar = useCallback(async () => {
    const lido = await buscar();
    setLidos({ prestacaoId, ...lido });
  }, [buscar, prestacaoId]);

  useEffect(() => {
    let ativo = true;
    buscar().then(lido => { if (ativo) setLidos({ prestacaoId, ...lido }); });
    const aoVerificar = (e: Event) => {
      if ((e as CustomEvent<{ prestacaoId: string }>).detail?.prestacaoId !== prestacaoId) return;
      buscar().then(lido => { if (ativo) setLidos({ prestacaoId, ...lido }); });
    };
    window.addEventListener(EVENTO_VERIFICADA, aoVerificar);
    return () => { ativo = false; window.removeEventListener(EVENTO_VERIFICADA, aoVerificar); };
  }, [buscar, prestacaoId]);

  const atual = lidos?.prestacaoId === prestacaoId ? lidos : null;
  return { dados: atual?.dados ?? null, erro: atual?.erro ?? "", recarregar };
}
