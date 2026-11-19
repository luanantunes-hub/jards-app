"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { useOrganizationId, useOrganizationName, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { CadastroDaContaSheet, CartaoDaConta, type ContaCadastrada } from "@/components/ticketeria/ContaDeRecebimento";

/** Recebimentos: a conta que recebe o valor das vendas. Sem conta, convida a cadastrar; com conta, mostra a situação (confere no Asaas enquanto está em análise). */
export default function RecebimentosPage() {
  const organizationId = useOrganizationId();
  const nomeDaOrganizacao = useOrganizationName();
  const papel = useOrganizationRole();
  const podeEditar = podeEditarATicketeria(papel);
  const [estado, setEstado] = useState<{ lojaId: string | null; conta: ContaCadastrada | null } | undefined>(undefined);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const conferidaNestaVersao = useRef(-1);
  const recarregar = () => setVersao(atual => atual + 1);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const { data: loja, error } = await ticketeria.from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      const { data: conta, error: erroDaConta } = loja
        ? await ticketeria.from("ticketeria_contas_asaas").select("situacao, cpf_cnpj, banco_codigo, agencia, conta, conta_digito").eq("loja_id", loja.id).maybeSingle()
        : { data: null, error: null };
      if (!ativo) return;
      setEstado({ lojaId: loja?.id ?? null, conta: (conta ?? null) as ContaCadastrada | null });
      setErro(error || erroDaConta ? "Não foi possível carregar os recebimentos. Recarregue a página." : null);
      // Em análise: confere a situação no Asaas, uma vez por carga, e recarrega se ela mudou.
      if (loja && conta && conta.situacao === "pendente" && conferidaNestaVersao.current !== versao) {
        conferidaNestaVersao.current = versao;
        try {
          const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/conta-asaas`);
          const dados = (await resposta.json().catch(() => ({}))) as { situacao?: string };
          if (ativo && resposta.ok && dados.situacao && dados.situacao !== conta.situacao) recarregar();
        } catch { /* fica como está: se confere na próxima visita */ }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;

  return (
    <>
      <ListPageHeader
        eyebrow="Ticketeria"
        title="Recebimentos"
        actions={podeEditar && !estado.conta ? <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Cadastrar conta</PrimaryListAction> : undefined}
      />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {estado.conta
          ? <CartaoDaConta conta={estado.conta} />
          : (
            <ListTableSurface>
              <ListEmptyState
                icon={Wallet}
                title="Receba o valor das suas vendas"
                description="Cadastre a conta do titular para vender ingressos. O repasse é liberado às 18h do dia seguinte ao evento."
              />
            </ListTableSurface>
          )}
      </ListContent>
      {folha && <CadastroDaContaSheet organizationId={organizationId} nomeDaOrganizacao={nomeDaOrganizacao} onClose={() => setFolha(false)} onSaved={() => { setFolha(false); recarregar(); }} />}
    </>
  );
}
