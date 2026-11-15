"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaDaSemana, diaEMes } from "@/lib/producao/agenda";
import { fraseDoHistorico, type LinhaDoHistorico } from "@/lib/producao/historico";
import { agruparPorDia, AREAS_DA_LINHA_DO_TEMPO, entidadesDaArea, inicioDoPeriodo, intervaloDaPagina, PERIODOS_DA_LINHA_DO_TEMPO, recortarPagina } from "@/lib/producao/linha-do-tempo";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Dropdown } from "@/components/ui/Dropdown";

const hora = (instante: string) => new Date(instante).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** A linha do tempo da produção (PD8.4): tudo o que mudou, do mais novo ao mais velho, por área e período, de página em página. Cada pessoa só vê o que o banco deixa ela ver. */
export default function LinhaDoTempoPage() {
  const organizationId = useOrganizationId();
  const [area, setArea] = useState("");
  const [periodo, setPeriodo] = useState("30");
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<LinhaDoHistorico[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { de, ate } = intervaloDaPagina(pagina);
      const entidades = entidadesDaArea(area);
      const inicio = inicioDoPeriodo(periodo, agora);
      let consulta = clienteDaProducao(createClient()).from("producao_historico")
        .select("id, entidade, acao, campo, antes, depois, quando").eq("organization_id", organizationId);
      if (entidades) consulta = consulta.in("entidade", [...entidades]);
      if (inicio) consulta = consulta.gte("quando", inicio);
      const { data, error } = await consulta.order("quando", { ascending: false }).order("id", { ascending: false }).range(de, ate);
      if (!ativo) return;
      const { mostrar, temMais: mais } = recortarPagina((data ?? []) as LinhaDoHistorico[]);
      setLinhas(atual => (pagina === 0 ? mostrar : [...atual, ...mostrar]));
      setTemMais(mais);
      setCarregando(false);
      setErro(error ? "Não foi possível carregar a linha do tempo. Tente de novo." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, area, periodo, pagina, agora]);

  const grupos = useMemo(() => agruparPorDia(linhas), [linhas]);

  function mudarFiltro(aplicar: () => void) {
    setCarregando(true);
    setPagina(0);
    aplicar();
  }

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Linha do tempo</h1>
        </div>
      </header>
      <DetailPageContent>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="w-60 max-w-full"><Dropdown ariaLabel="Área" value={area} onChange={valor => mudarFiltro(() => setArea(valor))} options={[{ value: "", label: "Todas as áreas" }, ...AREAS_DA_LINHA_DO_TEMPO.map(item => ({ value: item.id, label: item.nome }))]} /></div>
          <div className="w-52 max-w-full"><Dropdown ariaLabel="Período" value={periodo} onChange={valor => mudarFiltro(() => setPeriodo(valor))} options={PERIODOS_DA_LINHA_DO_TEMPO.map(item => ({ value: item.id, label: item.nome }))} /></div>
        </div>

        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

        {carregando && linhas.length === 0 ? (
          <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : grupos.length === 0 ? (
          <p className="rounded border bg-white px-5 py-8 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nada mudou neste período e nesta área.</p>
        ) : (
          <div className="space-y-5">
            {grupos.map(grupo => (
              <section key={grupo.dia} aria-label={`${diaDaSemana(grupo.dia)} ${diaEMes(grupo.dia)}`}>
                <h2 className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{diaDaSemana(grupo.dia)} {diaEMes(grupo.dia)}</h2>
                <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {grupo.linhas.map(linha => (
                    <li key={linha.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
                      <span className="min-w-0 flex-1 basis-72 break-words text-[0.8125rem] text-[#282525]">{fraseDoHistorico(linha)}</span>
                      <span className="text-[0.6875rem] tabular-nums text-black/45">{hora(linha.quando)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {temMais && (
              <button type="button" onClick={() => { setCarregando(true); setPagina(atual => atual + 1); }} disabled={carregando}
                className="h-10 w-full rounded border border-black/12 bg-white text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">
                {carregando ? "Carregando…" : "Ver mais"}
              </button>
            )}
          </div>
        )}
      </DetailPageContent>
    </div>
  );
}
