"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PublicoDaLoja } from "@/components/ticketeria/PublicoView";
import { filtrarPublico, type FiltroDoPublico, type PublicoDaLoja as DadosDoPublico } from "@/lib/ticketeria/publico";

const VAZIO: DadosDoPublico = { contatos: [], resumo: { contatos: 0, aceitaram: 0, aceitaram_porcento: 0, com_whatsapp: 0 } };

/** Público: quem comprou ou entrou na lista de espera, com o aceite de novidades. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function PublicoPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ dados: DadosDoPublico | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDoPublico>("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar o público. Recarregue a página."); setEstado({ dados: null }); return; }
      if (!loja) { setEstado({ dados: VAZIO }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/publico`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const dados = (await resposta.json()) as DadosDoPublico;
        if (ativo) { setErro(null); setEstado({ dados }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar o público. Só quem edita a Ticketeria vê esta página."); setEstado({ dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const dados = estado?.dados ?? null;
  const contatos = useMemo(() => (dados ? filtrarPublico(dados.contatos, filtro, busca) : []), [dados, filtro, busca]);

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader title="Público" />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados && <PublicoDaLoja resumo={dados.resumo} contatos={contatos} filtro={filtro} busca={busca} onFiltrar={setFiltro} onBuscar={setBusca} />}
      </ListContent>
    </>
  );
}
