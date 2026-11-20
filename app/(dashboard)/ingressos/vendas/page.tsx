"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { DetalheDaCompraSheet, VendasView, type FiltroDasCompras } from "@/components/ticketeria/VendasView";
import type { VendasDaLoja } from "@/lib/ticketeria/vendas";

/** As vendas da loja (passo C3): o que entrou, o que já pode sacar, as sessões e as compras. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function VendasPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ lojaId: string | null; vendas: VendasDaLoja | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDasCompras>("todas");
  const [aberta, setAberta] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [tentando, setTentando] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar as vendas. Recarregue a página."); setEstado({ lojaId: null, vendas: null }); return; }
      if (!loja) { setEstado({ lojaId: null, vendas: null }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/vendas`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const vendas = (await resposta.json()) as VendasDaLoja;
        if (ativo) { setErro(null); setEstado({ lojaId: loja.id, vendas }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar as vendas. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, vendas: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  async function tentarDeNovo(id: string) {
    if (!estado?.lojaId) return;
    setTentando(id);
    setErro(null);
    try {
      const resposta = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/reembolsos/${id}/tentar-de-novo`, { method: "POST" });
      if (!resposta.ok) setErro(resposta.status === 409 ? "Este reembolso não pode mais ser tentado de novo." : resposta.status === 503 ? "O estorno ainda não está disponível. Fale com o suporte do Jards." : "Não foi possível tentar de novo. Tente mais tarde.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setTentando(null);
      setVersao(atual => atual + 1);
    }
  }

  const compras = useMemo(() => (estado?.vendas?.compras ?? []).filter(c => filtro === "todas" || (filtro === "pagas" ? c.situacao === "pago" : c.situacao === "aguardando_pagamento")), [estado, filtro]);
  const compra = aberta ? estado?.vendas?.compras.find(c => c.id === aberta) : undefined;

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader title="Vendas" />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {estado.vendas ? (
          <VendasView resumo={estado.vendas.resumo} sessoes={estado.vendas.sessoes} compras={compras} filtro={filtro} onFiltrar={setFiltro} onAbrir={setAberta} reembolsos={estado.vendas.reembolsos} onTentarDeNovo={id => void tentarDeNovo(id)} tentando={tentando} />
        ) : !erro && (
          <ListTableSurface>
            <ListEmptyState icon={Receipt} title="Nenhuma venda ainda" />
          </ListTableSurface>
        )}
      </ListContent>
      {compra && <DetalheDaCompraSheet compra={{ ...compra.detalhe, endereco_do_pedido: `${window.location.origin}/pedido/${compra.id}` }} onClose={() => setAberta(null)} />}
    </>
  );
}
