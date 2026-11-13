"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Copy, Plus } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { SITUACOES_DA_DATA, type SituacaoDaData } from "@/lib/producao/estados";
import { diaDaSemana, diaEMes, mudancaDeSituacao, opcaoVencida, ROTULO_DA_SITUACAO_DA_DATA, ROTULO_DO_TIPO_DE_DATA, type DataDaAgenda } from "@/lib/producao/agenda";
import { ROTULO_DO_FORMATO, tipoDeProducao, type FormatoTemporada, type TipoProducao } from "@/lib/producao/vocabulario";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { NovaDataSheet } from "@/components/producao/NovaDataSheet";
import { EquipeDaTemporada } from "@/components/producao/EquipeDaTemporada";
import { CargaDaTemporada } from "@/components/producao/CargaDaTemporada";
import { CargaPorVeiculo } from "@/components/producao/CargaPorVeiculo";
import { HospedagemDaTemporada } from "@/components/producao/HospedagemDaTemporada";
import { ConvitesDaTemporada } from "@/components/producao/ConvitesDaTemporada";
import { VoluntariosDaTemporada } from "@/components/producao/VoluntariosDaTemporada";
import { RelatorioDaTemporada } from "@/components/producao/RelatorioDaTemporada";
import { OrcamentoDaTemporada } from "@/components/producao/OrcamentoDaTemporada";
import { AcordosDaTemporada } from "@/components/producao/AcordosDaTemporada";
import { LancamentosDaTemporada } from "@/components/producao/LancamentosDaTemporada";
import { FaturasDaTemporada } from "@/components/producao/FaturasDaTemporada";
import { CopiarTemporadaSheet, type TemporadaParaCopiar } from "@/components/producao/CopiarTemporadaSheet";

type Temporada = TemporadaParaCopiar;

const PLURAL_DA_SITUACAO: Record<SituacaoDaData, string> = { opcao: "Opções", confirmada: "Confirmadas", realizada: "Realizadas", cancelada: "Canceladas" };

/** A temporada: as datas dela, a situação de cada uma e a cópia para o ano seguinte. */
export default function TemporadaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [temporada, setTemporada] = useState<Temporada | null | undefined>(undefined);
  const [datas, setDatas] = useState<DataDaAgenda[]>([]);
  const [folha, setFolha] = useState<"data" | "copiar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [temp, dat] = await Promise.all([
        producao.from("producao_temporadas").select("id, titulo, tipo, formato, lado, obra_id, projeto_id").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao
          .from("producao_datas")
          .select("id, data, data_fim, tipo, situacao, opcao_ordem, opcao_ate, temporada_id, uf")
          .eq("temporada_id", id)
          .order("data", { ascending: true }),
      ]);
      if (!ativo) return;
      setTemporada(temp.error ? null : (temp.data as Temporada | null));
      setDatas((dat.data ?? []).map(linha => ({ ...linha, temporada_titulo: null, obra_titulo: null, municipio: null })));
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  const resumo = useMemo(() => {
    const por: Record<string, number> = {};
    for (const item of datas) por[item.situacao] = (por[item.situacao] ?? 0) + 1;
    return SITUACOES_DA_DATA.filter(situacao => por[situacao]).map(situacao => `${por[situacao]} ${(por[situacao] > 1 ? PLURAL_DA_SITUACAO : ROTULO_DA_SITUACAO_DA_DATA)[situacao].toLocaleLowerCase("pt-BR")}`).join(" · ");
  }, [datas]);

  async function mudarSituacao(data: DataDaAgenda, nova: SituacaoDaData) {
    if (nova === data.situacao) return;
    setErro(null);
    const anterior = datas;
    setDatas(atual => atual.map(item => (item.id === data.id ? { ...item, ...mudancaDeSituacao(nova) } : item)));
    const { error } = await clienteDaProducao(createClient()).from("producao_datas").update(mudancaDeSituacao(nova)).eq("id", data.id);
    if (error) { setDatas(anterior); setErro("Não foi possível mudar a situação. Tente de novo."); }
  }

  if (temporada === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (temporada === null) return <DetailNotFound title="Temporada não encontrada" backHref="/producoes/temporadas" backLabel="Voltar para Temporadas" />;

  const tipo = tipoDeProducao(temporada.tipo as TipoProducao).rotulo;

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href="/producoes/temporadas" label="Temporadas" />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{temporada.titulo}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{[tipo, ROTULO_DO_FORMATO[temporada.formato as FormatoTemporada] ?? temporada.formato, temporada.lado === "circula" ? "Viaja" : "Recebe"].join(" · ")}</p>
              {resumo && <p className="mt-0.5 text-[0.75rem] text-black/45">{resumo}</p>}
            </div>
            {podeEditar && (
              <div className="flex items-center gap-2">
                <PrimaryListAction onClick={() => setFolha("copiar")}><Copy size={13} aria-hidden="true" /> Copiar</PrimaryListAction>
                <PrimaryListAction onClick={() => setFolha("data")}><Plus size={13} aria-hidden="true" /> Nova data</PrimaryListAction>
              </div>
            )}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {datas.length === 0 ? (
          <p className="py-12 text-center text-[0.8125rem] text-black/45">Nenhuma data nesta temporada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <ul className="divide-y divide-black/[.06]">
              {datas.map(item => (
                <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-14 shrink-0 text-[0.75rem] tabular-nums">
                    <p className="font-semibold text-[#282525]">{diaEMes(item.data)}</p>
                    <p className="text-[0.625rem] uppercase tracking-[.08em] text-black/45">{diaDaSemana(item.data)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/producoes/datas/${item.id}`} className="truncate text-[0.8125rem] font-medium text-[#282525] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{ROTULO_DO_TIPO_DE_DATA[item.tipo]}{item.data_fim ? ` até ${diaEMes(item.data_fim)}` : ""}</Link>
                    {opcaoVencida(item, hoje) && <p className="text-[0.6875rem] text-[#B23B3B]">Opção vencida</p>}
                  </div>
                  {podeEditar ? (
                    <Select block={false} aria-label={`Situação de ${ROTULO_DO_TIPO_DE_DATA[item.tipo]} de ${diaEMes(item.data)}`} value={item.situacao} onChange={event => void mudarSituacao(item, event.target.value as SituacaoDaData)} className="h-9 pl-3 pr-8 text-black/60">
                      {SITUACOES_DA_DATA.map(situacao => <option key={situacao} value={situacao}>{ROTULO_DA_SITUACAO_DA_DATA[situacao]}</option>)}
                    </Select>
                  ) : (
                    <span className="text-[0.6875rem] text-black/55">{ROTULO_DA_SITUACAO_DA_DATA[item.situacao]}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {organizationId && <EquipeDaTemporada organizationId={organizationId} temporadaId={temporada.id} podeEditar={podeEditar} />}
        {organizationId && <ConvitesDaTemporada organizationId={organizationId} temporadaId={temporada.id} temporadaTitulo={temporada.titulo} podeEditar={podeEditar} />}
        {organizationId && <VoluntariosDaTemporada organizationId={organizationId} temporadaId={temporada.id} podeEditar={podeEditar} />}
        {organizationId && <HospedagemDaTemporada organizationId={organizationId} temporadaId={temporada.id} podeEditar={podeEditar} />}
        {organizationId && <CargaDaTemporada organizationId={organizationId} temporadaId={temporada.id} />}
        {organizationId && <CargaPorVeiculo organizationId={organizationId} temporadaId={temporada.id} />}
        {organizationId && <AcordosDaTemporada organizationId={organizationId} temporadaId={temporada.id} podeEditar={podeEditar} />}
        {organizationId && <OrcamentoDaTemporada organizationId={organizationId} temporadaId={temporada.id} temporadaTitulo={temporada.titulo} podeEditar={podeEditar} />}
        {organizationId && <FaturasDaTemporada organizationId={organizationId} temporadaId={temporada.id} temporadaTitulo={temporada.titulo} podeEditar={podeEditar} />}
        {organizationId && <LancamentosDaTemporada organizationId={organizationId} temporadaId={temporada.id} temporadaTitulo={temporada.titulo} podeEditar={podeEditar} />}
        {organizationId && <RelatorioDaTemporada organizationId={organizationId} temporadaId={temporada.id} titulo={temporada.titulo} />}
      </DetailPageContent>

      {folha === "data" && organizationId && (
        <NovaDataSheet organizationId={organizationId} temporadas={[{ id: temporada.id, titulo: temporada.titulo }]} temporadaInicial={temporada.id} onClose={() => setFolha(null)} onCreated={() => setVersao(atual => atual + 1)} />
      )}
      {folha === "copiar" && organizationId && (
        <CopiarTemporadaSheet organizationId={organizationId} temporada={temporada} datas={datas} onClose={() => setFolha(null)} onCreated={novaId => router.push(`/producoes/temporadas/${novaId}`)} />
      )}
    </div>
  );
}
