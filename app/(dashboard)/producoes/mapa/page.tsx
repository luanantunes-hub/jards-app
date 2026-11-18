"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diaEMes } from "@/lib/producao/agenda";
import { paradasDaTurne, projetar, TAMANHO_DO_MAPA, totalDeKm, tracoDoPais, type DataComLugar } from "@/lib/producao/mapa";
import { carregarMunicipios } from "@/components/prestacao/objeto/MunicipioCombobox";
import type { TabelaMunicipios } from "@/lib/prestacao/municipios";
import { DetailPageContent } from "@/components/ui/DetailPagePrimitives";
import { Select } from "@/components/ui/Select";

type Temporada = { id: string; titulo: string };
type DataLida = { id: string; data: string; temporada_id: string; espaco_id: string | null; municipio_ibge: string | null; uf: string | null };
type EspacoLido = { id: string; nome: string; municipio_ibge: string | null; latitude: number | null; longitude: number | null };

function periodo(datas: string[]): string {
  return datas.length === 1 ? diaEMes(datas[0]) : `${diaEMes(datas[0])} a ${diaEMes(datas[datas.length - 1])}`;
}

/** O mapa da turnê: as praças das apresentações, em ordem de data, sobre o mapa do Brasil, com a distância em linha reta. */
export default function MapaDaTurnePage() {
  const organizationId = useOrganizationId();
  const [temporadas, setTemporadas] = useState<Temporada[] | null>(null);
  const [datas, setDatas] = useState<DataLida[]>([]);
  const [espacos, setEspacos] = useState<EspacoLido[]>([]);
  const [tabela, setTabela] = useState<TabelaMunicipios | null>(null);
  const [escolhida, setEscolhida] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [tem, dat, esp] = await Promise.all([
        producao.from("producao_temporadas").select("id, titulo").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        producao.from("producao_datas").select("id, data, temporada_id, espaco_id, municipio_ibge, uf").eq("organization_id", organizationId).eq("tipo", "apresentacao").neq("situacao", "cancelada").order("data").limit(1000),
        producao.from("producao_espacos").select("id, nome, municipio_ibge, latitude, longitude").eq("organization_id", organizationId),
      ]);
      if (!ativo) return;
      setTemporadas((tem.data ?? []) as Temporada[]);
      setDatas((dat.data ?? []) as DataLida[]);
      setEspacos((esp.data ?? []) as EspacoLido[]);
      setErro(tem.error || dat.error || esp.error ? "Não foi possível carregar a turnê. Recarregue a página." : null);
    })();
    carregarMunicipios().then(t => { if (ativo) setTabela(t); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [organizationId]);

  const temporadaId = escolhida || temporadas?.[0]?.id || "";
  const pais = useMemo(() => (tabela ? tracoDoPais(tabela.municipios) : ""), [tabela]);

  const { comLugar, semLugar } = useMemo(() => {
    const doEspaco = new Map(espacos.map(espaco => [espaco.id, espaco]));
    const doMunicipio = new Map((tabela?.municipios ?? []).map(m => [m[0], m]));
    const com: DataComLugar[] = [];
    let sem = 0;
    for (const data of datas.filter(item => item.temporada_id === temporadaId)) {
      const espaco = data.espaco_id ? doEspaco.get(data.espaco_id) : undefined;
      if (espaco?.latitude != null && espaco.longitude != null) {
        com.push({ id: data.id, data: data.data, chave: `e:${espaco.id}`, nome: espaco.nome, latitude: espaco.latitude, longitude: espaco.longitude });
        continue;
      }
      const municipio = data.municipio_ibge ? doMunicipio.get(data.municipio_ibge) : undefined;
      if (municipio) com.push({ id: data.id, data: data.data, chave: `m:${municipio[0]}`, nome: `${municipio[1]} · ${municipio[2]}`, latitude: municipio[3], longitude: municipio[4] });
      else sem++;
    }
    return { comLugar: com, semLugar: sem };
  }, [datas, espacos, tabela, temporadaId]);

  const paradas = useMemo(() => paradasDaTurne(comLugar), [comLugar]);
  const pontos = paradas.map(parada => projetar(parada.latitude, parada.longitude));
  const km = totalDeKm(paradas);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Mapa da turnê</h1>
            </div>
            {temporadas && temporadas.length > 1 && (
              <Select block={false} aria-label="Temporada" value={temporadaId} onChange={event => setEscolhida(event.target.value)} className="h-10 pl-3 pr-8 text-black/60">
                {temporadas.map(item => <option key={item.id} value={item.id}>{item.titulo}</option>)}
              </Select>
            )}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {temporadas === null ? (
          <div className="h-64 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : temporadas.length === 0 ? (
          <div className="rounded border bg-white px-5 py-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma temporada ainda</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Crie a temporada e as datas na agenda; o mapa mostra onde cada apresentação acontece.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <svg viewBox={`0 0 ${TAMANHO_DO_MAPA.largura} ${TAMANHO_DO_MAPA.altura}`} role="img" aria-label={paradas.length === 0 ? "Mapa do Brasil sem praças" : `Mapa do Brasil com ${paradas.length} ${paradas.length === 1 ? "praça" : "praças"} da turnê`} className="mx-auto block max-h-[40rem] w-full">
                {pais && <path d={pais} fill="none" stroke="rgba(13,13,13,.14)" strokeWidth="3.2" strokeLinecap="round" />}
                {pontos.length > 1 && <polyline points={pontos.map(ponto => `${ponto.x.toFixed(1)},${ponto.y.toFixed(1)}`).join(" ")} fill="none" stroke="#282525" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="5 4" strokeLinejoin="round" />}
                {pontos.map((ponto, indice) => (
                  <g key={`${paradas[indice].chave}-${indice}`}>
                    <title>{`${indice + 1}. ${paradas[indice].nome} · ${periodo(paradas[indice].datas)}`}</title>
                    <circle cx={ponto.x} cy={ponto.y} r="11" fill="#282525" stroke="#fff" strokeWidth="2" />
                    <text x={ponto.x} y={ponto.y + 3.6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>{indice + 1}</text>
                  </g>
                ))}
              </svg>
            </div>

            <aside aria-label="Praças da turnê">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Praças</h2>
                {paradas.length > 1 && <span className="text-[0.75rem] tabular-nums text-black/55">{km.toLocaleString("pt-BR")} km em linha reta</span>}
              </div>
              {paradas.length === 0 ? (
                <div className="rounded border bg-white px-4 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <MapPin size={16} aria-hidden="true" className="mx-auto text-black/30" />
                  <p className="mt-2 text-[0.8125rem] font-medium text-black/55">Nenhuma praça com lugar</p>
                  <p className="mx-auto mt-1 text-[0.75rem] text-black/45">Escolha o espaço de cada data e o município de cada espaço.</p>
                  <Link href="/producoes/espacos" className="mt-3 inline-block text-[0.75rem] font-medium text-black/60 underline underline-offset-2 hover:text-black/80">Abrir Espaços</Link>
                </div>
              ) : (
                <ol className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {paradas.map((parada, indice) => (
                    <li key={`${parada.chave}-${indice}`} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1C0E33] text-[0.625rem] font-semibold tabular-nums text-white">{indice + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{parada.nome}</p>
                        <p className="text-[0.6875rem] text-black/45">{periodo(parada.datas)}{parada.kmDaAnterior !== null ? ` · ${parada.kmDaAnterior.toLocaleString("pt-BR")} km da anterior` : ""}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {semLugar > 0 && <p className="mt-3 text-[0.75rem] text-black/45">{semLugar} {semLugar === 1 ? "apresentação ficou" : "apresentações ficaram"} de fora por falta de lugar: escolha o espaço na página da data e o município no espaço.</p>}
            </aside>
          </div>
        )}
      </DetailPageContent>
    </div>
  );
}
