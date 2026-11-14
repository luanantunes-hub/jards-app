"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Copy, Pencil } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { SituacaoDoAcordo } from "@/lib/producao/estados";
import { diaEMes } from "@/lib/producao/agenda";
import { emCentavos, formatarReais } from "@/lib/producao/bordero";
import {
  acordoTravado, comprometidoDoAcordoEmCentavos, mensagemDoErroDeAcordo, proximaSituacaoDoAcordo, ROTULO_DA_SITUACAO_DO_ACORDO, ROTULO_DO_SENTIDO_DO_ACORDO,
  ROTULO_DO_TIPO_DE_ACORDO, situacaoAnteriorDoAcordo, textoDoAcordo, valorFirmeDoAcordoEmCentavos, type AcordoDaTemporada,
} from "@/lib/producao/acordos";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { AcordoSheet, type DataDaTemporada } from "@/components/producao/AcordosDaTemporada";
import { BOTAO, BOTAO_PEQUENO, Erro } from "@/components/producao/estilosDoBordero";

type FaturaLigada = { id: string; descricao: string; contratante: string; situacao: string };
type LinhaLigada = { id: string; descricao: string; categoria: string };
type Detalhe = {
  acordo: AcordoDaTemporada & { created_at: string; temporada_id: string }; datas: DataDaTemporada[]; cobertas: string[]; temporada: string;
  faturas: FaturaLigada[]; linhas: LinhaLigada[];
};

const dia = (data: string) => data.split("-").reverse().join("/");
const ROTULO_DO_PASSO: Record<SituacaoDoAcordo, string> = { rascunho: "Enviar para revisão", revisao: "Mandar para assinatura", para_assinatura: "Marcar como assinado", assinado: "Encerrar", encerrado: "" };

/** A frase que diz onde o acordo está e o que isso significa, em palavras de quem usa. */
function ondeEsta(acordo: AcordoDaTemporada): { titulo: string; texto: string } {
  const compromete = acordo.sentido === "a_pagar";
  switch (acordo.situacao) {
    case "rascunho": return { titulo: "Ainda é um rascunho", texto: "Confira as condições e as datas e envie para revisão. Enquanto não é assinado, tudo pode mudar." };
    case "revisao": return { titulo: "Em revisão", texto: "Confira o que foi combinado com a outra parte. Estando certo, mande para assinatura." };
    case "para_assinatura": return { titulo: "Esperando a assinatura", texto: "Quando o acordo for assinado, marque aqui com o dia da assinatura. Depois disso, as condições, a contraparte e as datas não mudam." };
    case "assinado": return {
      titulo: "Assinado",
      texto: `As condições, a contraparte e as datas não mudam mais. ${compromete ? "O valor firme já conta como comprometido na linha do orçamento a que o acordo está ligado." : "É um acordo a receber: ele não compromete o orçamento."} Quando terminar, encerre.`,
    };
    case "encerrado": return { titulo: "Encerrado", texto: "O acordo terminou: nada mais muda." };
  }
}

/** O acordo: onde está, as condições, as datas que cobre, o que está ligado a ele e os dados para conferir ou editar. */
export default function AcordoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const temporadaDoAcordo = useRef<string | null>(null);
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [detalhe, setDetalhe] = useState<Detalhe | null | undefined>(undefined);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [folha, setFolha] = useState(false);
  const [assinando, setAssinando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const aco = await producao.from("producao_acordos").select("id, temporada_id, contraparte, tipo, sentido, situacao, valor_fixo, garantia, percentual_bilheteria, bonus_publico, bonus_valor, despesas_nossas, despesas_da_contraparte, retencoes, observacao, assinado_em, created_at").eq("id", id).eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      // O acordo que a pessoa acabou de apagar: volta para a temporada em vez de mostrar "não encontrado".
      if (!aco.error && !aco.data && temporadaDoAcordo.current) { router.replace(`/producoes/temporadas/${temporadaDoAcordo.current}#dinheiro/acordos`); return; }
      if (aco.error || !aco.data) { setDetalhe(null); return; }
      const acordo = aco.data as Detalhe["acordo"];
      temporadaDoAcordo.current = acordo.temporada_id;
      const [tem, dat, cob, fat, lin] = await Promise.all([
        producao.from("producao_temporadas").select("titulo").eq("id", acordo.temporada_id).maybeSingle(),
        producao.from("producao_datas").select("id, data").eq("temporada_id", acordo.temporada_id).order("data"),
        producao.from("producao_acordo_datas").select("data_id").eq("acordo_id", acordo.id),
        producao.from("producao_faturas").select("id, descricao, contratante, situacao").eq("acordo_id", acordo.id).order("created_at"),
        producao.from("producao_orcamento_linhas").select("id, descricao, categoria").eq("acordo_id", acordo.id).order("ordem"),
      ]);
      if (!ativo) return;
      setDetalhe({
        acordo, datas: (dat.data ?? []) as DataDaTemporada[], cobertas: ((cob.data ?? []) as { data_id: string }[]).map(item => item.data_id),
        temporada: (tem.data as { titulo: string } | null)?.titulo ?? "Temporada", faturas: (fat.data ?? []) as FaturaLigada[], linhas: (lin.data ?? []) as LinhaLigada[],
      });
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao, router]);

  const rotuloDaData = useMemo(() => new Map((detalhe?.datas ?? []).map(item => [item.id, diaEMes(item.data)])), [detalhe]);

  if (detalhe === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (detalhe === null) return <DetailNotFound title="Acordo não encontrado" description="Ele não existe, foi apagado ou você não tem a permissão de dinheiro." backHref="/producoes/temporadas" backLabel="Voltar para Temporadas" />;

  const { acordo, datas, cobertas, temporada, faturas, linhas } = detalhe;
  const situacao = ondeEsta(acordo);
  const proxima = proximaSituacaoDoAcordo(acordo.situacao);
  const anterior = situacaoAnteriorDoAcordo(acordo.situacao);
  const travado = acordoTravado(acordo.situacao);
  const nomesDasDatas = cobertas.map(dataId => rotuloDaData.get(dataId) ?? "").filter(Boolean);
  const firme = valorFirmeDoAcordoEmCentavos(acordo);
  const comprometido = comprometidoDoAcordoEmCentavos(acordo);
  const voltar = `/producoes/temporadas/${acordo.temporada_id}#dinheiro/acordos`;
  const mudou = () => setVersao(atual => atual + 1);

  async function mudarSituacao(nova: SituacaoDoAcordo, assinadoEm?: string) {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_acordos").update(nova === "assinado" && assinadoEm ? { situacao: nova, assinado_em: assinadoEm } : { situacao: nova }).eq("id", acordo.id);
    setTrabalhando(false);
    setAssinando(null);
    if (error) { setErro(mensagemDoErroDeAcordo(error)); return; }
    mudou();
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(textoDoAcordo(acordo, nomesDasDatas)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  const linhaDoTempo = [
    { quando: acordo.created_at.slice(0, 10), texto: "Acordo criado" },
    ...(acordo.assinado_em ? [{ quando: acordo.assinado_em, texto: "Acordo assinado" }] : []),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  const condicoes: [string, string][] = [
    ["Valor fixo", acordo.valor_fixo === null ? "—" : formatarReais(emCentavos(acordo.valor_fixo))],
    ["Garantia", acordo.garantia === null ? "—" : formatarReais(emCentavos(acordo.garantia))],
    ["% da bilheteria", acordo.percentual_bilheteria === null ? "—" : `${acordo.percentual_bilheteria.toLocaleString("pt-BR")}%`],
    ["Bônus", acordo.bonus_publico !== null && acordo.bonus_valor !== null ? `${formatarReais(emCentavos(acordo.bonus_valor))} a partir de ${acordo.bonus_publico.toLocaleString("pt-BR")} pessoas` : "—"],
  ];
  const textos: [string, string | null][] = [
    ["Despesas por nossa conta", acordo.despesas_nossas],
    [`Despesas por conta de ${acordo.contraparte}`, acordo.despesas_da_contraparte],
    ["Retenções", acordo.retencoes],
  ];

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href={voltar} label={temporada} />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Acordo</p>
              <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{acordo.contraparte}</h1>
              <p className="mt-1 text-[0.8125rem] text-black/55">{ROTULO_DO_TIPO_DE_ACORDO[acordo.tipo]} · {acordo.sentido === "a_pagar" ? "Nós pagamos" : "Nós recebemos"}</p>
            </div>
            <span className="rounded border px-3 py-1.5 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>
              {ROTULO_DA_SITUACAO_DO_ACORDO[acordo.situacao]}{acordo.assinado_em ? ` em ${dia(acordo.assinado_em)}` : ""}
            </span>
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <div className="mb-4"><Erro texto={erro} /></div>}

        <section aria-labelledby="acordo-onde" className="rounded border bg-white px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id="acordo-onde" className="text-[0.9375rem] font-semibold text-[#282525]">{situacao.titulo}</h2>
          <p className="mt-1 max-w-2xl text-[0.8125rem] text-black/60">{situacao.texto}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {podeEditar && proxima && assinando === null && (
              <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => (proxima === "assinado" ? setAssinando(new Date().toISOString().slice(0, 10)) : void mudarSituacao(proxima))}>{ROTULO_DO_PASSO[acordo.situacao]}</button>
            )}
            {podeEditar && anterior && assinando === null && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => void mudarSituacao(anterior)}>Voltar para {ROTULO_DA_SITUACAO_DO_ACORDO[anterior].toLowerCase()}</button>}
            {assinando !== null && (
              <span className="flex flex-wrap items-center gap-1.5 rounded border bg-white px-2 py-1" style={{ borderColor: "#B07A1447" }}>
                <label className="text-[0.6875rem] text-[#B07A14]" htmlFor="acordo-assinado-em">Assinado em</label>
                <input id="acordo-assinado-em" type="date" className="h-8 rounded border border-black/[.12] bg-white px-2 text-[0.75rem]" value={assinando} onChange={event => setAssinando(event.target.value)} />
                <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando || !/^\d{4}-\d{2}-\d{2}$/.test(assinando)} onClick={() => void mudarSituacao("assinado", assinando)}>Confirmar</button>
                <button type="button" className={BOTAO_PEQUENO} onClick={() => setAssinando(null)}>Voltar</button>
              </span>
            )}
            <button type="button" className={BOTAO} onClick={() => void copiar()}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar o acordo"}</button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <section aria-labelledby="acordo-condicoes">
              <h2 id="acordo-condicoes" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Condições</h2>
              <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <dl className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4 gap-y-3">
                  {condicoes.map(([rotulo, valor]) => (
                    <div key={rotulo} className="min-w-0">
                      <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</dt>
                      <dd className={`mt-1 text-[0.9375rem] tabular-nums ${valor === "—" ? "text-black/30" : "font-medium text-[#282525]"}`}>{valor}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="mt-4 space-y-3 border-t border-black/[.06] pt-3">
                  {textos.map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</dt>
                      <dd className={`mt-0.5 whitespace-pre-line text-[0.8125rem] ${valor ? "text-[#282525]" : "text-black/30"}`}>{valor ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section aria-labelledby="acordo-datas">
              <h2 id="acordo-datas" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Datas cobertas</h2>
              <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {nomesDasDatas.length === 0
                  ? <p className="text-[0.75rem] text-black/45">{datas.length === 0 ? "A temporada ainda não tem datas." : "Nenhuma data ligada a este acordo."}{podeEditar && !travado && datas.length > 0 ? " Use “Editar” para escolher." : ""}</p>
                  : <ul className="flex flex-wrap gap-2">{nomesDasDatas.map(nome => <li key={nome} className="rounded border bg-white px-2.5 py-1 text-[0.75rem] tabular-nums text-[#282525]" style={{ borderColor: "rgba(13,13,13,.15)" }}>{nome}</li>)}</ul>}
              </div>
            </section>

            {(faturas.length > 0 || linhas.length > 0) && (
              <section aria-labelledby="acordo-ligacoes">
                <h2 id="acordo-ligacoes" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Ligado a este acordo</h2>
                <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <ul className="divide-y divide-black/[.06]">
                    {linhas.map(linha => (
                      <li key={linha.id} className="px-4 py-2.5 text-[0.8125rem]">
                        <span className="text-[#282525]">{linha.descricao}</span> <span className="text-black/45">· linha do orçamento ({linha.categoria})</span>
                      </li>
                    ))}
                    {faturas.map(fatura => (
                      <li key={fatura.id}>
                        <Link href={`/producoes/faturas/${fatura.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.8125rem] transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                          <span className="min-w-0 truncate"><span className="text-[#282525]">{fatura.contratante} · {fatura.descricao}</span> <span className="text-black/45">· fatura</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <section aria-labelledby="acordo-historia">
              <h2 id="acordo-historia" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Linha do tempo</h2>
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
            <section aria-labelledby="acordo-dados" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="acordo-dados" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Dados do acordo</h2>
                {podeEditar && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha(true)}><Pencil size={11} aria-hidden="true" className="mr-1 inline" />{travado ? "Ver" : "Editar"}</button>}
              </div>
              <dl className="space-y-2.5 text-[0.8125rem]">
                {[
                  ["Com quem", acordo.contraparte],
                  ["Tipo", ROTULO_DO_TIPO_DE_ACORDO[acordo.tipo]],
                  ["Sentido", ROTULO_DO_SENTIDO_DO_ACORDO[acordo.sentido]],
                  ["Valor firme", firme > 0 ? formatarReais(firme) : "—"],
                  ["Comprometido no orçamento", comprometido === null ? "Ainda não" : formatarReais(comprometido)],
                  ["Observação", acordo.observacao ?? "—"],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-[#282525]">{valor}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[0.6875rem] text-black/45">O valor firme é o maior entre o valor fixo e a garantia. O percentual da bilheteria e o bônus só se sabem depois da sessão.</p>
            </section>
          </aside>
        </div>
      </DetailPageContent>

      {folha && organizationId && <AcordoSheet organizationId={organizationId} temporadaId={acordo.temporada_id} acordo={acordo} datas={datas} cobertas={cobertas} onClose={() => setFolha(false)} onSalvou={mudou} />}
    </div>
  );
}
