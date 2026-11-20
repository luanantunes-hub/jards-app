"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { AcaoSheet, AcoesDaLoja, DivulgacaoDaLoja, LinkDeDivulgacaoSheet } from "@/components/ticketeria/DivulgacaoView";
import { gastoParaCampo, lerAcao, type CamposDaAcao, type DivulgacaoDaLoja as DadosDaDivulgacao } from "@/lib/ticketeria/divulgacao";

type Aba = "origem" | "acoes";
const ABAS: { valor: Aba; rotulo: string }[] = [{ valor: "origem", rotulo: "De onde vieram" }, { valor: "acoes", rotulo: "Ações e gasto" }];

/** Divulgação: de onde vieram as vendas, o link de divulgação de cada sessão e as ações (com gasto) cruzadas com as vendas por dia. Lê da rota do servidor, que confere quem edita a Ticketeria. */
export default function DivulgacaoPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ lojaId: string | null; dados: DadosDaDivulgacao | null } | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("origem");
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [versao, setVersao] = useState(0);
  // A folha de ação: `null` fechada; `{ id: null }` registrando; `{ id }` editando.
  const [acao, setAcao] = useState<{ id: string | null; valores: CamposDaAcao } | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar a divulgação. Recarregue a página."); setEstado({ lojaId: null, dados: null }); return; }
      if (!loja) { setEstado({ lojaId: null, dados: { linhas: [], sessoes: [], acoes: [], por_dia: {}, hoje: new Date().toISOString().slice(0, 10) } }); return; }
      try {
        const resposta = await fetch(`/api/ticketeria/lojas/${loja.id}/divulgacao`, { cache: "no-store" });
        if (!resposta.ok) throw new Error(String(resposta.status));
        const dados = (await resposta.json()) as DadosDaDivulgacao;
        if (ativo) { setErro(null); setEstado({ lojaId: loja.id, dados }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar a divulgação. Só quem edita a Ticketeria vê esta página."); setEstado({ lojaId: loja.id, dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const abrirNova = useCallback((hoje: string) => { setAcaoErro(null); setAcao({ id: null, valores: { nome: "", canal: "instagram", inicio: hoje, fim: hoje, gasto: "" } }); }, []);

  async function salvar() {
    if (!acao || !estado?.lojaId || !organizationId) return;
    const lida = lerAcao(acao.valores);
    if (!lida.ok) { setAcaoErro(lida.erro); return; }
    setSalvando(true);
    setAcaoErro(null);
    const t = clienteDaTicketeria(createClient());
    const { error } = acao.id
      ? await t.from("ticketeria_acoes_divulgacao").update(lida.valor).eq("id", acao.id)
      : await t.from("ticketeria_acoes_divulgacao").insert({ ...lida.valor, organization_id: organizationId, loja_id: estado.lojaId });
    setSalvando(false);
    if (error) { setAcaoErro("Não foi possível salvar a ação. Tente de novo."); return; }
    setAcao(null);
    setVersao(v => v + 1);
  }

  async function apagar() {
    if (!acao?.id) return;
    setSalvando(true);
    setAcaoErro(null);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_acoes_divulgacao").delete().eq("id", acao.id);
    setSalvando(false);
    if (error) { setAcaoErro("Não foi possível apagar a ação. Tente de novo."); return; }
    setAcao(null);
    setVersao(v => v + 1);
  }

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  const dados = estado.dados;
  const acoes = (
    <>
      {dados && aba === "acoes" && <SecondaryListAction onClick={() => abrirNova(dados.hoje)}>Registrar ação</SecondaryListAction>}
      {dados && <PrimaryListAction onClick={() => setCriando(true)}><Link2 size={13} aria-hidden="true" /> Criar link de divulgação</PrimaryListAction>}
    </>
  );
  return (
    <>
      <ListPageHeader title="Divulgação" actions={dados ? acoes : undefined} />
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados && (
          <div className="space-y-4">
            <div className="flex gap-2" role="group" aria-label="O que ver">
              {ABAS.map(a => (
                <button key={a.valor} type="button" onClick={() => setAba(a.valor)} aria-pressed={aba === a.valor}
                  className={`rounded-xl border px-3.5 py-1.5 text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${aba === a.valor ? "border-[#7259B5] bg-[#F5F2FB] font-normal text-[#1C0E33]" : "bg-white text-black/60 hover:bg-black/[.03]"}`}
                  style={aba === a.valor ? undefined : { borderColor: "rgba(13,13,13,.08)" }}>{a.rotulo}</button>
              ))}
            </div>
            {aba === "origem"
              ? <DivulgacaoDaLoja linhas={dados.linhas} sessoes={dados.sessoes} sessaoId={sessaoId} onSessao={setSessaoId} onCriarLink={() => setCriando(true)} />
              : <AcoesDaLoja acoes={dados.acoes} por_dia={dados.por_dia} hoje={dados.hoje} onRegistrar={() => abrirNova(dados.hoje)}
                  onAbrir={id => { const a = dados.acoes.find(x => x.id === id); if (a) { setAcaoErro(null); setAcao({ id, valores: { nome: a.nome, canal: a.canal, inicio: a.inicio, fim: a.fim, gasto: gastoParaCampo(a.gasto_centavos) } }); } }} />}
          </div>
        )}
      </ListContent>
      {criando && dados && <LinkDeDivulgacaoSheet sessoes={dados.sessoes} origem={window.location.origin} sessaoInicial={sessaoId} onClose={() => setCriando(false)} />}
      {acao && <AcaoSheet editando={acao.id !== null} valores={acao.valores} erro={acaoErro} salvando={salvando} onMudar={(campo, valor) => setAcao(a => (a ? { ...a, valores: { ...a.valores, [campo]: valor } } : a))} onClose={() => setAcao(null)} onSalvar={() => void salvar()} onApagar={() => void apagar()} />}
    </>
  );
}
