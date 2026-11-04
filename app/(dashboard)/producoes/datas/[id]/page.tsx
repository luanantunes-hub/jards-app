"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { SITUACOES_DA_DATA, type ExibicaoDoBloco, type SituacaoDaData } from "@/lib/producao/estados";
import { diaDaSemana, diaEMes, mudancaDeSituacao, ROTULO_DA_SITUACAO_DA_DATA, ROTULO_DO_TIPO_DE_DATA } from "@/lib/producao/agenda";
import { FUSO_PADRAO, montarDiaDoModelo, ordenarBlocos, rotuloDaHora, ROTULO_DO_TIPO_DE_BLOCO } from "@/lib/producao/dia";
import { modelosDeDia, type TipoBloco, type TipoData, type TipoProducao } from "@/lib/producao/vocabulario";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { NovoBlocoSheet } from "@/components/producao/NovoBlocoSheet";
import { EquipeDaData } from "@/components/producao/EquipeDaData";
import { ViagemEHospedagem } from "@/components/producao/ViagemEHospedagem";
import { TarefasDaData } from "@/components/producao/TarefasDaData";

type Data = {
  id: string; temporada_id: string; data: string; data_fim: string | null; tipo: TipoData; situacao: SituacaoDaData; uf: string | null; fuso: string;
  temporada: { titulo: string; tipo: string; lado: string } | null;
};
type Bloco = { id: string; dia: string; inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco; tipo: string; titulo: string | null; confirmado: boolean; ordem: number };

const CAMPO_HORA = "h-9 rounded border border-black/[.12] bg-white px-2.5 text-[0.75rem] text-[#282525] outline-none focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

/** A data: situação, lugar e o dia em blocos. O dia sai de um modelo do tipo de produção, em um clique. */
export default function DataPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const { confirmDelete } = useDeleteConfirm();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [folha, setFolha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [modeloId, setModeloId] = useState("");
  const [horaDoPrimeiro, setHoraDoPrimeiro] = useState("14:00");
  const [aplicando, setAplicando] = useState(false);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [dat, blo] = await Promise.all([
        producao.from("producao_datas").select("id, temporada_id, data, data_fim, tipo, situacao, uf, fuso, temporada:producao_temporadas!temporada_id(titulo, tipo, lado)").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao.from("producao_blocos").select("id, dia, inicio, fim, exibicao, tipo, titulo, confirmado, ordem").eq("data_id", id),
      ]);
      if (!ativo) return;
      setData(dat.error ? null : (dat.data as Data | null));
      setBlocos((blo.data ?? []) as Bloco[]);
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  const fuso = data?.fuso ?? FUSO_PADRAO;
  const ordenados = useMemo(() => ordenarBlocos(blocos), [blocos]);
  const modelos = useMemo(() => (data?.temporada ? modelosDeDia(data.temporada.tipo as TipoProducao) : []), [data]);
  const modeloEscolhido = modelos.find(item => item.id === modeloId) ?? modelos.find(item => item.tipoData === data?.tipo) ?? modelos[0];
  const recarregar = () => setVersao(atual => atual + 1);

  async function mudarSituacao(nova: SituacaoDaData) {
    if (!data || nova === data.situacao) return;
    setErro(null);
    const anterior = data;
    setData({ ...data, situacao: nova });
    const { error } = await clienteDaProducao(createClient()).from("producao_datas").update(mudancaDeSituacao(nova)).eq("id", data.id);
    if (error) { setData(anterior); setErro("Não foi possível mudar a situação. Tente de novo."); }
  }

  async function aplicarModelo() {
    if (!data || !organizationId || !modeloEscolhido || !horaDoPrimeiro) return;
    setAplicando(true);
    setErro(null);
    const linhas = montarDiaDoModelo(modeloEscolhido, data.data, horaDoPrimeiro, fuso).map(bloco => ({ ...bloco, organization_id: organizationId, data_id: data.id, ordem: bloco.ordem + blocos.length }));
    const { error } = await clienteDaProducao(createClient()).from("producao_blocos").insert(linhas);
    setAplicando(false);
    if (error) { setErro("Não foi possível montar o dia. Tente de novo."); return; }
    recarregar();
  }

  async function confirmar(bloco: Bloco) {
    setErro(null);
    setBlocos(atual => atual.map(item => (item.id === bloco.id ? { ...item, confirmado: !item.confirmado } : item)));
    const { error } = await clienteDaProducao(createClient()).from("producao_blocos").update({ confirmado: !bloco.confirmado }).eq("id", bloco.id);
    if (error) { recarregar(); setErro("Não foi possível confirmar. Tente de novo."); }
  }

  function remover(bloco: Bloco) {
    confirmDelete({
      title: "Remover bloco?",
      description: `"${bloco.titulo ?? ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo as TipoBloco] ?? bloco.tipo}" sai do dia.`,
      confirmLabel: "Remover",
      pendingLabel: "Removendo…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_blocos").delete().eq("id", bloco.id);
        if (error) throw new Error("Não foi possível remover o bloco.");
        recarregar();
      },
    });
  }

  if (data === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (data === null) return <DetailNotFound title="Data não encontrada" backHref="/producoes" backLabel="Voltar para a Agenda" />;

  const nomeDoTipo = ROTULO_DO_TIPO_DE_DATA[data.tipo];

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href={`/producoes/temporadas/${data.temporada_id}`} label={data.temporada?.titulo ?? "Temporada"} />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{nomeDoTipo} de {diaEMes(data.data)}</h1>
              <p className="mt-1 text-[0.75rem] text-black/45">{[diaDaSemana(data.data), data.data_fim ? `até ${diaEMes(data.data_fim)}` : null, data.uf, fuso !== FUSO_PADRAO ? fuso : null].filter(Boolean).join(" · ")}</p>
            </div>
            {podeEditar ? (
              <Select block={false} aria-label="Situação da data" value={data.situacao} onChange={event => void mudarSituacao(event.target.value as SituacaoDaData)} className="h-10 pl-3 pr-8 text-black/60">
                {SITUACOES_DA_DATA.map(situacao => <option key={situacao} value={situacao}>{ROTULO_DA_SITUACAO_DA_DATA[situacao]}</option>)}
              </Select>
            ) : <span className="text-[0.75rem] text-black/55">{ROTULO_DA_SITUACAO_DA_DATA[data.situacao]}</span>}
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <section aria-labelledby="o-dia">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="o-dia" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">O dia</h2>
            {podeEditar && blocos.length > 0 && <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo bloco</PrimaryListAction>}
          </div>

          {blocos.length === 0 ? (
            <div className="rounded border bg-white px-5 py-8" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-center text-[0.8125rem] font-medium text-black/55">Nenhum bloco neste dia</p>
              {podeEditar ? (
                <div className="mx-auto mt-4 flex max-w-md flex-wrap items-end justify-center gap-3">
                  {modelos.length > 0 && (
                    <>
                      <label className="flex flex-col text-[0.6875rem] font-medium text-black/55">
                        Modelo
                        <Select block={false} aria-label="Modelo de dia" value={modeloEscolhido?.id ?? ""} onChange={event => setModeloId(event.target.value)} className="mt-1.5 h-9 pl-3 pr-8 text-black/70">
                          {modelos.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                        </Select>
                      </label>
                      <label className="flex flex-col text-[0.6875rem] font-medium text-black/55">
                        Primeiro bloco às
                        <input type="time" value={horaDoPrimeiro} onChange={event => setHoraDoPrimeiro(event.target.value)} className={`${CAMPO_HORA} mt-1.5 block`} />
                      </label>
                      <PrimaryListAction onClick={() => void aplicarModelo()} disabled={aplicando || !horaDoPrimeiro}>{aplicando ? "Montando…" : "Montar o dia"}</PrimaryListAction>
                    </>
                  )}
                  <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo bloco</PrimaryListAction>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <ul className="divide-y divide-black/[.06]">
                {ordenados.map(bloco => (
                  <li key={bloco.id} className="flex items-center gap-4 px-4 py-3">
                    <p className="w-28 shrink-0 text-[0.75rem] tabular-nums text-black/60">{rotuloDaHora(bloco, fuso) || "—"}</p>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{bloco.titulo ?? ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo as TipoBloco] ?? bloco.tipo}</p>
                      <p className="text-[0.6875rem] text-black/45">{ROTULO_DO_TIPO_DE_BLOCO[bloco.tipo as TipoBloco] ?? bloco.tipo}{bloco.confirmado ? "" : " · não confirmado"}</p>
                    </div>
                    {podeEditar && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => void confirmar(bloco)} aria-pressed={bloco.confirmado} aria-label={bloco.confirmado ? "Desmarcar confirmação" : "Confirmar bloco"} title={bloco.confirmado ? "Confirmado" : "Confirmar"} className={`flex h-9 w-9 items-center justify-center rounded transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${bloco.confirmado ? "text-[#2E8932]" : "text-black/30"}`}><Check size={15} aria-hidden="true" /></button>
                        <button type="button" onClick={() => remover(bloco)} aria-label="Remover bloco" title="Remover" className="flex h-9 w-9 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {organizationId && <EquipeDaData organizationId={organizationId} data={{ id: data.id, data: data.data, data_fim: data.data_fim, fuso }} podeEditar={podeEditar} />}
        {organizationId && <ViagemEHospedagem organizationId={organizationId} data={{ id: data.id, data: data.data, fuso }} podeEditar={podeEditar} />}
        {organizationId && <TarefasDaData organizationId={organizationId} dataId={data.id} tipoDeProducao={(data.temporada?.tipo as TipoProducao | undefined) ?? null} podeEditar={podeEditar} />}
      </DetailPageContent>

      {folha && organizationId && (
        <NovoBlocoSheet organizationId={organizationId} dataId={data.id} dia={data.data} fuso={fuso} proximaOrdem={blocos.length} onClose={() => setFolha(false)} onCreated={recarregar} />
      )}
    </div>
  );
}
