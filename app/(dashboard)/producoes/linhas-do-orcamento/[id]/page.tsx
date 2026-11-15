"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, TriangleAlert } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import type { SituacaoDoOrcamento, SituacaoDoPedido } from "@/lib/producao/estados";
import { emCentavos, formatarReais } from "@/lib/producao/bordero";
import { calcularOrcamento, ROTULO_DA_CATEGORIA_DO_ORCAMENTO, ROTULO_DA_SITUACAO_DO_ORCAMENTO, type LinhaDoOrcamento } from "@/lib/producao/orcamento";
import { comprometidoDoAcordoEmCentavos, ROTULO_DA_SITUACAO_DO_ACORDO } from "@/lib/producao/acordos";
import { ROTULO_DA_SITUACAO_DO_PEDIDO } from "@/lib/producao/pedidos";
import type { VariavelDoOrcamento } from "@/lib/producao/formula";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { LinhaSheet, type AcordoDoOrcamento } from "@/components/producao/OrcamentoDaTemporada";
import { BOTAO_PEQUENO } from "@/components/producao/estilosDoBordero";

type Orcamento = { id: string; nome: string; situacao: SituacaoDoOrcamento; temporada_id: string };
type PedidoDaLinha = { id: string; descricao: string; favorecido: string | null; valor: number; situacao: SituacaoDoPedido };
type PagamentoDaLinha = { lancamento_id: string; valor: number; descricao: string; favorecido: string | null; data: string };
type Detalhe = {
  linha: LinhaDoOrcamento & { orcamento_id: string }; orcamento: Orcamento; temporada: string; variaveis: VariavelDoOrcamento[]; acordos: AcordoDoOrcamento[];
  pedidos: PedidoDaLinha[]; pagamentos: PagamentoDaLinha[];
};

const dia = (data: string) => data.split("-").reverse().join("/");
const reais = (centavos: number | null) => (centavos === null ? "—" : formatarReais(centavos));
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const CAIXA = { borderColor: "rgba(13,13,13,.08)" };

/** Uma linha do orçamento: a conta dela (do estimado ao pago) e de onde vem cada número: o acordo que compromete, os pedidos e os pagamentos lançados. */
export default function LinhaDoOrcamentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const temporadaDaLinha = useRef<string | null>(null);
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [detalhe, setDetalhe] = useState<Detalhe | null | undefined>(undefined);
  const [versao, setVersao] = useState(0);
  const [folha, setFolha] = useState(false);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const lin = await producao.from("producao_orcamento_linhas").select("id, orcamento_id, categoria, descricao, estimativa, aprovado, revisado, comprometido, pago, ordem, formula, acordo_id").eq("id", id).eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      // A linha que a pessoa acabou de apagar: volta para o orçamento em vez de mostrar "não encontrada".
      if (!lin.error && !lin.data && temporadaDaLinha.current) { router.replace(`/producoes/temporadas/${temporadaDaLinha.current}#dinheiro/orcamento`); return; }
      if (lin.error || !lin.data) { setDetalhe(null); return; }
      const linha = lin.data as Detalhe["linha"];
      const orc = await producao.from("producao_orcamentos").select("id, nome, situacao, temporada_id").eq("id", linha.orcamento_id).maybeSingle();
      if (!ativo) return;
      if (orc.error || !orc.data) { setDetalhe(null); return; }
      const orcamento = orc.data as Orcamento;
      temporadaDaLinha.current = orcamento.temporada_id;
      const [tem, vars, aco, ped, div] = await Promise.all([
        producao.from("producao_temporadas").select("titulo").eq("id", orcamento.temporada_id).maybeSingle(),
        producao.from("producao_orcamento_variaveis").select("id, nome, rotulo, valor").eq("orcamento_id", orcamento.id).order("nome"),
        producao.from("producao_acordos").select("id, contraparte, sentido, situacao, valor_fixo, garantia").eq("temporada_id", orcamento.temporada_id).order("created_at"),
        producao.from("producao_pedidos").select("id, descricao, favorecido, valor, situacao").eq("orcamento_linha_id", linha.id).order("created_at"),
        producao.from("producao_lancamento_linhas").select("lancamento_id, valor").eq("orcamento_linha_id", linha.id),
      ]);
      const divisoes = (div.data ?? []) as { lancamento_id: string; valor: number }[];
      const lan = divisoes.length > 0
        ? await producao.from("producao_lancamentos").select("id, descricao, favorecido, data").in("id", divisoes.map(item => item.lancamento_id))
        : { data: [], error: null };
      if (!ativo) return;
      const lancamentos = new Map(((lan.data ?? []) as { id: string; descricao: string; favorecido: string | null; data: string }[]).map(item => [item.id, item]));
      const pagamentos = divisoes
        .flatMap(item => { const dele = lancamentos.get(item.lancamento_id); return dele ? [{ lancamento_id: item.lancamento_id, valor: item.valor, descricao: dele.descricao, favorecido: dele.favorecido, data: dele.data }] : []; })
        .sort((a, b) => a.data.localeCompare(b.data));
      setDetalhe({
        linha, orcamento, temporada: (tem.data as { titulo: string } | null)?.titulo ?? "Temporada",
        variaveis: (vars.data ?? []) as VariavelDoOrcamento[], acordos: (aco.data ?? []) as AcordoDoOrcamento[],
        pedidos: (ped.data ?? []) as PedidoDaLinha[], pagamentos,
      });
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao, router]);

  const contas = useMemo(() => {
    if (!detalhe) return null;
    const acordo = detalhe.acordos.find(item => item.id === detalhe.linha.acordo_id);
    const comprometido = acordo ? comprometidoDoAcordoEmCentavos(acordo) : null;
    const pago = detalhe.pagamentos.length > 0 ? detalhe.pagamentos.reduce((soma, item) => soma + emCentavos(item.valor), 0) : null;
    return calcularOrcamento([detalhe.linha], comprometido === null ? {} : { [detalhe.linha.id]: comprometido }, pago === null ? {} : { [detalhe.linha.id]: pago }).linhas[0];
  }, [detalhe]);

  if (detalhe === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (detalhe === null || !contas) return <DetailNotFound title="Linha do orçamento não encontrada" description="Ela não existe, foi apagada ou você não tem a permissão de dinheiro." backHref="/producoes/temporadas" backLabel="Voltar para Temporadas" />;

  const { linha, orcamento, temporada, variaveis, acordos, pedidos, pagamentos } = detalhe;
  const acordo = acordos.find(item => item.id === linha.acordo_id) ?? null;
  const editavel = podeEditar && orcamento.situacao !== "encerrado";
  const comAprovado = orcamento.situacao !== "rascunho";
  const voltar = `/producoes/temporadas/${orcamento.temporada_id}#dinheiro/orcamento`;
  // A barra mede contra o maior dos três: o pago pode passar do comprometido (pagamento lançado sem acordo nem comprometido digitado).
  const base = Math.max(contas.previstoCentavos, contas.comprometidoCentavos, contas.pagoCentavos, 1);
  const largura = (centavos: number) => `${Math.min(100, (centavos / base) * 100)}%`;

  const numeros: { rotulo: string; valor: number | null; forte?: boolean; texto?: string }[] = [
    { rotulo: "Estimativa", valor: contas.estimativaCentavos, texto: linha.formula ? `pela conta ${linha.formula}` : undefined },
    { rotulo: "Aprovado", valor: contas.aprovadoCentavos },
    { rotulo: "Revisado", valor: contas.revisadoCentavos },
    { rotulo: "Previsto", valor: contas.previstoCentavos, forte: true, texto: "o revisado, senão o aprovado, senão a estimativa" },
    ...(comAprovado ? [{ rotulo: "Variação", valor: contas.variacaoCentavos, texto: "previsto menos aprovado" }] : []),
  ];

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href={voltar} label={temporada} />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={ROTULO}>Linha do orçamento · {orcamento.nome}</p>
              <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{linha.descricao}</h1>
              <p className="mt-1 text-[0.8125rem] tabular-nums text-black/55">{ROTULO_DA_CATEGORIA_DO_ORCAMENTO[linha.categoria]} · {formatarReais(contas.previstoCentavos)} previstos</p>
            </div>
            <span className="rounded border px-3 py-1.5 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>Orçamento {ROTULO_DA_SITUACAO_DO_ORCAMENTO[orcamento.situacao].toLowerCase()}</span>
          </div>
        </div>
      </header>

      <DetailPageContent>
        <section aria-labelledby="linha-andamento" className="rounded border bg-white px-5 py-4" style={CAIXA}>
          <h2 id="linha-andamento" className="text-[0.9375rem] font-semibold text-[#282525]">
            {contas.pagoCentavos > 0 ? `${formatarReais(contas.pagoCentavos)} pagos` : "Nada pago ainda"}
            {contas.aPagarCentavos > 0 ? `, ${formatarReais(contas.aPagarCentavos)} a pagar` : ""}
          </h2>
          <p className="mt-1 max-w-2xl text-[0.8125rem] text-black/60">
            {contas.comprometidoCentavos === 0
              ? `Do previsto de ${formatarReais(contas.previstoCentavos)}, nada está comprometido ainda.`
              : `Do previsto de ${formatarReais(contas.previstoCentavos)}, ${formatarReais(contas.comprometidoCentavos)} já estão comprometidos${contas.aComprometerCentavos > 0 ? ` e ${formatarReais(contas.aComprometerCentavos)} ainda não` : ""}.`}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[.06]" role="img" aria-label={`Pago ${formatarReais(contas.pagoCentavos)}, comprometido ${formatarReais(contas.comprometidoCentavos)}, previsto ${formatarReais(contas.previstoCentavos)}`}>
            <div className="relative h-full">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#2E8932]/35" style={{ width: largura(contas.comprometidoCentavos) }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#2E8932]" style={{ width: largura(contas.pagoCentavos) }} />
            </div>
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.75rem] tabular-nums">
            {[["Pago", contas.pagoCentavos], ["Comprometido", contas.comprometidoCentavos], ["Previsto", contas.previstoCentavos]].map(([rotulo, valor]) => (
              <div key={rotulo as string} className="flex items-baseline gap-1.5"><dt className="text-black/45">{rotulo}</dt><dd className="font-medium text-[#282525]">{formatarReais(valor as number)}</dd></div>
            ))}
          </dl>
          {contas.avisos.map(aviso => <p key={aviso} className="mt-2 flex items-start gap-1.5 text-[0.75rem] text-[#B07A14]"><TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {aviso}</p>)}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <section aria-labelledby="linha-comprometido">
              <h2 id="linha-comprometido" className={`mb-2 ${ROTULO}`}>De onde vem o comprometido</h2>
              <div className="rounded border bg-white px-4 py-3 text-[0.8125rem]" style={CAIXA}>
                {acordo ? (
                  <p className="text-black/65">
                    Do acordo com <Link href={`/producoes/acordos/${acordo.id}`} className="font-medium text-[#282525] underline decoration-black/20 underline-offset-2 hover:decoration-black/50">{acordo.contraparte}</Link> ({ROTULO_DA_SITUACAO_DO_ACORDO[acordo.situacao].toLowerCase()}).
                    {contas.viaAcordo ? ` O valor firme dele, ${formatarReais(contas.comprometidoCentavos)}, vale como o comprometido desta linha.` : " Enquanto ele não for assinado, vale o comprometido digitado na linha."}
                  </p>
                ) : <p className="text-black/65">Digitado na linha{contas.comprometidoCentavos > 0 ? `: ${formatarReais(contas.comprometidoCentavos)}` : ""}. Ligue a linha a um acordo (em “Editar”) para o comprometido vir dele quando for assinado.</p>}
              </div>
            </section>

            <section aria-labelledby="linha-pagamentos">
              <h2 id="linha-pagamentos" className={`mb-2 ${ROTULO}`}>Pagamentos lançados</h2>
              <div className="rounded border bg-white" style={CAIXA}>
                {pagamentos.length === 0 ? (
                  <p className="px-4 py-3 text-[0.8125rem] text-black/55">
                    Nenhum pagamento lançado nesta linha.{contas.pagoCentavos > 0 ? ` O pago de ${formatarReais(contas.pagoCentavos)} foi digitado na linha.` : ""} Os pagamentos se lançam em <Link href={`/producoes/temporadas/${orcamento.temporada_id}#dinheiro/pagar`} className="font-medium text-[#282525] underline decoration-black/20 underline-offset-2 hover:decoration-black/50">Pedidos e pagamentos</Link>.
                  </p>
                ) : (
                  <ul className="divide-y divide-black/[.06]">
                    {pagamentos.map(item => (
                      <li key={item.lancamento_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[0.8125rem]">
                        <span className="w-24 shrink-0 tabular-nums text-black/55">{dia(item.data)}</span>
                        <span className="min-w-0 flex-1 basis-40 truncate text-[#282525]">{item.descricao}{item.favorecido ? <span className="text-black/45"> · {item.favorecido}</span> : null}</span>
                        <span className="w-28 shrink-0 text-right tabular-nums text-[#282525]">{formatarReais(emCentavos(item.valor))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="linha-pedidos">
              <h2 id="linha-pedidos" className={`mb-2 ${ROTULO}`}>Pedidos de pagamento</h2>
              <div className="rounded border bg-white" style={CAIXA}>
                {pedidos.length === 0 ? <p className="px-4 py-3 text-[0.8125rem] text-black/55">Nenhum pedido ligado a esta linha.</p> : (
                  <ul className="divide-y divide-black/[.06]">
                    {pedidos.map(pedido => (
                      <li key={pedido.id}>
                        <Link href={`/producoes/pedidos/${pedido.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[0.8125rem] transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
                          <span className="min-w-0 flex-1 basis-40 truncate text-[#282525]">{pedido.descricao}{pedido.favorecido ? <span className="text-black/45"> · {pedido.favorecido}</span> : null}</span>
                          <span className="tabular-nums text-[#282525]">{formatarReais(emCentavos(pedido.valor))}</span>
                          <span className="rounded border px-2 py-0.5 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_PEDIDO[pedido.situacao]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <aside>
            <section aria-labelledby="linha-dados" className="rounded border bg-white px-4 py-3" style={CAIXA}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="linha-dados" className={ROTULO}>Valores da linha</h2>
                {editavel && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha(true)}><Pencil size={11} aria-hidden="true" className="mr-1 inline" />Editar</button>}
              </div>
              <dl className="space-y-2.5 text-[0.8125rem]">
                {numeros.map(item => (
                  <div key={item.rotulo}>
                    <dt className={ROTULO}>{item.rotulo}</dt>
                    <dd className={`mt-0.5 tabular-nums ${item.valor === null || item.valor === 0 ? "text-black/30" : "text-[#282525]"} ${item.forte ? "font-semibold" : ""}`}>
                      {item.rotulo === "Variação" && item.valor !== null && item.valor > 0 ? "+" : ""}{item.rotulo === "Variação" && item.valor !== null && item.valor < 0 ? "−" + formatarReais(-item.valor) : reais(item.valor)}
                    </dd>
                    {item.texto && <dd className="text-[0.6875rem] text-black/45">{item.texto}</dd>}
                  </div>
                ))}
              </dl>
              {orcamento.situacao === "aprovado" && <p className="mt-3 text-[0.6875rem] text-black/45">Com o orçamento aprovado, a estimativa e o aprovado não mudam; o revisado sim.</p>}
            </section>
          </aside>
        </div>
      </DetailPageContent>

      {folha && organizationId && (
        <LinhaSheet organizationId={organizationId} orcamentoId={orcamento.id} situacao={orcamento.situacao} linha={linha} variaveis={variaveis} acordos={acordos}
          pagoDosLancamentos={pagamentos.length > 0 ? contas.pagoCentavos : null} onClose={() => setFolha(false)} onSalvou={() => setVersao(atual => atual + 1)} />
      )}
    </div>
  );
}
