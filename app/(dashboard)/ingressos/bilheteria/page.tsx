"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { podeEditarATicketeria } from "@/lib/ticketeria/permissoes";
import { ENTRADA_DA_BILHETERIA, lerListaDeBilheteiros, lerNovoBilheteiro, mensagemDoErroDoCadastro, type BilheteiroParaLista } from "@/lib/ticketeria/bilheteria";
import { ListContent, ListPageHeader, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { BilheteiroSheet, BilheteirosDaLoja, EnderecoDaBilheteria, type FormularioDoBilheteiro } from "@/components/ticketeria/BilheteirosView";

type Folha = { editando: string | null };
const VAZIO: FormularioDoBilheteiro = { nome: "", email: "" };

/** A bilheteria da loja: quem vende ingressos na porta. Lê e grava pelas rotas do servidor, que conferem quem edita a Ticketeria. */
export default function BilheteriaPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const podeEditar = podeEditarATicketeria(papel);
  const [lojaId, setLojaId] = useState<string | null | undefined>(undefined);
  const [lista, setLista] = useState<BilheteiroParaLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [valores, setValores] = useState<FormularioDoBilheteiro>(VAZIO);
  const [erroDaFolha, setErroDaFolha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [origem, setOrigem] = useState("");

  useEffect(() => { queueMicrotask(() => setOrigem(window.location.origin)); }, []);

  const carregar = useCallback(async (loja: string) => {
    try {
      const r = await fetch(`/api/ticketeria/lojas/${loja}/bilheteiros`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setLista(lerListaDeBilheteiros(await r.json()));
      setErro(null);
    } catch {
      setLista([]);
      setErro("Não foi possível carregar a bilheteria. Só quem edita a Ticketeria vê esta página.");
    }
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar a bilheteria. Recarregue a página."); setLista([]); return; }
      if (!loja) { setLojaId(null); setLista([]); return; }
      setLojaId(loja.id);
      await carregar(loja.id);
    })();
    return () => { ativo = false; };
  }, [organizationId, carregar]);

  function abrirNovo() { setValores(VAZIO); setErroDaFolha(null); setFolha({ editando: null }); }
  function abrirEdicao(id: string) {
    const b = lista?.find(x => x.id === id);
    if (!b) return;
    setValores({ nome: b.nome, email: b.email ?? "" });
    setErroDaFolha(null);
    setFolha({ editando: id });
  }
  function fechar() { setFolha(null); setErroDaFolha(null); }

  async function chamar(metodo: "POST" | "PATCH", endereco: string, corpo: object): Promise<boolean> {
    setSalvando(true);
    setErroDaFolha(null);
    try {
      const r = await fetch(endereco, { method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string; mensagem?: string };
        setErroDaFolha(d.mensagem ?? mensagemDoErroDoCadastro(d.error));
        return false;
      }
      return true;
    } catch {
      setErroDaFolha("Sem conexão. Tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!lojaId || !folha) return;
    if (folha.editando) {
      const nome = valores.nome.trim();
      if (nome === "") { setErroDaFolha("Escreva o nome de quem vai vender."); return; }
      if (!(await chamar("PATCH", `/api/ticketeria/lojas/${lojaId}/bilheteiros/${folha.editando}`, { nome }))) return;
    } else {
      const leitura = lerNovoBilheteiro(valores);
      if (!leitura.ok) { setErroDaFolha(leitura.erro); return; }
      if (!(await chamar("POST", `/api/ticketeria/lojas/${lojaId}/bilheteiros`, leitura.valor))) return;
    }
    fechar();
    await carregar(lojaId);
  }

  async function alternar() {
    if (!lojaId || !folha?.editando) return;
    const atual = lista?.find(x => x.id === folha.editando);
    if (!atual) return;
    if (!(await chamar("PATCH", `/api/ticketeria/lojas/${lojaId}/bilheteiros/${folha.editando}`, { ativo: !atual.ativo }))) return;
    fechar();
    await carregar(lojaId);
  }

  const novo = podeEditar && lojaId ? <PrimaryListAction onClick={abrirNovo}><Plus size={13} aria-hidden="true" /> Nova bilheteira</PrimaryListAction> : undefined;
  const aberta = folha?.editando ? lista?.find(x => x.id === folha.editando) : undefined;

  return (
    <>
      <ListPageHeader title="Bilheteria" actions={novo} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {lista === null ? (
          <div className="h-32 rounded-xl border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : lojaId === null ? (
          <p className="rounded-xl border bg-white px-4 py-10 text-center text-[0.8125rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>Crie um evento primeiro: a bilheteria vende os ingressos dele.</p>
        ) : (
          <>
            {origem && <EnderecoDaBilheteria endereco={`${origem}${ENTRADA_DA_BILHETERIA}`} />}
            <BilheteirosDaLoja bilheteiros={lista} onEditar={podeEditar ? abrirEdicao : undefined} />
          </>
        )}
      </ListContent>
      {folha && <BilheteiroSheet editando={folha.editando !== null} valores={valores} ativo={aberta?.ativo} erro={erroDaFolha} salvando={salvando}
        onMudar={(campo, valor) => setValores(v => ({ ...v, [campo]: valor }))} onClose={fechar} onSalvar={() => void salvar()} onAlternar={() => void alternar()} />}
    </>
  );
}
