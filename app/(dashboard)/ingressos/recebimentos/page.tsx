"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { useOrganizationId, useOrganizationName, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { CadastroDaContaSheet, CartaoDaConta, TrocaDaContaSheet, type ContaCadastrada } from "@/components/ticketeria/ContaDeRecebimento";
import type { EstadoDaTroca } from "@/lib/ticketeria/pagamento/troca-de-conta-textos";

type TrocaAberta = EstadoDaTroca & { minha?: boolean };

/** Recebimentos: a conta que recebe o valor das vendas. Sem conta, convida a cadastrar; com conta, mostra a situação (confere no Asaas enquanto está em análise). */
export default function RecebimentosPage() {
  const organizationId = useOrganizationId();
  const nomeDaOrganizacao = useOrganizationName();
  const papel = useOrganizationRole();
  const podeEditar = podeEditarATicketeria(papel);
  const [estado, setEstado] = useState<{ lojaId: string | null; conta: ContaCadastrada | null } | undefined>(undefined);
  const [folha, setFolha] = useState(false);
  const [troca, setTroca] = useState<TrocaAberta | null>(null);
  const [folhaDaTroca, setFolhaDaTroca] = useState<{ retomar: boolean } | null>(null);
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
      // Conta ativa: a troca da conta de saques que estiver aberta (a que passou das 24 horas é aplicada pelo servidor antes de responder).
      if (loja && conta && conta.situacao === "aprovada") {
        try {
          const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/troca-de-conta`);
          const dados = (await resposta.json().catch(() => ({}))) as { troca?: TrocaAberta | null };
          if (ativo && resposta.ok) setTroca(dados.troca ?? null);
        } catch { /* sem a troca na tela: a próxima visita mostra */ }
      } else if (ativo) setTroca(null);
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

  async function cancelarTroca() {
    if (!estado?.lojaId) return;
    try {
      const resposta = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/troca-de-conta`, { method: "DELETE" });
      if (!resposta.ok) throw new Error();
      setErro(null);
    } catch {
      setErro("Não foi possível cancelar a troca. Tente de novo.");
    }
    recarregar();
  }

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
          ? <CartaoDaConta conta={estado.conta} troca={troca} podeEditar={podeEditar} onAlterar={() => setFolhaDaTroca({ retomar: Boolean(troca && !troca.confirmada && troca.minha) })} onCancelarTroca={() => void cancelarTroca()} />
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
      {folhaDaTroca && estado.lojaId && <TrocaDaContaSheet lojaId={estado.lojaId} retomar={folhaDaTroca.retomar} onClose={() => setFolhaDaTroca(null)} onDone={() => { setFolhaDaTroca(null); recarregar(); }} />}
      {folha && <CadastroDaContaSheet organizationId={organizationId} nomeDaOrganizacao={nomeDaOrganizacao} onClose={() => setFolha(false)} onSaved={() => { setFolha(false); recarregar(); }} />}
    </>
  );
}
