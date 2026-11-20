"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Pencil, Plus, TriangleAlert } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { emCentavos, formatarReais } from "@/lib/producao/dinheiro";
import {
  contaDoAdiantamento, mensagemDoErroDeAdiantamento, ROTULO_DA_SITUACAO_DO_ADIANTAMENTO, textoDaPrestacao,
  type AdiantamentoDaTemporada, type ContaDoAdiantamento, type GastoDoAdiantamento,
} from "@/lib/producao/adiantamentos";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { AdiantamentoSheet, GastoSheet, type PessoaDoAdiantamento } from "@/components/producao/AdiantamentosDaTemporada";
import { BOTAO, BOTAO_PEQUENO, Erro } from "@/components/producao/estilos";

type Detalhe = { adiantamento: AdiantamentoDaTemporada & { temporada_id: string }; gastos: GastoDoAdiantamento[]; pessoa: PessoaDoAdiantamento; temporada: string };

const dia = (data: string) => data.split("-").reverse().join("/");

/** A frase que diz onde o adiantamento está e o que falta, em palavras de quem usa. */
function ondeEsta(adiantamento: AdiantamentoDaTemporada, conta: ContaDoAdiantamento, pessoa: string): { titulo: string; texto: string } {
  if (adiantamento.situacao === "encerrado") return { titulo: "Encerrado", texto: `A prestação de contas fechou: ${formatarReais(conta.prestadoCentavos)} prestados${conta.devolvidoCentavos > 0 ? ` e ${formatarReais(conta.devolvidoCentavos)} devolvidos` : ""}. Nada mais muda.` };
  if (conta.saldoCentavos < 0) return { titulo: "A prestação passou do valor entregue", texto: `Os gastos e o devolvido somam ${formatarReais(-conta.saldoCentavos)} a mais do que foi entregue. Confira os gastos ou o valor do adiantamento.` };
  if (conta.saldoCentavos === 0) return { titulo: "Tudo prestado, pronto para encerrar", texto: "O saldo zerou: todo o dinheiro entregue foi prestado ou devolvido. Encerre o adiantamento para fechar a conta." };
  return {
    titulo: `Falta prestar ou devolver ${formatarReais(conta.saldoCentavos)}`,
    texto: `${pessoa} recebeu ${formatarReais(conta.valorCentavos)} em ${dia(adiantamento.data)}. Registre cada gasto com o comprovante; o que sobrar entra como devolvido (em “Editar”). O adiantamento só se encerra com o saldo zerado.`,
  };
}

/** O adiantamento: quanto falta prestar, os gastos da prestação de contas, o que foi devolvido e os dados para conferir ou editar. */
export default function AdiantamentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const temporadaDoAdiantamento = useRef<string | null>(null);
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const [detalhe, setDetalhe] = useState<Detalhe | null | undefined>(undefined);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [folha, setFolha] = useState(false);
  const [folhaGasto, setFolhaGasto] = useState<{ gasto: GastoDoAdiantamento | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const adi = await producao.from("producao_adiantamentos").select("id, temporada_id, pessoa_id, descricao, valor, data, devolvido, situacao, observacao").eq("id", id).eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      // O adiantamento que a pessoa acabou de apagar: volta para a temporada em vez de mostrar "não encontrado".
      if (!adi.error && !adi.data && temporadaDoAdiantamento.current) { router.replace(`/producoes/temporadas/${temporadaDoAdiantamento.current}#dinheiro/pessoas`); return; }
      if (adi.error || !adi.data) { setDetalhe(null); return; }
      const adiantamento = adi.data as Detalhe["adiantamento"];
      temporadaDoAdiantamento.current = adiantamento.temporada_id;
      const [tem, gas, pes] = await Promise.all([
        producao.from("producao_temporadas").select("titulo").eq("id", adiantamento.temporada_id).maybeSingle(),
        producao.from("producao_adiantamento_gastos").select("id, adiantamento_id, descricao, valor, data, documento").eq("adiantamento_id", adiantamento.id).order("data"),
        producao.from("producao_pessoas").select("id, nome").eq("id", adiantamento.pessoa_id).maybeSingle(),
      ]);
      if (!ativo) return;
      setDetalhe({
        adiantamento, gastos: (gas.data ?? []) as GastoDoAdiantamento[],
        pessoa: (pes.data as PessoaDoAdiantamento | null) ?? { id: adiantamento.pessoa_id, nome: "Pessoa arquivada" },
        temporada: (tem.data as { titulo: string } | null)?.titulo ?? "Temporada",
      });
    })();
    return () => { ativo = false; };
  }, [id, organizationId, versao, router]);

  if (detalhe === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (detalhe === null) return <DetailNotFound title="Adiantamento não encontrado" description="Ele não existe, foi apagado ou você não tem a permissão de dinheiro." backHref="/producoes/temporadas" backLabel="Voltar para Temporadas" />;

  const { adiantamento, gastos, pessoa, temporada } = detalhe;
  const conta = contaDoAdiantamento(adiantamento, gastos);
  const situacao = ondeEsta(adiantamento, conta, pessoa.nome);
  const aberto = adiantamento.situacao === "aberto";
  const acertado = conta.prestadoCentavos + conta.devolvidoCentavos;
  const proporcao = conta.valorCentavos > 0 ? Math.min(100, Math.round((acertado / conta.valorCentavos) * 100)) : 0;
  const voltar = `/producoes/temporadas/${adiantamento.temporada_id}#dinheiro/pessoas`;
  const mudou = () => setVersao(atual => atual + 1);

  async function encerrar() {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_adiantamentos").update({ situacao: "encerrado" }).eq("id", adiantamento.id);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeAdiantamento(error)); return; }
    mudou();
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(textoDaPrestacao({ pessoa: pessoa.nome, adiantamento, gastos })); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <DetailBackLink href={voltar} label={temporada} />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Adiantamento</p>
              <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{adiantamento.descricao}</h1>
              <p className="mt-1 text-[0.8125rem] tabular-nums text-black/55">{pessoa.nome} · {formatarReais(conta.valorCentavos)} entregues em {dia(adiantamento.data)}</p>
            </div>
            <span className="rounded border px-3 py-1.5 text-[0.75rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_ADIANTAMENTO[adiantamento.situacao]}</span>
          </div>
        </div>
      </header>

      <DetailPageContent>
        {erro && <div className="mb-4"><Erro texto={erro} /></div>}

        <section aria-labelledby="adiantamento-onde" className="rounded border bg-white px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id="adiantamento-onde" className="flex items-start gap-1.5 text-[0.9375rem] font-semibold text-[#282525]">
            {conta.saldoCentavos < 0 && <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[#B07A14]" />}{situacao.titulo}
          </h2>
          <p className="mt-1 max-w-2xl text-[0.8125rem] text-black/60">{situacao.texto}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {podeEditar && aberto && conta.saldoCentavos !== 0 && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => setFolhaGasto({ gasto: null })}><Plus size={13} aria-hidden="true" /> Prestar um gasto</button>}
            {podeEditar && conta.encerravel && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => void encerrar()}>Encerrar o adiantamento</button>}
            <button type="button" className={BOTAO} onClick={() => void copiar()}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar a prestação"}</button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section aria-labelledby="adiantamento-prestacao">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="adiantamento-prestacao" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Prestação de contas</h2>
              {podeEditar && aberto && conta.saldoCentavos === 0 && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaGasto({ gasto: null })}><Plus size={11} aria-hidden="true" className="mr-1 inline" />Gasto</button>}
            </div>
            <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3 text-[0.75rem] tabular-nums text-black/55">
                  <span>{formatarReais(acertado)} prestados ou devolvidos</span>
                  <span>de {formatarReais(conta.valorCentavos)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[.06]" role="img" aria-label={`${proporcao}% do valor entregue já foi prestado ou devolvido`}>
                  <div className="h-full rounded-full bg-[#2E8932]" style={{ width: `${proporcao}%` }} />
                </div>
              </div>
              {gastos.length === 0 ? (
                <p className="border-t border-black/[.06] px-4 py-4 text-[0.75rem] text-black/45">Nenhum gasto prestado ainda.{podeEditar && aberto ? " Use “Prestar um gasto” para registrar cada despesa com o comprovante." : ""}</p>
              ) : (
                <ul className="divide-y divide-black/[.06] border-t border-black/[.06]">
                  {gastos.map(gasto => {
                    const conteudo = (
                      <>
                        <span className="w-24 shrink-0 tabular-nums text-black/55">{dia(gasto.data)}</span>
                        <span className="min-w-0 flex-1 basis-40 truncate text-[#282525]">{gasto.descricao}{gasto.documento ? <span className="text-black/45"> · comprovante {gasto.documento}</span> : null}</span>
                        <span className="w-28 shrink-0 text-right tabular-nums text-[#282525]">{formatarReais(emCentavos(gasto.valor))}</span>
                      </>
                    );
                    return (
                      <li key={gasto.id}>
                        {podeEditar && aberto
                          ? <button type="button" onClick={() => setFolhaGasto({ gasto })} title="Editar o gasto" className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left text-[0.8125rem] transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">{conteudo}</button>
                          : <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[0.8125rem]">{conteudo}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <dl className="space-y-1.5 border-t border-black/[.06] px-4 py-3 text-[0.8125rem] tabular-nums">
                {[
                  ["Prestado em gastos", formatarReais(conta.prestadoCentavos)],
                  ["Devolvido", formatarReais(conta.devolvidoCentavos)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex items-baseline justify-between gap-3">
                    <dt className="text-black/55">{rotulo}</dt>
                    <dd className="text-[#282525]">{valor}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-black/[.06] pt-1.5">
                  <dt className="font-medium text-[#282525]">Saldo com {pessoa.nome}</dt>
                  <dd className={`font-semibold ${conta.saldoCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarReais(conta.saldoCentavos)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <aside className="space-y-4">
            <section aria-labelledby="adiantamento-dados" className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="adiantamento-dados" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Dados do adiantamento</h2>
                {podeEditar && aberto && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha(true)}><Pencil size={11} aria-hidden="true" className="mr-1 inline" />Editar</button>}
              </div>
              <dl className="space-y-2.5 text-[0.8125rem]">
                {[
                  ["Quem recebeu", pessoa.nome],
                  ["Para quê", adiantamento.descricao],
                  ["Valor entregue", formatarReais(conta.valorCentavos)],
                  ["Entregue em", dia(adiantamento.data)],
                  ["Devolvido", conta.devolvidoCentavos > 0 ? formatarReais(conta.devolvidoCentavos) : "—"],
                  ["Observação", adiantamento.observacao ?? "—"],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-[#282525]">{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </DetailPageContent>

      {folha && organizationId && <AdiantamentoSheet organizationId={organizationId} temporadaId={adiantamento.temporada_id} adiantamento={adiantamento} pessoas={[pessoa]} saldoMinimo={conta.prestadoCentavos} onClose={() => setFolha(false)} onSalvou={mudou} />}
      {folhaGasto && organizationId && <GastoSheet organizationId={organizationId} adiantamento={adiantamento} gasto={folhaGasto.gasto} onClose={() => setFolhaGasto(null)} onSalvou={mudou} />}
    </div>
  );
}
