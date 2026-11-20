"use client";

import { useEffect, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { CartaoDaChave, CartaoDoCodigo, GirarChaveSheet, type ChaveDaLoja } from "@/components/ticketeria/IntegracoesView";
import { AvisosSheet, CartaoDosWebhooks, WebhookSheet } from "@/components/ticketeria/WebhooksView";
import { lerWebhooks, type WebhookDaLista } from "@/lib/ticketeria/webhooks-tela";
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
  const [webhooks, setWebhooks] = useState<WebhookDaLista[]>([]);
  const [versao, setVersao] = useState(0);
  // A folha dos webhooks: `novo`, `editar` (com o endereço) ou `avisos` (com o endereço).
  const [folhaDosWebhooks, setFolhaDosWebhooks] = useState<{ tipo: "novo" } | { tipo: "editar" | "avisos"; id: string } | null>(null);
  const [avisoDoTeste, setAvisoDoTeste] = useState<string | null>(null);

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
        const lista = await fetch(`/api/ticketeria/lojas/${loja.id}/webhooks`, { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
        if (ativo) { setErro(null); setWebhooks(lerWebhooks(lista)); setEstado({ lojaId: loja.id, chave }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar as integrações. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, chave: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

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

  /** Põe um aviso de teste na fila do endereço (sai na próxima rodada, em até um minuto). */
  async function testar(webhook: string) {
    if (!estado?.lojaId) return;
    setAvisoDoTeste(null);
    try {
      const resposta = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/webhooks/${webhook}/teste`, { method: "POST" });
      setAvisoDoTeste(resposta.ok ? "Aviso de teste na fila: sai em até um minuto. Veja o resultado em Últimos avisos." : "Não foi possível pedir o teste. Tente de novo.");
    } catch {
      setAvisoDoTeste("Sem conexão. Tente de novo.");
    }
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  const doWebhook = folhaDosWebhooks && folhaDosWebhooks.tipo !== "novo" ? webhooks.find(w => w.id === folhaDosWebhooks.id) ?? null : null;

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
            <CartaoDosWebhooks
              webhooks={webhooks}
              podeEditar={podeEditar}
              aviso={avisoDoTeste}
              onNovo={() => setFolhaDosWebhooks({ tipo: "novo" })}
              onEditar={id => setFolhaDosWebhooks({ tipo: "editar", id })}
              onAvisos={id => setFolhaDosWebhooks({ tipo: "avisos", id })}
              onTestar={id => void testar(id)}
            />
          </>
        ) : !erro && (
          <ListTableSurface><ListEmptyState icon={Plug} title="Crie a loja da Ticketeria para ligar o seu site" /></ListTableSurface>
        )}
      </ListContent>
      {folhaDosWebhooks?.tipo === "novo" && estado.lojaId && <WebhookSheet lojaId={estado.lojaId} webhook={null} onClose={() => setFolhaDosWebhooks(null)} onSaved={() => setVersao(v => v + 1)} />}
      {folhaDosWebhooks?.tipo === "editar" && doWebhook && estado.lojaId && <WebhookSheet key={doWebhook.id} lojaId={estado.lojaId} webhook={doWebhook} onClose={() => setFolhaDosWebhooks(null)} onSaved={() => setVersao(v => v + 1)} />}
      {folhaDosWebhooks?.tipo === "avisos" && doWebhook && estado.lojaId && <AvisosSheet lojaId={estado.lojaId} webhook={doWebhook} onClose={() => setFolhaDosWebhooks(null)} />}
      {girando && <GirarChaveSheet onClose={() => setGirando(false)} onGirar={() => mudar("girar")} />}
    </>
  );
}
