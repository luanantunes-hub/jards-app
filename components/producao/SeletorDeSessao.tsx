"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { faixaDaSessao, sessoesComSala, type PautaDaSessao, type SessaoDaGrade } from "@/lib/producao/programacao";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Dropdown } from "@/components/ui/Dropdown";

type Espaco = { id: string; nome: string };
type Sala = { id: string; nome: string };

/** Onde o navegador guarda o espaço e a sessão escolhidos, para as telas da sessão abrirem na mesma ao trocar de aba. Vale até fechar a aba do navegador. */
const CHAVE_DA_ESCOLHA = "producao-sessao-escolhida";
function escolhaGuardada(): { espacoId: string; sessaoId: string } {
  try {
    const lido = JSON.parse(window.sessionStorage.getItem(CHAVE_DA_ESCOLHA) ?? "{}") as { espacoId?: unknown; sessaoId?: unknown };
    return { espacoId: typeof lido.espacoId === "string" ? lido.espacoId : "", sessaoId: typeof lido.sessaoId === "string" ? lido.sessaoId : "" };
  } catch { return { espacoId: "", sessaoId: "" }; }
}

/** Quantas sessões (a partir de hoje) a lista oferece de uma vez. */
const LIMITE_DE_SESSOES = 80;

/**
 * Escolhe o espaço e a sessão (as de hoje em diante) e entrega a sessão escolhida a quem usa. Serve às páginas que trabalham por
 * sessão (plateia, convidados, acessibilidade, porta e borderô), e lembra a escolha de uma para a outra.
 */
export function SeletorDeSessao({ children }: { children: (sessao: { id: string; rotulo: string; organizationId: string }) => ReactNode }) {
  const organizationId = useOrganizationId();
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const [espacos, setEspacos] = useState<Espaco[] | null>(null);
  const [espacoId, setEspacoId] = useState(() => (typeof window === "undefined" ? "" : escolhaGuardada().espacoId));
  const [salas, setSalas] = useState<Sala[]>([]);
  const [pautas, setPautas] = useState<PautaDaSessao[]>([]);
  const [sessoesBrutas, setSessoesBrutas] = useState<SessaoDaGrade[] | null>(null);
  const [sessaoId, setSessaoId] = useState(() => (typeof window === "undefined" ? "" : escolhaGuardada().sessaoId));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome");
      if (!ativo) return;
      setEspacos((data ?? []) as Espaco[]);
      // O espaço lembrado só vale se ainda existir (pode ter sido arquivado ou ser de outra organização).
      setEspacoId(atual => ((data ?? []).some(espaco => espaco.id === atual) ? atual : data?.[0]?.id || ""));
      if (error) setErro("Não foi possível carregar os espaços. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!espacoId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const sal = await producao.from("producao_salas").select("id, nome").eq("espaco_id", espacoId).eq("arquivada", false).order("nome");
      const ids = (sal.data ?? []).map(sala => sala.id);
      const pau = ids.length > 0 ? await producao.from("producao_pautas").select("id, sala_id, titulo, inicio, fim, situacao").in("sala_id", ids).gte("fim", hoje) : { data: [], error: null };
      const pautaIds = (pau.data ?? []).map(pauta => pauta.id);
      const ses = pautaIds.length > 0
        ? await producao.from("producao_sessoes").select("id, pauta_id, dia, inicio, fim, titulo, notas").in("pauta_id", pautaIds).gte("dia", hoje).order("dia").order("inicio").limit(LIMITE_DE_SESSOES)
        : { data: [], error: null };
      if (!ativo) return;
      setSalas((sal.data ?? []) as Sala[]);
      setPautas((pau.data ?? []) as PautaDaSessao[]);
      setSessoesBrutas((ses.data ?? []) as SessaoDaGrade[]);
      setSessaoId(atual => ((ses.data ?? []) as SessaoDaGrade[]).some(sessao => sessao.id === atual) ? atual : (ses.data?.[0]?.id ?? ""));
      setErro(sal.error || pau.error || ses.error ? "Não foi possível carregar as sessões. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [espacoId, hoje]);

  useEffect(() => {
    if (!espacoId || !sessaoId) return;
    try { window.sessionStorage.setItem(CHAVE_DA_ESCOLHA, JSON.stringify({ espacoId, sessaoId })); } catch { /* sem armazenamento (janela privada): só não lembra */ }
  }, [espacoId, sessaoId]);

  const sessoes = useMemo(() => sessoesComSala(sessoesBrutas ?? [], pautas), [sessoesBrutas, pautas]);
  const nomesDasSalas = useMemo(() => new Map(salas.map(sala => [sala.id, sala.nome])), [salas]);
  const opcoes = useMemo(() => sessoes.map(sessao => ({
    value: sessao.id,
    label: `${diaDaSemana(sessao.dia)} ${diaEMes(sessao.dia)}, ${faixaDaSessao(sessao)} · ${sessao.tituloFinal}${salas.length > 1 ? ` · ${nomesDasSalas.get(sessao.sala_id) ?? ""}` : ""}`,
  })), [sessoes, salas, nomesDasSalas]);
  const escolhida = opcoes.find(opcao => opcao.value === sessaoId);

  return (
    <DetailPageContent>
      {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {espacos === null ? (
        <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : espacos.length === 0 ? (
        <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Cadastre um espaço, crie pautas e sessões na Programação para continuar.</p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="w-64 max-w-full"><Dropdown ariaLabel="Espaço" value={espacoId} onChange={setEspacoId} options={espacos.map(espaco => ({ value: espaco.id, label: espaco.nome }))} /></div>
            {opcoes.length > 0 && <div className="w-[28rem] max-w-full"><Dropdown ariaLabel="Sessão" value={sessaoId} onChange={setSessaoId} options={opcoes} /></div>}
          </div>
          {sessoesBrutas === null ? (
            <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
          ) : sessoes.length === 0 ? (
            <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Este espaço não tem sessões a partir de hoje. Crie as sessões na Programação.</p>
          ) : sessaoId && escolhida && organizationId ? (
            children({ id: sessaoId, rotulo: escolhida.label, organizationId })
          ) : null}
        </>
      )}
    </DetailPageContent>
  );
}
