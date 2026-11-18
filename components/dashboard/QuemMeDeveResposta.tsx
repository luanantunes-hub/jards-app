"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import {
  agruparConversas,
  aguardandoResposta,
  COLUNAS_DO_EMAIL_DE_CONVERSA,
  JANELA_AGUARDANDO_DIAS,
  type EmailDeConversa,
} from "@/lib/email/conversas";

const MAXIMO_NA_LISTA = 5;

type Linha = { chave: string; dias: number; contato: string; detalhe: string; href: string | null };

function sem<T>(valor: T | null | undefined): valor is T {
  return valor !== null && valor !== undefined;
}

/**
 * Painel › "Quem me deve resposta": as conversas em que a pessoa escreveu por último e ninguém respondeu há pelo menos
 * um dia, a que espera há mais tempo primeiro. Só aparece para quem já tem e-mails sincronizados.
 */
export function QuemMeDeveResposta({ ordem }: { ordem: number }) {
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ linhas: Linha[]; total: number } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ativo) return;
      const desde = new Date(Date.now() - (JANELA_AGUARDANDO_DIAS + 1) * 86_400_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("emails")
        .select(COLUNAS_DO_EMAIL_DE_CONVERSA)
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .gte("sent_at", desde)
        .order("sent_at", { ascending: false })
        .limit(500);
      if (!ativo || error || !data?.length) return;

      const todas = aguardandoResposta(agruparConversas(data as EmailDeConversa[]), 1);
      const mostradas = todas.slice(0, MAXIMO_NA_LISTA);
      const contatoIds = [...new Set(mostradas.map((conversa) => conversa.contatoIds[0]).filter(sem))];
      const empresaIds = [...new Set(mostradas.map((conversa) => conversa.ultima.empresa_crm_id).filter(sem))];
      const [contatos, empresas] = await Promise.all([
        contatoIds.length ? (supabase as any).from("contatos").select("id, nome").in("id", contatoIds) : { data: [] },
        empresaIds.length ? (supabase as any).from("empresas_crm").select("id, nome").in("id", empresaIds) : { data: [] },
      ]);
      if (!ativo) return;
      const nomeDoContato = new Map<string, string>(((contatos.data ?? []) as Array<{ id: string; nome: string }>).map((contato) => [contato.id, contato.nome]));
      const nomeDaEmpresa = new Map<string, string>(((empresas.data ?? []) as Array<{ id: string; nome: string }>).map((empresa) => [empresa.id, empresa.nome]));

      setEstado({
        total: todas.length,
        linhas: mostradas.map((conversa) => {
          const empresaId = conversa.ultima.empresa_crm_id;
          const empresa = empresaId ? nomeDaEmpresa.get(empresaId) ?? null : null;
          return {
            chave: conversa.chave,
            dias: conversa.situacao?.dias ?? 0,
            contato: nomeDoContato.get(conversa.contatoIds[0] ?? "") ?? conversa.ultima.to_emails?.[0] ?? "Contato",
            detalhe: [empresa, conversa.assunto].filter(Boolean).join(" · "),
            href: conversa.ultima.captacao_id ? `/captacoes/${conversa.ultima.captacao_id}` : empresaId ? `/empresas-crm/${empresaId}` : null,
          };
        }),
      });
    })();
    return () => { ativo = false; };
  }, [organizationId, supabase]);

  if (!estado) return null;

  return (
    <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)", order: ordem }}>
      <div className="border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="mb-0.5 text-[0.625rem] font-bold uppercase tracking-[.09em] text-black/30">E-mail</p>
        <p className="text-[0.8125rem] font-semibold text-[#282525]">Quem me deve resposta</p>
      </div>
      {estado.linhas.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-black/25">Ninguém está devendo resposta</p>
      ) : (
        <div className="divide-y divide-black/[.06]">
          {estado.linhas.map((linha) => {
            const conteudo = (
              <>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded" style={{ background: "rgba(13,13,13,.04)" }}>
                  <Mail size={13} aria-hidden="true" style={{ color: "#B07A14" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.75rem] font-semibold text-[#282525]">{linha.contato}</p>
                  {linha.detalhe && <p className="mt-0.5 truncate text-[0.625rem] text-black/35">{linha.detalhe}</p>}
                </div>
                <span className="flex-shrink-0 text-[0.6875rem] font-semibold tabular-nums text-[#282525]">{linha.dias}d</span>
              </>
            );
            return linha.href ? (
              <Link key={linha.chave} href={linha.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-black/[0.015]">{conteudo}</Link>
            ) : (
              <div key={linha.chave} className="flex items-center gap-3 px-5 py-3">{conteudo}</div>
            );
          })}
        </div>
      )}
      {estado.total > estado.linhas.length && (
        <p className="border-t px-5 py-2.5 text-[0.625rem] text-black/35" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          e mais {estado.total - estado.linhas.length}
        </p>
      )}
    </div>
  );
}
