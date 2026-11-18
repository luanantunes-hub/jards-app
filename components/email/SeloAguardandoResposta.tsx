"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EtiquetaDeSituacao } from "@/components/email/EtiquetaDeConversa";
import {
  agruparConversas,
  aguardandoResposta,
  COLUNAS_DO_EMAIL_DE_CONVERSA,
  JANELA_AGUARDANDO_DIAS,
  type EmailDeConversa,
  type SituacaoDaConversa,
} from "@/lib/email/conversas";

/**
 * "Aguardando resposta · 4 dias" no topo da negociação, junto das outras etiquetas: aparece quando a equipe
 * escreveu por último e o contato ainda não respondeu. Se mais de uma conversa espera, vale a que espera há mais tempo.
 * Sem e-mails sincronizados (ou sem ninguém aguardando), não aparece nada. Traz o próprio separador "·".
 */
export function SeloAguardandoResposta({ captacaoId }: { captacaoId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [situacao, setSituacao] = useState<SituacaoDaConversa | null>(null);

  useEffect(() => {
    let ativo = true;
    const desde = new Date(Date.now() - (JANELA_AGUARDANDO_DIAS + 1) * 86_400_000).toISOString();
    void (supabase as any)
      .from("emails")
      .select(COLUNAS_DO_EMAIL_DE_CONVERSA)
      .eq("captacao_id", captacaoId)
      .gte("sent_at", desde)
      .order("sent_at", { ascending: false })
      .limit(200)
      .then(({ data, error }: { data: EmailDeConversa[] | null; error: unknown }) => {
        if (!ativo || error) return;
        setSituacao(aguardandoResposta(agruparConversas(data ?? []))[0]?.situacao ?? null);
      });
    return () => { ativo = false; };
  }, [captacaoId, supabase]);

  if (!situacao) return null;
  return (
    <>
      <span className="text-black/20">·</span>
      <EtiquetaDeSituacao situacao={situacao} />
    </>
  );
}
