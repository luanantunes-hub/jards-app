"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { descontoEmTexto, lerCupom, mensagemDoErroDeGravarCupom, situacaoDoCupom, validadeEmTexto, validadeParaCampo, valorParaCampo } from "@/lib/ticketeria/cupom";
import type { TipoDoCupom } from "@/lib/ticketeria/estados";
import { ListContent, ListPageHeader, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { CupomSheet, CuponsDaLoja, type CupomDaLista, type FormularioDoCupom } from "@/components/ticketeria/CuponsView";

type Cupom = { id: string; evento_id: string; ingresso_id: string | null; codigo: string; tipo: TipoDoCupom; valor: number; limite_usos: number | null; valido_ate: string | null; ativo: boolean };
type Evento = { id: string; titulo: string };
type Ingresso = { id: string; evento_id: string; nome: string };
type Folha = { editando: string | null };

const VAZIO = (evento: string): FormularioDoCupom => ({ codigo: "", tipo: "percentual", valor: "", evento, ingresso: "", limite: "", ate: "", ativo: true });

/** Os cupons de desconto da loja: o código que o comprador digita, o desconto, a que vale, quantas vezes foi usado e até quando. */
export default function CuponsPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = podeEditarATicketeria(papel);
  const [dados, setDados] = useState<{ cupons: Cupom[]; eventos: Evento[]; ingressos: Ingresso[]; usos: Record<string, number> } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [valores, setValores] = useState<FormularioDoCupom>(VAZIO(""));
  const [erroDaFolha, setErroDaFolha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const t = clienteDaTicketeria(createClient());
      const [cu, ev, ig, pe] = await Promise.all([
        t.from("ticketeria_cupons").select("id, evento_id, ingresso_id, codigo, tipo, valor, limite_usos, valido_ate, ativo").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        t.from("ticketeria_eventos").select("id, titulo").eq("organization_id", organizationId).neq("situacao", "cancelado").order("titulo"),
        t.from("ticketeria_ingressos").select("id, evento_id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("ordem"),
        t.from("ticketeria_pedidos").select("cupom_id, situacao, reservado_ate").eq("organization_id", organizationId).not("cupom_id", "is", null),
      ]);
      if (!ativo) return;
      const agora = Date.now();
      const usos: Record<string, number> = {};
      for (const p of pe.data ?? []) if (p.cupom_id && (p.situacao === "pago" || (p.situacao === "aguardando_pagamento" && Date.parse(p.reservado_ate) > agora))) usos[p.cupom_id] = (usos[p.cupom_id] ?? 0) + 1;
      setDados({ cupons: (cu.data ?? []) as Cupom[], eventos: (ev.data ?? []) as Evento[], ingressos: (ig.data ?? []) as Ingresso[], usos });
      setErro(cu.error || ev.error || ig.error || pe.error ? "Não foi possível carregar os cupons. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const lista = useMemo<CupomDaLista[]>(() => (dados?.cupons ?? []).map(c => {
    const evento = dados?.eventos.find(e => e.id === c.evento_id)?.titulo ?? "Evento";
    const ingresso = c.ingresso_id ? dados?.ingressos.find(i => i.id === c.ingresso_id)?.nome ?? "um ingresso" : "todos os ingressos";
    const usos = dados?.usos[c.id] ?? 0;
    return { id: c.id, codigo: c.codigo, desconto: descontoEmTexto(c.tipo, c.valor), alcance: `${evento} · ${ingresso}`, usos, limite: c.limite_usos, validade: validadeEmTexto(c.valido_ate), situacao: situacaoDoCupom({ ativo: c.ativo, valido_ate: c.valido_ate, limite_usos: c.limite_usos, usos }) };
  }), [dados]);

  const eventos = (dados?.eventos ?? []).map(e => ({ value: e.id, label: e.titulo }));
  const ingressos = (dados?.ingressos ?? []).filter(i => i.evento_id === valores.evento).map(i => ({ value: i.id, label: i.nome }));

  function abrirNovo() {
    setValores(VAZIO(dados?.eventos[0]?.id ?? ""));
    setErroDaFolha(null);
    setFolha({ editando: null });
  }
  function abrirEdicao(id: string) {
    const c = dados?.cupons.find(x => x.id === id);
    if (!c) return;
    setValores({ codigo: c.codigo, tipo: c.tipo, valor: valorParaCampo(c.tipo, c.valor), evento: c.evento_id, ingresso: c.ingresso_id ?? "", limite: c.limite_usos === null ? "" : String(c.limite_usos), ate: validadeParaCampo(c.valido_ate), ativo: c.ativo });
    setErroDaFolha(null);
    setFolha({ editando: id });
  }
  function fechar() { setFolha(null); setErroDaFolha(null); }

  async function salvar() {
    if (!organizationId || !folha) return;
    const leitura = lerCupom(valores);
    if (!leitura.ok) { setErroDaFolha(leitura.erro); return; }
    if (!valores.evento) { setErroDaFolha("Escolha o evento do cupom."); return; }
    setSalvando(true);
    setErroDaFolha(null);
    const t = clienteDaTicketeria(createClient());
    const v = leitura.valor;
    const ingresso_id = valores.ingresso || null;
    const { error } = folha.editando
      ? await t.from("ticketeria_cupons").update({ tipo: v.tipo, valor: v.valor, ingresso_id, limite_usos: v.limite_usos, valido_ate: v.valido_ate }).eq("id", folha.editando)
      : await t.from("ticketeria_cupons").insert({ organization_id: organizationId, evento_id: valores.evento, ingresso_id, codigo: v.codigo, tipo: v.tipo, valor: v.valor, limite_usos: v.limite_usos, valido_ate: v.valido_ate });
    setSalvando(false);
    if (error) { setErroDaFolha(mensagemDoErroDeGravarCupom(error)); return; }
    fechar();
    setVersao(n => n + 1);
  }

  async function alternar() {
    if (!folha?.editando) return;
    setSalvando(true);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_cupons").update({ ativo: !valores.ativo }).eq("id", folha.editando);
    setSalvando(false);
    if (error) { setErroDaFolha(mensagemDoErroDeGravarCupom(error)); return; }
    fechar();
    setVersao(n => n + 1);
  }

  const semEvento = dados !== null && dados.eventos.length === 0;
  const novo = podeEditar && !semEvento ? <PrimaryListAction onClick={abrirNovo}><Plus size={13} aria-hidden="true" /> Novo cupom</PrimaryListAction> : undefined;

  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Cupons" actions={novo} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : semEvento ? (
          <p className="rounded border bg-white px-4 py-10 text-center text-[0.8125rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>Crie um evento primeiro: o cupom vale para os ingressos de um evento.</p>
        ) : (
          <CuponsDaLoja cupons={lista} onEditar={podeEditar ? abrirEdicao : undefined} />
        )}
      </ListContent>
      {folha && <CupomSheet editando={folha.editando !== null} valores={valores} eventos={eventos} ingressos={ingressos} erro={erroDaFolha} salvando={salvando}
        onMudar={(campo, valor) => setValores(v => ({ ...v, [campo]: valor, ...(campo === "evento" ? { ingresso: "" } : {}) }))} onClose={fechar} onSalvar={() => void salvar()} onDesativar={() => void alternar()} />}
    </>
  );
}
