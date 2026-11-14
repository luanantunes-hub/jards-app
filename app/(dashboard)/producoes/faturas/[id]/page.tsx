"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, TriangleAlert } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { SituacaoDaFatura } from "@/lib/producao/estados";
import { emCentavos, formatarReais } from "@/lib/producao/bordero";
import {
  calcularFatura, faturaEmitida, liquidoDaFaturaEmCentavos, mensagemDoErroDeFatura, proximaSituacaoDaFatura, ROTULO_DA_SITUACAO_DA_FATURA, situacaoAnteriorDaFatura,
  type FaturaDaTemporada, type ParcelaDaFatura,
} from "@/lib/producao/faturas";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { FaturaSheet, type AcordoAReceber } from "@/components/producao/FaturasDaTemporada";
import { BOTAO, BOTAO_PEQUENO, Erro } from "@/components/producao/estilosDoBordero";

type Detalhe = { fatura: FaturaDaTemporada & { created_at: string; temporada_id: string }; parcelas: ParcelaDaFatura[]; temporada: string; acordos: AcordoAReceber[] };

const dia = (data: string) => data.split("-").reverse().join("/");
const ROTULO_DO_PASSO: Record<SituacaoDaFatura, string> = { rascunho: "Enviar para revisão", revisao: "Abrir a fatura", em_aberto: "Quitar", quitada: "" };

/** A frase que diz onde a fatura está e o que falta, em palavras de quem usa. */
function ondeEsta(fatura: FaturaDaTemporada, conta: ReturnType<typeof calcularFatura>): { titulo: string; texto: string } {
  switch (fatura.situacao) {
    case "rascunho": return { titulo: "Ainda é um rascunho", texto: "Confira os dados e as parcelas e envie para revisão." };
    case "revisao": return { titulo: "Em revisão", texto: "Confira a nota e as parcelas com o contratante. Quando estiver certo, abra a fatura: depois de aberta, o valor, as retenções e as parcelas não mudam." };
    case "em_aberto": return {
      titulo: conta.atrasadoCentavos > 0 ? "Em aberto, com parcela atrasada" : "Em aberto, falta receber",
      texto: `Já recebido ${formatarReais(conta.recebidoCentavos)}; falta receber ${formatarReais(conta.aReceberCentavos)}${conta.atrasadoCentavos > 0 ? `, dos quais ${formatarReais(conta.atrasadoCentavos)} estão atrasados` : ""}. Marque cada parcela como recebida quando o dinheiro entrar.`,
    };
    case "quitada": return { titulo: "Quitada", texto: `Tudo recebido: ${formatarReais(conta.recebidoCentavos)}. O valor, as retenções e as parcelas não mudam mais.` };
  }
}

/** A fatura ao contratante: onde está, o que falta receber, as parcelas com as ações de cada uma e os dados da cobrança. */
export default function FaturaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const temporadaDaFatura = useRef<string | null>(null);
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [detalhe, setDetalhe] = useState<Detalhe | null | undefined>(undefined);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [folha, setFolha] = useState(false);
  const [acaoDaParcela, setAcaoDaParcela] = useState<{ id: string; modo: "recebida" | "vencimento"; dia: string } | null>(null);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const fat = await producao.from("producao_faturas").select("id, temporada_id, acordo_id, contratante, descricao, situacao, valor, retencoes, nota_numero, emissao, vencimento, observacao, created_at").eq("id", id).eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      // A fatura que a pessoa acabou de apagar: volta para a temporada em vez de mostrar "não encontrada".
      if (!fat.error && !fat.data && temporadaDaFatura.current) { router.replace(`/producoes/temporadas/${temporadaDaFatura.current}#dinheiro/receber`); return; }
      if (fat.error || !fat.data) { setDetalhe(null); return; }
      const fatura = fat.data as Detalhe["fatura"];
      temporadaDaFatura.current = fatura.temporada_id;
      const [tem, par, aco] = await Promise.all([
        producao.from("producao_temporadas").select("titulo").eq("id", fatura.temporada_id).maybeSingle(),
        producao.from("producao_fatura_parcelas").select("id, fatura_id, rotulo, valor, vencimento, recebido_em").eq("fatura_id", fatura.id).order("vencimento"),
        producao.from("producao_acordos").select("id, contraparte").eq("temporada_id", fatura.temporada_id).eq("sentido", "a_receber").order("created_at"),
      ]);
      if (!ativo) return;
      setDetalhe({ fatura, parcelas: (par.data ?? []) as ParcelaDaFatura[], temporada: (tem.data as { titulo: string } | null)?.titulo ?? "Temporada", acordos: (aco.data ?? []) as AcordoAReceber[] });
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao, router]);

  const conta = useMemo(() => (detalhe ? calcularFatura(detalhe.fatura, detalhe.parcelas, hoje) : null), [detalhe, hoje]);

  if (detalhe === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (detalhe === null || conta === null) return <DetailNotFound title="Fatura não encontrada" description="Ela não existe, foi apagada ou você não tem a permissão de dinheiro." backHref="/producoes/temporadas" backLabel="Voltar para Temporadas" />;

  const { fatura, parcelas, temporada, acordos } = detalhe;
  const situacao = ondeEsta(fatura, conta);
  const proxima = proximaSituacaoDaFatura(fatura.situacao);
  const anterior = situacaoAnteriorDaFatura(fatura.situacao);
  const emitida = faturaEmitida(fatura.situacao);
  const proporcao = conta.liquidoCentavos > 0 ? Math.min(100, Math.round((conta.recebidoCentavos / conta.liquidoCentavos) * 100)) : 0;
  const acordo = acordos.find(item => item.id === fatura.acordo_id)?.contraparte ?? null;
  const voltar = `/producoes/temporadas/${fatura.temporada_id}#dinheiro/receber`;
  const mudou = () => setVersao(atual => atual + 1);

  async function mudarSituacao(nova: SituacaoDaFatura) {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_faturas").update({ situacao: nova }).eq("id", fatura.id);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeFatura(error)); return; }
    mudou();
  }

  async function gravarParcela() {
    if (!acaoDaParcela) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(acaoDaParcela.dia)) { setErro("Escolha a data."); return; }
    setTrabalhando(true);
    setErro(null);
    const valores = acaoDaParcela.modo === "recebida" ? { recebido_em: acaoDaParcela.dia } : { vencimento: acaoDaParcela.dia };
    const { error } = await clienteDaProducao(createClient()).from("producao_fatura_parcelas").update(valores).eq("id", acaoDaParcela.id);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeFatura(error)); return; }
    setAcaoDaParcela(null);
    mudou();
  }

  async function desfazerRecebimento(parcelaId: string) {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_fatura_parcelas").update({ recebido_em: null }).eq("id", parcelaId);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeFatura(error)); return; }
    mudou();
  }

  const linhaDoTempo = [
    { quando: fatura.created_at.slice(0, 10), texto: "Fatura criada" },
    ...(fatura.emissao ? [{ quando: fatura.emissao, texto: `Nota${fatura.nota_numero ? ` ${fatura.nota_numero}` : ""} emitida` }] : []),
    ...parcelas.filter(parcela => parcela.recebido_em).map(parcela => ({ quando: parcela.recebido_em as string, texto: `${parcela.rotulo ?? "Parcela"} recebida (${formatarReais(emCentavos(parcela.valor))})` })),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href={voltar} label={temporada} />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Fatura</p>
              <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{fatura.descricao}</h1>
              <p className="mt-1 text-[0.8125rem] tabular-nums text-black/55">{fatura.contratante} · {formatarReais(liquidoDaFaturaEmCentavos(fatura))} a receber</p>
            </div>
            <span className="rounded border px-3 py-1.5 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DA_FATURA[fatura.situacao]}</span>
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <div className="mb-4"><Erro texto={erro} /></div>}

        <section aria-labelledby="fatura-onde" className="rounded border bg-white px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id="fatura-onde" className="text-[0.9375rem] font-semibold text-[#282525]">{situacao.titulo}</h2>
          <p className="mt-1 max-w-2xl text-[0.8125rem] text-black/60">{situacao.texto}</p>
          {conta.avisos.filter(aviso => !/atrasada|atrasadas/.test(aviso)).map(aviso => <p key={aviso} className="mt-2 flex items-start gap-1.5 text-[0.75rem] text-[#B07A14]"><TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {aviso}</p>)}
          {podeEditar && (proxima || anterior) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {proxima && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => void mudarSituacao(proxima)}>{ROTULO_DO_PASSO[fatura.situacao]}</button>}
              {anterior && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => void mudarSituacao(anterior)}>Voltar para {ROTULO_DA_SITUACAO_DA_FATURA[anterior].toLowerCase().replace("em revisão", "revisão")}</button>}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <section aria-labelledby="fatura-parcelas">
              <h2 id="fatura-parcelas" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Parcelas</h2>
              <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-baseline justify-between gap-3 text-[0.75rem] tabular-nums text-black/55">
                  <span>{formatarReais(conta.recebidoCentavos)} recebidos</span>
                  <span>de {formatarReais(conta.liquidoCentavos)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[.06]" role="img" aria-label={`${proporcao}% do valor líquido já foi recebido`}>
                  <div className="h-full rounded-full bg-[#2E8932]" style={{ width: `${proporcao}%` }} />
                </div>
                {parcelas.length === 0 ? (
                  <p className="mt-3 text-[0.75rem] text-black/45">Sem parcelas. Abra “Editar” para gerar as parcelas; a fatura só abre com elas somando o valor líquido.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-black/[.06]">
                    {parcelas.map(parcela => {
                      const atrasada = conta.parcelasAtrasadas.includes(parcela.id);
                      const editando = acaoDaParcela?.id === parcela.id ? acaoDaParcela : null;
                      return (
                        <li key={parcela.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 text-[0.8125rem]">
                          <span className="w-24 shrink-0 text-black/65">{parcela.rotulo ?? "Parcela"}</span>
                          <span className="w-28 shrink-0 tabular-nums text-[#282525]">{formatarReais(emCentavos(parcela.valor))}</span>
                          <span className="w-24 shrink-0 tabular-nums text-black/55">{dia(parcela.vencimento)}</span>
                          <span className={`min-w-[7rem] flex-1 ${parcela.recebido_em ? "text-black/55" : atrasada ? "text-[#B23B3B]" : "text-black/45"}`}>{parcela.recebido_em ? `Recebida em ${dia(parcela.recebido_em)}` : atrasada ? "Atrasada" : emitida ? "A receber" : ""}</span>
                          {podeEditar && fatura.situacao === "em_aberto" && !editando && (
                            <span className="flex gap-1.5">
                              {parcela.recebido_em
                                ? <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => void desfazerRecebimento(parcela.id)}>Desfazer recebimento</button>
                                : <>
                                  <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => setAcaoDaParcela({ id: parcela.id, modo: "recebida", dia: hoje })}>Marcar recebida</button>
                                  <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => setAcaoDaParcela({ id: parcela.id, modo: "vencimento", dia: parcela.vencimento })}>Mudar vencimento</button>
                                </>}
                            </span>
                          )}
                          {editando && (
                            <span className="flex basis-full flex-wrap items-center gap-1.5 rounded border bg-white px-2 py-1" style={{ borderColor: "#B07A1447" }}>
                              <label className="text-[0.6875rem] text-[#B07A14]" htmlFor={`parcela-${parcela.id}`}>{editando.modo === "recebida" ? "Recebida em" : "Novo vencimento"}</label>
                              <input id={`parcela-${parcela.id}`} type="date" className="h-8 rounded border border-black/[.12] bg-white px-2 text-[0.75rem]" value={editando.dia} onChange={event => setAcaoDaParcela({ ...editando, dia: event.target.value })} />
                              <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => void gravarParcela()}>Confirmar</button>
                              <button type="button" className={BOTAO_PEQUENO} onClick={() => setAcaoDaParcela(null)}>Voltar</button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="fatura-historia">
              <h2 id="fatura-historia" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Linha do tempo</h2>
              <ol className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {linhaDoTempo.map((item, indice) => (
                  <li key={`${item.quando}-${indice}`} className="flex gap-4 py-1.5 text-[0.8125rem]">
                    <span className="w-24 shrink-0 tabular-nums text-black/45">{dia(item.quando)}</span>
                    <span className="text-[#282525]">{item.texto}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-4">
            <section aria-labelledby="fatura-dados" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="fatura-dados" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Dados da fatura</h2>
                {podeEditar && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha(true)}><Pencil size={11} aria-hidden="true" className="mr-1 inline" />{fatura.situacao === "quitada" ? "Ver" : "Editar"}</button>}
              </div>
              <dl className="space-y-2.5 text-[0.8125rem]">
                {[
                  ["Contratante", fatura.contratante],
                  ["Valor", formatarReais(emCentavos(fatura.valor))],
                  ["Retenções", fatura.retencoes > 0 ? formatarReais(emCentavos(fatura.retencoes)) : "—"],
                  ["Valor líquido", formatarReais(liquidoDaFaturaEmCentavos(fatura))],
                  ["Nota emitida", fatura.nota_numero ?? "—"],
                  ["Emissão", fatura.emissao ? dia(fatura.emissao) : "—"],
                  ["Vencimento geral", fatura.vencimento ? dia(fatura.vencimento) : "—"],
                  ["Acordo ligado", acordo ?? "—"],
                  ["Observação", fatura.observacao ?? "—"],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</dt>
                    <dd className="mt-0.5 text-[#282525]">{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </DetailPageContent>

      {folha && organizationId && <FaturaSheet organizationId={organizationId} temporadaId={fatura.temporada_id} fatura={fatura} parcelasAtuais={parcelas} acordos={acordos} onClose={() => setFolha(false)} onSalvou={mudou} />}
    </div>
  );
}
