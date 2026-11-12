"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { faixaDaSessao, sessoesComSala, type PautaDaSessao, type SessaoDaGrade } from "@/lib/producao/programacao";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConvidadosDaSessao } from "@/components/producao/ConvidadosDaSessao";

type Espaco = { id: string; nome: string };
type Sala = { id: string; nome: string };

/** Quantas sessões (a partir de hoje) a lista oferece de uma vez. */
const LIMITE_DE_SESSOES = 80;

/** Convidados e cortesias (PD7.2): escolhe o espaço e a sessão; a cota de cada tipo de credencial vale por sessão. */
export default function ConvidadosPage() {
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const [espacos, setEspacos] = useState<Espaco[] | null>(null);
  const [espacoId, setEspacoId] = useState("");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [pautas, setPautas] = useState<PautaDaSessao[]>([]);
  const [sessoesBrutas, setSessoesBrutas] = useState<SessaoDaGrade[] | null>(null);
  const [sessaoId, setSessaoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_espacos").select("id, nome").eq("organization_id", organizationId).eq("arquivado", false).order("nome");
      if (!ativo) return;
      setEspacos((data ?? []) as Espaco[]);
      setEspacoId(atual => atual || data?.[0]?.id || "");
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

  const sessoes = useMemo(() => sessoesComSala(sessoesBrutas ?? [], pautas), [sessoesBrutas, pautas]);
  const nomesDasSalas = useMemo(() => new Map(salas.map(sala => [sala.id, sala.nome])), [salas]);
  const opcoesDeSessao = useMemo(() => sessoes.map(sessao => ({
    value: sessao.id,
    label: `${diaDaSemana(sessao.dia)} ${diaEMes(sessao.dia)}, ${faixaDaSessao(sessao)} · ${sessao.tituloFinal}${salas.length > 1 ? ` · ${nomesDasSalas.get(sessao.sala_id) ?? ""}` : ""}`,
  })), [sessoes, salas, nomesDasSalas]);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Convidados</h1>
          <p className="mt-1 max-w-2xl text-[0.75rem] text-black/45">Quem a produção convida para cada sessão, por tipo de credencial. Cada tipo tem uma cota de lugares por sessão, e o banco não deixa passar dela. Só nome e afiliação: sem documento nem contato.</p>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {espacos === null ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : espacos.length === 0 ? (
          <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Cadastre um espaço, crie pautas e sessões na Programação para convidar pessoas.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="w-64 max-w-full"><Dropdown ariaLabel="Espaço" value={espacoId} onChange={setEspacoId} options={espacos.map(espaco => ({ value: espaco.id, label: espaco.nome }))} /></div>
              {opcoesDeSessao.length > 0 && <div className="w-[28rem] max-w-full"><Dropdown ariaLabel="Sessão" value={sessaoId} onChange={setSessaoId} options={opcoesDeSessao} /></div>}
            </div>
            {sessoesBrutas === null ? (
              <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
            ) : sessoes.length === 0 ? (
              <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Este espaço não tem sessões a partir de hoje. Crie as sessões na Programação.</p>
            ) : sessaoId && organizationId ? (
              <ConvidadosDaSessao key={sessaoId} organizationId={organizationId} sessaoId={sessaoId} podeEditar={podeEditar} />
            ) : null}
          </>
        )}
      </DetailPageContent>
    </div>
  );
}
