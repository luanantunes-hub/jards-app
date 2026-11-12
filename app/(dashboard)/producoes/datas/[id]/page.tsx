"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Play, Plus, Square, Trash2, Undo2 } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { SITUACOES_DA_DATA, type ExibicaoDoBloco, type SituacaoDaData } from "@/lib/producao/estados";
import { diaDaSemana, diaEMes, mudancaDeSituacao, ROTULO_DA_SITUACAO_DA_DATA, ROTULO_DO_TIPO_DE_DATA } from "@/lib/producao/agenda";
import { FUSO_PADRAO, instanteParaHoraLocal, montarDiaDoModelo, ordenarBlocos, rotuloDaHora, ROTULO_DO_TIPO_DE_BLOCO } from "@/lib/producao/dia";
import { situacaoDoRoteiro, textoDoAtraso } from "@/lib/producao/ao-vivo";
import { modelosDeDia, type TipoBloco, type TipoData, type TipoProducao } from "@/lib/producao/vocabulario";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Select } from "@/components/ui/Select";
import { NovoBlocoSheet } from "@/components/producao/NovoBlocoSheet";
import { EquipeDaData } from "@/components/producao/EquipeDaData";
import { ViagemEHospedagem } from "@/components/producao/ViagemEHospedagem";
import { DeslocamentosDaData } from "@/components/producao/DeslocamentosDaData";
import { OcorrenciasDaData } from "@/components/producao/OcorrenciasDaData";
import { TarefasDaData } from "@/components/producao/TarefasDaData";
import { HistoricoDaData } from "@/components/producao/HistoricoDaData";
import { ArquivosDaData } from "@/components/producao/ArquivosDaData";
import { NotasDaData } from "@/components/producao/NotasDaData";
import { LicencasDaData } from "@/components/producao/LicencasDaData";
import { AcertosDaData } from "@/components/producao/AcertosDaData";
import { ItensDaData } from "@/components/producao/ItensDaData";
import { textoDaFolha } from "@/lib/producao/folha-texto";
import { rotuloDoLugar } from "@/lib/producao/espacos";
import { LugarDaData } from "@/components/producao/LugarDaData";
import { CopiarDiaSheet } from "@/components/producao/CopiarDiaSheet";
import { SalvarModeloDoDiaSheet } from "@/components/producao/SalvarModeloDoDiaSheet";
import { blocosParaModelo, modeloDaOrganizacao, type ModeloGuardado } from "@/lib/producao/modelos-dia";

type Data = {
  id: string; temporada_id: string; data: string; data_fim: string | null; tipo: TipoData; situacao: SituacaoDaData; uf: string | null; fuso: string;
  temporada: { titulo: string; tipo: string; lado: string } | null;
};
type Bloco = { id: string; dia: string; inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco; tipo: string; titulo: string | null; confirmado: boolean; ordem: number; iniciado_em: string | null; terminado_em: string | null };

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
  const [copiar, setCopiar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvarModelo, setSalvarModelo] = useState(false);
  const [modelosDaOrganizacao, setModelosDaOrganizacao] = useState<ModeloGuardado[]>([]);
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
      const [dat, blo, mod] = await Promise.all([
        producao.from("producao_datas").select("id, temporada_id, data, data_fim, tipo, situacao, uf, fuso, temporada:producao_temporadas!temporada_id(titulo, tipo, lado)").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao.from("producao_blocos").select("id, dia, inicio, fim, exibicao, tipo, titulo, confirmado, ordem, iniciado_em, terminado_em").eq("data_id", id),
        producao.from("producao_modelos_dia").select("id, nome, blocos").eq("organization_id", organizationId).order("nome"),
      ]);
      if (!ativo) return;
      setModelosDaOrganizacao((mod.data ?? []) as ModeloGuardado[]);
      setData(dat.error ? null : (dat.data as Data | null));
      setBlocos((blo.data ?? []) as Bloco[]);
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao]);

  const fuso = data?.fuso ?? FUSO_PADRAO;
  const ordenados = useMemo(() => ordenarBlocos(blocos), [blocos]);
  const aoVivo = useMemo(() => situacaoDoRoteiro(blocos), [blocos]);
  const modelos = useMemo(() => {
    const doTipo = data?.temporada ? modelosDeDia(data.temporada.tipo as TipoProducao) : [];
    return [...doTipo, ...modelosDaOrganizacao.map(modelo => modeloDaOrganizacao(modelo, data?.tipo ?? "outro"))];
  }, [data, modelosDaOrganizacao]);
  const blocosParaSalvar = useMemo(() => blocosParaModelo(blocos), [blocos]);
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

  async function copiarTexto() {
    if (!data) return;
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { data: lugar } = await producao.from("producao_datas").select("espaco:producao_espacos!espaco_id(nome), sala:producao_salas!sala_id(nome)").eq("id", data.id).maybeSingle();
    const texto = textoDaFolha({
      tipo: data.tipo, data: data.data, dataFim: data.data_fim, temporada: data.temporada?.titulo ?? null, fuso,
      lugar: rotuloDoLugar((lugar as { espaco: { nome: string } | null } | null)?.espaco?.nome ?? null, (lugar as { sala: { nome: string } | null } | null)?.sala?.nome ?? null),
      blocos,
    });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Tente de novo.");
    }
  }

  async function confirmar(bloco: Bloco) {
    setErro(null);
    setBlocos(atual => atual.map(item => (item.id === bloco.id ? { ...item, confirmado: !item.confirmado } : item)));
    const { error } = await clienteDaProducao(createClient()).from("producao_blocos").update({ confirmado: !bloco.confirmado }).eq("id", bloco.id);
    if (error) { recarregar(); setErro("Não foi possível confirmar. Tente de novo."); }
  }

  /** O roteiro ao vivo (PD7.1): marca agora o começo ou o fim do bloco, ou desfaz a marca. */
  async function marcar(bloco: Bloco, acao: "comecou" | "terminou" | "desfazer") {
    setErro(null);
    const agora = new Date().toISOString();
    const valores = acao === "comecou" ? { iniciado_em: agora, terminado_em: null } : acao === "terminou" ? { terminado_em: agora } : { iniciado_em: null, terminado_em: null };
    setBlocos(atual => atual.map(item => (item.id === bloco.id ? { ...item, ...valores } : item)));
    const { error } = await clienteDaProducao(createClient()).from("producao_blocos").update(valores).eq("id", bloco.id);
    if (error) { recarregar(); setErro("Não foi possível marcar o bloco. Tente de novo."); }
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
          {organizationId && <LugarDaData organizationId={organizationId} dataId={data.id} podeEditar={podeEditar} />}
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <section aria-labelledby="o-dia">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="o-dia" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">O dia</h2>
            {blocos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void copiarTexto()} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{copiado ? "Texto copiado" : "Copiar para o WhatsApp"}</button>
                {podeEditar && (<>
                <button type="button" onClick={() => setSalvarModelo(true)} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Salvar como modelo</button>
                <button type="button" onClick={() => setCopiar(true)} className="rounded border border-black/[.12] px-3.5 py-2 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Copiar para outras datas</button>
                <PrimaryListAction onClick={() => setFolha(true)}><Plus size={13} aria-hidden="true" /> Novo bloco</PrimaryListAction>
                </>)}
              </div>
            )}
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
                      {(() => {
                        const situacao = aoVivo.get(bloco.id);
                        if (!situacao) return null;
                        if (situacao.estado === "pendente") {
                          return situacao.previstoPara ? <p className="text-[0.6875rem]" style={{ color: "#B07A14" }}>Previsto às {instanteParaHoraLocal(situacao.previstoPara, fuso).hora} ({textoDoAtraso(situacao.atrasoPropagadoMin)})</p> : null;
                        }
                        const comecou = bloco.iniciado_em ? instanteParaHoraLocal(bloco.iniciado_em, fuso).hora : "";
                        const atraso = situacao.atrasoDoComecoMin;
                        const corDoAtraso = atraso !== null && atraso > 0 ? "#B07A14" : undefined;
                        return (
                          <p className="text-[0.6875rem] text-black/55">
                            {situacao.estado === "em_andamento" ? `Em andamento desde ${comecou}` : `Feito: ${comecou} às ${bloco.terminado_em ? instanteParaHoraLocal(bloco.terminado_em, fuso).hora : ""}`}
                            {atraso !== null && <span style={{ color: corDoAtraso }}> · {textoDoAtraso(atraso)}</span>}
                          </p>
                        );
                      })()}
                    </div>
                    {podeEditar && (
                      <div className="flex shrink-0 items-center gap-1">
                        {aoVivo.get(bloco.id)?.estado === "pendente" && (
                          <button type="button" onClick={() => void marcar(bloco, "comecou")} aria-label="Marcar que o bloco começou" title="Começou" className="flex h-9 items-center gap-1 rounded border border-black/[.14] px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Play size={11} aria-hidden="true" /> Começou</button>
                        )}
                        {aoVivo.get(bloco.id)?.estado === "em_andamento" && (
                          <button type="button" onClick={() => void marcar(bloco, "terminou")} aria-label="Marcar que o bloco terminou" title="Terminou" className="flex h-9 items-center gap-1 rounded bg-[#282525] px-2.5 text-[0.6875rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Square size={11} aria-hidden="true" /> Terminou</button>
                        )}
                        {aoVivo.get(bloco.id)?.estado !== "pendente" && (
                          <button type="button" onClick={() => void marcar(bloco, "desfazer")} aria-label="Desfazer a marcação do bloco" title="Desfazer" className="flex h-9 w-9 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Undo2 size={14} aria-hidden="true" /></button>
                        )}
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
        {organizationId && <DeslocamentosDaData organizationId={organizationId} data={{ id: data.id, data: data.data, fuso }} podeEditar={podeEditar} />}
        {organizationId && <OcorrenciasDaData organizationId={organizationId} data={{ id: data.id, fuso }} podeEditar={podeEditar} />}
        {organizationId && <TarefasDaData organizationId={organizationId} dataId={data.id} tipoDeProducao={(data.temporada?.tipo as TipoProducao | undefined) ?? null} podeEditar={podeEditar} />}
        {organizationId && <LicencasDaData organizationId={organizationId} dataId={data.id} dataDoEvento={data.data} podeEditar={podeEditar} />}
        {organizationId && <AcertosDaData organizationId={organizationId} dataId={data.id} podeEditar={podeEditar} />}
        {organizationId && <ItensDaData organizationId={organizationId} dataId={data.id} podeEditar={podeEditar} />}
        {organizationId && <NotasDaData organizationId={organizationId} dataId={data.id} podeEditar={podeEditar} />}
        {organizationId && <ArquivosDaData organizationId={organizationId} temporadaId={data.temporada_id} dataId={data.id} podeEditar={podeEditar} />}
        {organizationId && <HistoricoDaData dataId={data.id} />}
      </DetailPageContent>

      {salvarModelo && organizationId && (
        <SalvarModeloDoDiaSheet organizationId={organizationId} blocos={blocosParaSalvar} onClose={() => setSalvarModelo(false)} onSaved={recarregar} />
      )}
      {copiar && organizationId && (
        <CopiarDiaSheet organizationId={organizationId} temporadaId={data.temporada_id} dataId={data.id} dia={data.data} fuso={fuso} onClose={() => setCopiar(false)} onCopied={recarregar} />
      )}
      {folha && organizationId && (
        <NovoBlocoSheet organizationId={organizationId} dataId={data.id} dia={data.data} fuso={fuso} proximaOrdem={blocos.length} onClose={() => setFolha(false)} onCreated={recarregar} />
      )}
    </div>
  );
}
