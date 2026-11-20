"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowUpRight, Pencil, TriangleAlert } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { emCentavos, formatarReais } from "@/lib/producao/dinheiro";
import { ROTULO_DA_CATEGORIA_DO_ORCAMENTO } from "@/lib/producao/orcamento";
import type { CategoriaDoOrcamento } from "@/lib/producao/estados";
import {
  mensagemDoErroDePedido, passosDoPedido, pedidoEditavel, pendenciaEditavel, pendenciaVencida, ROTULO_DA_SITUACAO_DO_PEDIDO, ROTULO_DO_PASSO_DO_PEDIDO, type PassoDoPedido, type PedidoDaTemporada,
} from "@/lib/producao/pedidos";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PedidoSheet, type LinhaDisponivel } from "@/components/producao/PedidosDaTemporada";
import { BOTAO, BOTAO_PEQUENO, CAMPO } from "@/components/producao/estilos";

type Lancamento = { id: string; descricao: string; data: string; valor: number; documento: string | null };
type Detalhe = { pedido: PedidoDaTemporada & { created_at: string; temporada_id: string }; temporada: string; linhas: LinhaDisponivel[]; lancamentos: Lancamento[]; nomes: Record<string, string>; eu: string | null };

const dia = (data: string) => data.split("-").reverse().join("/");
const diaHora = (instante: string) => new Date(instante).toLocaleDateString("pt-BR");

/** A frase que diz onde o pedido está e o que falta, em palavras de quem usa. */
function ondeEsta(pedido: PedidoDaTemporada, nome: (id: string | null) => string, lancadoCentavos: number): { titulo: string; texto: string } {
  const valor = emCentavos(pedido.valor);
  switch (pedido.situacao) {
    case "rascunho": return { titulo: "Ainda é um rascunho", texto: "Confira os dados e envie para aprovação. Depois de enviado, o valor e a descrição não mudam." };
    case "pendente": return { titulo: "Aguardando aprovação", texto: "Quem tem alçada para este valor precisa aprovar ou recusar. Quem pediu não aprova o próprio pedido (só o administrador)." };
    case "aprovado": return { titulo: "Aprovado, falta pagar", texto: `Aprovado por ${nome(pedido.aprovado_por)}${pedido.aprovado_em ? ` em ${diaHora(pedido.aprovado_em)}` : ""}. Quando o pagamento começar, marque "Começar a pagar" e lance os pagamentos.` };
    case "pagando": return { titulo: "Pagando", texto: `Os lançamentos ligados somam ${formatarReais(lancadoCentavos)} de ${formatarReais(valor)}.${lancadoCentavos >= valor ? " Já dá para marcar como pago." : ` Faltam ${formatarReais(valor - lancadoCentavos)}.`}` };
    case "pago": return { titulo: "Pago", texto: `Os lançamentos ligados somam ${formatarReais(lancadoCentavos)}. Nada mais muda neste pedido.` };
    case "recusado": return { titulo: "Recusado", texto: `${nome(pedido.aprovado_por)} recusou${pedido.motivo_recusa ? `: ${pedido.motivo_recusa}` : "."} Dá para reabrir, ajustar e pedir de novo.` };
  }
}

/** O pedido de pagamento: onde está, o que falta, quem pediu e decidiu, os pagamentos ligados e o que fazer agora. */
export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const temporadaDoPedido = useRef<string | null>(null);
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [detalhe, setDetalhe] = useState<Detalhe | null | undefined>(undefined);
  const [podeAprovar, setPodeAprovar] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [folha, setFolha] = useState(false);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const supabase = createClient();
      const producao = clienteDaProducao(supabase);
      const [ped, aprovar, sessao] = await Promise.all([
        producao.from("producao_pedidos").select("id, temporada_id, orcamento_linha_id, solicitante_id, descricao, favorecido, valor, justificativa, situacao, aprovado_por, aprovado_em, motivo_recusa, pendencia, pendencia_ate, created_at").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao.rpc("auth_producao_pode", { p_org: organizationId, p_acao: "aprovar" }),
        supabase.auth.getUser(),
      ]);
      if (!ativo) return;
      setPodeAprovar(aprovar.data === true);
      // O pedido que a pessoa acabou de apagar: volta para a temporada em vez de mostrar "não encontrado".
      if (!ped.error && !ped.data && temporadaDoPedido.current) { router.replace(`/producoes/temporadas/${temporadaDoPedido.current}#dinheiro/pagar`); return; }
      if (ped.error || !ped.data) { setDetalhe(null); return; }
      const pedido = ped.data as Detalhe["pedido"];
      temporadaDoPedido.current = pedido.temporada_id;
      const [tem, orc, lan] = await Promise.all([
        producao.from("producao_temporadas").select("titulo").eq("id", pedido.temporada_id).maybeSingle(),
        producao.from("producao_orcamentos").select("id, nome").eq("temporada_id", pedido.temporada_id).order("created_at"),
        producao.from("producao_lancamentos").select("id, descricao, data, valor, documento").eq("pedido_id", pedido.id).order("data"),
      ]);
      const orcamentos = (orc.data ?? []) as { id: string; nome: string }[];
      const lin = orcamentos.length > 0 ? await producao.from("producao_orcamento_linhas").select("id, orcamento_id, categoria, descricao").in("orcamento_id", orcamentos.map(item => item.id)).order("descricao") : { data: [] };
      const usuarios = [pedido.solicitante_id, pedido.aprovado_por].filter((valor): valor is string => valor !== null);
      const pes = usuarios.length > 0 ? await producao.from("producao_pessoas").select("nome, user_id").eq("organization_id", organizationId).in("user_id", usuarios) : { data: [] };
      if (!ativo) return;
      const nomeDoOrcamento = new Map(orcamentos.map(item => [item.id, item.nome]));
      setDetalhe({
        pedido, temporada: (tem.data as { titulo: string } | null)?.titulo ?? "Temporada",
        linhas: ((lin.data ?? []) as { id: string; orcamento_id: string; categoria: CategoriaDoOrcamento; descricao: string }[]).map(item => ({
          id: item.id, rotulo: `${orcamentos.length > 1 ? `${nomeDoOrcamento.get(item.orcamento_id) ?? ""} · ` : ""}${ROTULO_DA_CATEGORIA_DO_ORCAMENTO[item.categoria]} · ${item.descricao}`,
        })),
        lancamentos: (lan.data ?? []) as Lancamento[],
        nomes: Object.fromEntries(((pes.data ?? []) as { nome: string; user_id: string }[]).map(item => [item.user_id, item.nome])),
        eu: sessao.data.user?.id ?? null,
      });
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao, router]);

  const lancadoCentavos = useMemo(() => (detalhe?.lancamentos ?? []).reduce((soma, item) => soma + emCentavos(item.valor), 0), [detalhe]);

  if (detalhe === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (detalhe === null) return <DetailNotFound title="Pedido não encontrado" description="Ele não existe, foi apagado ou você não tem a permissão de dinheiro." backHref="/producoes/temporadas" backLabel="Voltar para Temporadas" />;

  const { pedido, temporada, linhas, lancamentos, nomes, eu } = detalhe;
  const nome = (usuario: string | null) => (usuario === null ? "alguém da equipe" : usuario === eu ? "você" : nomes[usuario] ?? "alguém da equipe");
  const valorCentavos = emCentavos(pedido.valor);
  const situacao = ondeEsta(pedido, nome, lancadoCentavos);
  const passos = passosDoPedido(pedido.situacao, { podeEditar, podeAprovar });
  const vencida = pendenciaVencida(pedido, hoje);
  const proporcao = valorCentavos > 0 ? Math.min(100, Math.round((lancadoCentavos / valorCentavos) * 100)) : 0;
  const rotuloDaLinha = linhas.find(item => item.id === pedido.orcamento_linha_id)?.rotulo ?? null;
  const voltar = `/producoes/temporadas/${pedido.temporada_id}#dinheiro/pagar`;

  async function dar(passo: PassoDoPedido, motivo = "") {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).rpc("fn_producao_pedido_mudar", { p_pedido: pedido.id, p_passo: passo, p_motivo: motivo });
    setTrabalhando(false);
    setRecusando(null);
    if (error) { setErro(mensagemDoErroDePedido(error)); return; }
    setVersao(atual => atual + 1);
  }

  const linhaDoTempo = [
    { quando: pedido.created_at.slice(0, 10), texto: `Pedido criado por ${nome(pedido.solicitante_id)}` },
    ...(pedido.aprovado_em && pedido.situacao !== "rascunho" && pedido.situacao !== "pendente" ? [{ quando: pedido.aprovado_em.slice(0, 10), texto: `${pedido.situacao === "recusado" ? "Recusado" : "Aprovado"} por ${nome(pedido.aprovado_por)}` }] : []),
    ...lancamentos.map(item => ({ quando: item.data, texto: `Pagamento lançado: ${item.descricao} (${formatarReais(emCentavos(item.valor))})` })),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href={voltar} label={temporada} />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Pedido de pagamento</p>
              <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{pedido.descricao}</h1>
              <p className="mt-1 text-[0.8125rem] tabular-nums text-black/55">{formatarReais(valorCentavos)}{pedido.favorecido ? ` para ${pedido.favorecido}` : ""}</p>
            </div>
            <span className="rounded border px-3 py-1.5 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_PEDIDO[pedido.situacao]}</span>
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

        <section aria-labelledby="pedido-onde" className="rounded border bg-white px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id="pedido-onde" className="text-[0.9375rem] font-semibold text-[#282525]">{situacao.titulo}</h2>
          <p className="mt-1 max-w-2xl text-[0.8125rem] text-black/60">{situacao.texto}</p>
          {(passos.length > 0 || (podeEditar && pedidoEditavel(pedido.situacao))) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {passos.filter(passo => passo !== "recusar").map(passo => <button key={passo} type="button" className={BOTAO} disabled={trabalhando} onClick={() => void dar(passo)}>{ROTULO_DO_PASSO_DO_PEDIDO[passo]}</button>)}
              {passos.includes("recusar") && recusando === null && <button type="button" className={`${BOTAO} text-[#B23B3B]`} disabled={trabalhando} onClick={() => setRecusando("")}>Recusar</button>}
              {recusando !== null && (
                <span className="flex flex-wrap items-center gap-2 rounded border bg-white px-2 py-1.5" style={{ borderColor: "#B23B3B47" }}>
                  <label className="text-[0.75rem] text-[#B23B3B]" htmlFor="pedido-motivo">Motivo</label>
                  <input id="pedido-motivo" className={`${CAMPO} h-9 w-64`} value={recusando} maxLength={300} onChange={event => setRecusando(event.target.value)} />
                  <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando || recusando.trim() === ""} onClick={() => void dar("recusar", recusando)}>Recusar pedido</button>
                  <button type="button" className={BOTAO_PEQUENO} onClick={() => setRecusando(null)}>Voltar</button>
                </span>
              )}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <section aria-labelledby="pedido-pagamentos">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 id="pedido-pagamentos" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Pagamentos ligados</h2>
                {(pedido.situacao === "aprovado" || pedido.situacao === "pagando") && <Link href={voltar} className="flex items-center gap-1 text-[0.75rem] font-medium text-black/60 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">Lançar um pagamento <ArrowUpRight size={12} aria-hidden="true" /></Link>}
              </div>
              <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-baseline justify-between gap-3 text-[0.75rem] tabular-nums text-black/55">
                  <span>{formatarReais(lancadoCentavos)} lançados</span>
                  <span>de {formatarReais(valorCentavos)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[.06]" role="img" aria-label={`${proporcao}% do valor já tem pagamento lançado`}>
                  <div className="h-full rounded-full bg-[#282525]" style={{ width: `${proporcao}%` }} />
                </div>
                {lancamentos.length === 0 ? (
                  <p className="mt-3 text-[0.75rem] text-black/45">Nenhum pagamento ligado a este pedido ainda. Ao lançar um pagamento, escolha este pedido no campo “Pedido de pagamento”.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-black/[.06]">
                    {lancamentos.map(item => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[0.8125rem]">
                        <span className="min-w-0 flex-1 basis-48 truncate text-[#282525]">{item.descricao}{item.documento ? ` (${item.documento})` : ""}</span>
                        <span className="tabular-nums text-black/55">{dia(item.data)}</span>
                        <span className="w-28 text-right tabular-nums text-[#282525]">{formatarReais(emCentavos(item.valor))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="pedido-historia">
              <h2 id="pedido-historia" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Linha do tempo</h2>
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
            <section aria-labelledby="pedido-dados" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="pedido-dados" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Dados do pedido</h2>
                {podeEditar && pendenciaEditavel(pedido.situacao) && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha(true)}><Pencil size={11} aria-hidden="true" className="mr-1 inline" />{pedidoEditavel(pedido.situacao) ? "Editar" : "Pendência"}</button>}
              </div>
              <dl className="space-y-2.5 text-[0.8125rem]">
                {[
                  ["Valor", formatarReais(valorCentavos)],
                  ["Quem recebe", pedido.favorecido ?? "—"],
                  ["Pedido por", nome(pedido.solicitante_id)],
                  ["Linha do orçamento", rotuloDaLinha ?? "—"],
                  ["Justificativa", pedido.justificativa ?? "—"],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</dt>
                    <dd className="mt-0.5 text-[#282525]">{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="pedido-pendencia" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <h2 id="pedido-pendencia" className="mb-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Próxima pendência</h2>
              {pedido.pendencia ? (
                <p className={`flex items-start gap-1.5 text-[0.8125rem] ${vencida ? "text-[#B23B3B]" : "text-[#B07A14]"}`}>
                  {vencida && <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />}
                  <span>{pedido.pendencia}{pedido.pendencia_ate ? ` · até ${dia(pedido.pendencia_ate)}${vencida ? " (vencida)" : ""}` : ""}</span>
                </p>
              ) : (
                <p className="text-[0.75rem] text-black/45">Nenhuma. Use para lembrar o que falta, por exemplo “falta a nota do fornecedor”.</p>
              )}
            </section>
          </aside>
        </div>
      </DetailPageContent>

      {folha && organizationId && <PedidoSheet organizationId={organizationId} temporadaId={pedido.temporada_id} pedido={pedido} linhas={linhas} onClose={() => setFolha(false)} onSalvou={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
