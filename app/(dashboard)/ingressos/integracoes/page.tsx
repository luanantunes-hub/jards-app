"use client";

import { useEffect, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { CartaoDaChave, CartaoDoCodigo, GirarChaveSheet, type ChaveDaLoja } from "@/components/ticketeria/IntegracoesView";
import { Plug } from "lucide-react";

/** Integrações: a chave pública da loja e o código do widget para colar no site (WordPress, Wix, Webflow...). Lê e muda pela rota do servidor, que confere quem edita a Ticketeria. */
export default function IntegracoesPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = podeEditarATicketeria(papel);
  const [estado, setEstado] = useState<{ lojaId: string | null; chave: ChaveDaLoja | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [girando, setGirando] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar as integrações. Recarregue a página."); setEstado({ lojaId: null, chave: null }); return; }
      if (!loja) { setEstado({ lojaId: null, chave: null }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/integracao`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const chave = (await resposta.json()) as ChaveDaLoja;
        if (ativo) { setErro(null); setEstado({ lojaId: loja.id, chave }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar as integrações. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, chave: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  /** Muda a chave pela rota; devolve a frase de erro, ou nulo se deu certo. */
  async function mudar(acao: "ligar" | "desligar" | "girar"): Promise<string | null> {
    if (!estado?.lojaId) return "Não foi possível mudar a chave. Tente de novo.";
    try {
      const resposta = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/integracao`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) });
      if (!resposta.ok) return "Não foi possível mudar a chave. Tente de novo.";
      const chave = (await resposta.json()) as ChaveDaLoja;
      setEstado({ lojaId: estado.lojaId, chave });
      return null;
    } catch {
      return "Sem conexão. Tente de novo.";
    }
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;

  return (
    <>
      <ListPageHeader title="Integrações" />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {estado.chave ? (
          <>
            <CartaoDaChave
              chave={estado.chave}
              podeEditar={podeEditar}
              trabalhando={trabalhando}
              onLigar={ligada => { setTrabalhando(true); void mudar(ligada ? "ligar" : "desligar").then(falha => { setTrabalhando(false); setErro(falha); }); }}
              onGirar={() => setGirando(true)}
            />
            <CartaoDoCodigo chave={estado.chave.chave} origem={typeof window === "undefined" ? "" : window.location.origin} />
          </>
        ) : !erro && (
          <ListTableSurface><ListEmptyState icon={Plug} title="Crie a loja da Ticketeria para ligar o seu site" /></ListTableSurface>
        )}
      </ListContent>
      {girando && <GirarChaveSheet onClose={() => setGirando(false)} onGirar={() => mudar("girar")} />}
    </>
  );
}
