"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Receipt } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { DetalheDaCompraSheet, VendasView, type FiltroDasCompras } from "@/components/ticketeria/VendasView";
import type { VendasDaLoja } from "@/lib/ticketeria/vendas";

type Compras = VendasDaLoja["compras"];
type Pagina = { compras: Compras; ha_mais: boolean };

/**
 * As vendas da loja (passo C3): o que entrou, o que já pode sacar, as sessões e as compras. Lê da rota do servidor, que confere quem edita a Ticketeria.
 * O resumo e as sessões vêm somados do banco; a lista de compras vem de 50 em 50 ("Ver mais compras"), com o filtro aplicado no banco.
 */
export default function VendasPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ lojaId: string | null; vendas: VendasDaLoja | null } | undefined>(undefined);
  const [lista, setLista] = useState<Pagina>({ compras: [], ha_mais: false });
  const [paginasLidas, setPaginasLidas] = useState(1);
  const [buscando, setBuscando] = useState(false);
  const [avulsa, setAvulsa] = useState<Compras[number] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDasCompras>("todas");
  const [aberta, setAberta] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [tentando, setTentando] = useState<string | null>(null);
  const abriuDaBusca = useRef(false);

  /** Uma página da lista (do banco, com o filtro). Devolve null se a leitura falhar. */
  const buscarPagina = useCallback(async (lojaId: string, pagina: number, filtroDaLista: FiltroDasCompras, id?: string): Promise<Pagina | null> => {
    try {
      const busca = new URLSearchParams(id ? { id } : { pagina: String(pagina), filtro: filtroDaLista });
      const resposta = await fetch(`/api/ticketeria/lojas/${lojaId}/vendas/compras?${busca}`, { cache: "no-store" });
      if (!resposta.ok) return null;
      return (await resposta.json()) as Pagina;
    } catch {
      return null;
    }
  }, []);

  // A busca do topo leva a ?compra=<id>: abre a compra uma vez. Se ela não está na primeira página, lê só essa compra.
  useEffect(() => {
    if (abriuDaBusca.current || !estado?.vendas || !estado.lojaId) return;
    abriuDaBusca.current = true;
    const id = new URLSearchParams(window.location.search).get("compra");
    if (!id) return;
    if (lista.compras.some(c => c.id === id)) { queueMicrotask(() => setAberta(id)); return; }
    const lojaId = estado.lojaId;
    void buscarPagina(lojaId, 0, "todas", id).then(achada => { if (achada?.compras[0]) { setAvulsa(achada.compras[0]); setAberta(id); } });
  }, [estado, lista, buscarPagina]);

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
        const vendas = (await resposta.json()) as VendasDaLoja & { ha_mais?: boolean };
        if (ativo) { setErro(null); setLista({ compras: vendas.compras, ha_mais: Boolean(vendas.ha_mais) }); setPaginasLidas(1); setFiltro("todas"); setEstado({ lojaId: loja.id, vendas }); }
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

  /** Trocar o filtro lê a primeira página dele no banco (as compras do filtro, não só as já carregadas). */
  async function filtrar(novo: FiltroDasCompras) {
    if (!estado?.lojaId || novo === filtro) return;
    setFiltro(novo);
    setBuscando(true);
    const pagina = await buscarPagina(estado.lojaId, 0, novo);
    if (pagina) { setLista(pagina); setPaginasLidas(1); setErro(null); } else setErro("Não foi possível carregar as compras. Tente de novo.");
    setBuscando(false);
  }

  async function verMais() {
    if (!estado?.lojaId || buscando) return;
    setBuscando(true);
    const pagina = await buscarPagina(estado.lojaId, paginasLidas, filtro);
    if (pagina) { setLista(atual => ({ compras: [...atual.compras, ...pagina.compras.filter(nova => !atual.compras.some(c => c.id === nova.id))], ha_mais: pagina.ha_mais })); setPaginasLidas(n => n + 1); setErro(null); } else setErro("Não foi possível carregar mais compras. Tente de novo.");
    setBuscando(false);
  }

  const compra = aberta ? lista.compras.find(c => c.id === aberta) ?? (avulsa?.id === aberta ? avulsa : undefined) : undefined;

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader title="Pedidos" />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {estado.vendas ? (
          <VendasView resumo={estado.vendas.resumo} sessoes={estado.vendas.sessoes} compras={lista.compras} filtro={filtro} onFiltrar={f => void filtrar(f)} haMais={lista.ha_mais} onVerMais={() => void verMais()} carregando={buscando} onAbrir={setAberta} reembolsos={estado.vendas.reembolsos} onTentarDeNovo={id => void tentarDeNovo(id)} tentando={tentando} />
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
