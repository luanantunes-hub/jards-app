"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { montarRelatorio, textoDoRelatorio, type Relatorio } from "@/lib/producao/relatorio-temporada";

const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: number; detalhe?: string }) {
  return (
    <li className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</p>
      <p className={`mt-1 text-[1.25rem] font-semibold tabular-nums ${valor === 0 ? "text-black/30" : "text-[#282525]"}`}>{valor.toLocaleString("pt-BR")}</p>
      {detalhe && <p className="mt-0.5 text-[0.6875rem] text-black/45">{detalhe}</p>}
    </li>
  );
}

/** O relatório de fim de temporada (PD9.6): os números do que a produção já registrou e o texto para colar numa proposta. Carrega só quando se abre. */
export function RelatorioDaTemporada({ organizationId, temporadaId, titulo }: { organizationId: string; temporadaId: string; titulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const dat = await producao.from("producao_datas").select("id, data, tipo, situacao, uf, municipio_ibge, espaco_id").eq("organization_id", organizationId).eq("temporada_id", temporadaId);
      const ids = (dat.data ?? []).map(data => data.id);
      const vazio = { data: [], error: null };
      const [oco, esc, des, con, vol] = await Promise.all([
        ids.length > 0 ? producao.from("producao_ocorrencias").select("data_id, gravidade, resolvida").in("data_id", ids) : vazio,
        ids.length > 0 ? producao.from("producao_escalas").select("pessoa_id, data_id").in("data_id", ids) : vazio,
        ids.length > 0 ? producao.from("producao_deslocamentos").select("odometro_saida_km, odometro_chegada_km").in("data_id", ids) : vazio,
        producao.from("producao_convites").select("resposta").eq("temporada_id", temporadaId),
        producao.from("producao_voluntarios").select("situacao").eq("temporada_id", temporadaId),
      ]);
      if (!ativo) return;
      const falhou = dat.error || oco.error || esc.error || des.error || con.error || vol.error;
      setErro(falhou ? "Não foi possível montar o relatório. Tente de novo." : null);
      setRelatorio(falhou ? null : montarRelatorio({
        datas: dat.data ?? [], ocorrencias: oco.data ?? [], escalas: esc.data ?? [], deslocamentos: des.data ?? [], convites: con.data ?? [], voluntarios: vol.data ?? [],
      }));
    })();
    return () => { ativo = false; };
  }, [aberto, organizationId, temporadaId]);

  async function copiar() {
    if (!relatorio) return;
    try { await navigator.clipboard.writeText(textoDoRelatorio(titulo, relatorio)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  return (
    <section aria-labelledby="relatorio-da-temporada" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="relatorio-da-temporada" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Relatório da temporada</h2>
        {aberto && relatorio && <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar texto"}</button>}
      </div>
      {!aberto ? (
        <button type="button" onClick={() => setAberto(true)} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Ver os números da temporada</button>
      ) : erro ? (
        <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>
      ) : relatorio === null ? (
        <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : (
        <div className="space-y-3">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Numero rotulo="Datas" valor={relatorio.datas.total} detalhe={`${relatorio.datas.realizadas} realizadas · ${relatorio.datas.canceladas} canceladas`} />
            <Numero rotulo="Apresentações" valor={relatorio.datas.apresentacoesRealizadas} detalhe={`de ${relatorio.datas.apresentacoes} previstas`} />
            <Numero rotulo="Praças" valor={relatorio.pracas.total} detalhe={`${relatorio.pracas.estados} ${relatorio.pracas.estados === 1 ? "estado" : "estados"}`} />
            <Numero rotulo="Equipe escalada" valor={relatorio.equipe.pessoas} detalhe={`${relatorio.equipe.escalas} escalas`} />
            <Numero rotulo="Estrada (km)" valor={Math.round(relatorio.estrada.km)} detalhe={`${relatorio.estrada.comOdometro} de ${relatorio.estrada.deslocamentos} deslocamentos com odômetro`} />
            <Numero rotulo="Presenças confirmadas" valor={relatorio.convites.vao} detalhe={`${relatorio.convites.naoVao} não vão · ${relatorio.convites.semResposta} sem resposta`} />
            <Numero rotulo="Voluntários aprovados" valor={relatorio.voluntarios.aprovados} detalhe={`${relatorio.voluntarios.inscritos} ainda inscritos`} />
            <Numero rotulo="Ocorrências" valor={relatorio.ocorrencias.total} detalhe={`${relatorio.ocorrencias.altas} de gravidade alta · ${relatorio.ocorrencias.abertas} em aberto`} />
          </ul>
          <pre className="whitespace-pre-wrap break-words rounded border bg-black/[.03] px-4 py-3 font-[inherit] text-[0.75rem] text-[#282525]" style={{ borderColor: "rgba(13,13,13,.1)" }}>{textoDoRelatorio(titulo, relatorio)}</pre>
          <p className="text-[0.6875rem] text-black/45">Só entra o que foi registrado na produção. O público e o custo por praça e por espectador entram quando o borderô existir.</p>
        </div>
      )}
    </section>
  );
}
