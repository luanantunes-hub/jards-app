"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { opcoesDeAviso, quantasAvisarPorPadrao, type EsperaDaLoja } from "@/lib/ticketeria/espera";
import { ListContent, ListPageHeader } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { AvisarSheet, EsperaDaLoja as EsperaView } from "@/components/ticketeria/ListaDeEsperaView";

type Alvo = { sessao: string; ingresso: string };

/** A lista de espera da loja: quem espera cada ingresso esgotado, e o botão de avisar quando voltam lugares. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function EsperaPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = podeEditarATicketeria(papel);
  const [estado, setEstado] = useState<{ lojaId: string | null; espera: EsperaDaLoja | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [quantas, setQuantas] = useState("1");
  const [erroDaFolha, setErroDaFolha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar a lista de espera. Recarregue a página."); setEstado({ lojaId: null, espera: null }); return; }
      if (!loja) { setEstado({ lojaId: null, espera: { sessoes: [] } }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/espera`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const espera = (await resposta.json()) as EsperaDaLoja;
        if (ativo) { setErro(null); setEstado({ lojaId: loja.id, espera }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar a lista de espera. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, espera: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const sessao = alvo ? estado?.espera?.sessoes.find(s => s.id === alvo.sessao) : undefined;
  const ingresso = alvo ? sessao?.ingressos.find(i => i.id === alvo.ingresso) : undefined;
  const esperando = useMemo(() => (ingresso?.pessoas ?? []).filter(p => p.avisado_em === null), [ingresso]);

  function abrir(sessaoId: string, ingressoId: string) {
    const s = estado?.espera?.sessoes.find(x => x.id === sessaoId);
    const i = s?.ingressos.find(x => x.id === ingressoId);
    if (!i) return;
    setQuantas(String(quantasAvisarPorPadrao(i.pessoas.filter(p => p.avisado_em === null), i.livres)));
    setErroDaFolha(null);
    setAlvo({ sessao: sessaoId, ingresso: ingressoId });
  }

  async function enviar() {
    if (!alvo || !estado?.lojaId) return;
    setEnviando(true);
    setErroDaFolha(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${estado.lojaId}/espera/avisar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao_id: alvo.sessao, ingresso_id: alvo.ingresso, quantas: Number(quantas) }) });
      const d = (await r.json().catch(() => ({}))) as { avisadas?: number; falharam?: number; mensagem?: string };
      if (!r.ok) { setErroDaFolha(d.mensagem ?? (r.status === 429 ? "Muitas tentativas. Espere um instante." : "Não foi possível avisar agora. Tente de novo em instantes.")); return; }
      const ok = d.avisadas ?? 0;
      const falhas = d.falharam ?? 0;
      setResultado(falhas > 0 ? `${ok} ${ok === 1 ? "pessoa avisada" : "pessoas avisadas"}. ${falhas} ${falhas === 1 ? "e-mail não saiu" : "e-mails não saíram"}: ${falhas === 1 ? "essa pessoa continua" : "essas pessoas continuam"} na vez. Tente de novo.` : `${ok} ${ok === 1 ? "pessoa avisada" : "pessoas avisadas"} por e-mail.`);
      setAlvo(null);
      setVersao(n => n + 1);
    } catch {
      setErroDaFolha("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Lista de espera" />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {resultado && <p role="status" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{resultado}</p>}
        {estado.espera && <EsperaView sessoes={estado.espera.sessoes} onAvisar={podeEditar ? abrir : undefined} />}
      </ListContent>
      {alvo && sessao && ingresso && (
        <AvisarSheet ingresso={ingresso.nome} sessao={`${sessao.titulo} · ${sessao.quando}`} livres={ingresso.livres} opcoes={opcoesDeAviso(esperando)} quantas={quantas} erro={erroDaFolha} enviando={enviando}
          onQuantas={setQuantas} onClose={() => setAlvo(null)} onEnviar={() => void enviar()} />
      )}
    </>
  );
}
