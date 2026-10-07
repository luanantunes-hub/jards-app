"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MapPin, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { MetaModal, type AgrupadorParaMeta } from "@/components/prestacao/objeto/MetaModal";
import { LocalModal } from "@/components/prestacao/objeto/LocalModal";
import { TIPOS_NO } from "@/lib/prestacao/orcamento";
import { periodoDoLocal, quantidade, resumoDaMeta, rotuloDoLocal, STATUS_LOCAL, type ResumoDaMeta, type SituacaoDaMeta } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoAtividade, PrestacaoLocal, PrestacaoMeta } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";

const SITUACAO: Record<SituacaoDaMeta, { rotulo: string; cor: string }> = {
  sem_resultado: { rotulo: "Sem resultado", cor: "#6B6B6B" },
  atingida: { rotulo: "Atingida", cor: "#2E8932" },
  acima: { rotulo: "Acima do previsto", cor: "#1A8B7A" },
  abaixo: { rotulo: "Abaixo do previsto", cor: "#B07A14" },
};

type AtividadeDoObjeto = Pick<PrestacaoAtividade, "id" | "meta_id" | "local_id" | "status_realizacao" | "publico_atingido">;

/** Etiqueta informativa: borda leve, fundo branco e a cor no texto. */
function Etiqueta({ rotulo, cor }: { rotulo: string; cor: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: `${cor}47`, color: cor }}>
      {rotulo}
    </span>
  );
}

function Resultado({ meta, resumo }: { meta: PrestacaoMeta; resumo: ResumoDaMeta }) {
  return (
    <span className="tabular-nums">
      {quantidade(meta.realizado, meta.unidade)}
      {resumo.percentual !== null && <span className="text-black/40"> · {resumo.percentual}%</span>}
    </span>
  );
}

function Atividades({ resumo }: { resumo: ResumoDaMeta }) {
  if (resumo.atividades === 0) return <span className="text-black/30">Nenhuma</span>;
  return (
    <span className="tabular-nums">
      {resumo.realizadas} de {resumo.atividades} realizadas
      {resumo.publico > 0 && <span className="text-black/40"> · {resumo.publico.toLocaleString("pt-BR")} pessoas</span>}
    </span>
  );
}

export default function ObjetoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const { confirmDelete } = useDeleteConfirm();
  const podeEditar = permissoes.editar;

  const [metas, setMetas] = useState<PrestacaoMeta[]>([]);
  const [locais, setLocais] = useState<PrestacaoLocal[]>([]);
  const [atividades, setAtividades] = useState<AtividadeDoObjeto[]>([]);
  const [agrupadores, setAgrupadores] = useState<AgrupadorParaMeta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editandoMeta, setEditandoMeta] = useState<PrestacaoMeta | "nova" | null>(null);
  const [editandoLocal, setEditandoLocal] = useState<PrestacaoLocal | "novo" | null>(null);
  const abriuDoLink = useRef(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do objeto ainda não estão no tipo Database
    const db = supabase as any;
    const [m, l, a, n] = await Promise.all([
      db.from("prestacao_metas").select("*").eq("prestacao_id", id).order("ordem").order("created_at"),
      db.from("prestacao_locais").select("*").eq("prestacao_id", id).order("ordem").order("created_at"),
      db.from("prestacao_atividades").select("id, meta_id, local_id, status_realizacao, publico_atingido").eq("prestacao_id", id),
      db.from("prestacao_orcamento_nos").select("id, nome, tipo, ordem, versao:prestacao_orcamento_versoes!inner(ativa)")
        .eq("prestacao_id", id).neq("tipo", "item").eq("versao.ativa", true).order("ordem"),
    ]);
    const falha = m.error ?? l.error ?? a.error ?? n.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar o objeto") : "",
      metas: ((m.data ?? []) as PrestacaoMeta[]).map(x => ({ ...x, previsto: Number(x.previsto), realizado: x.realizado === null ? null : Number(x.realizado) })),
      locais: (l.data ?? []) as PrestacaoLocal[],
      atividades: (a.data ?? []) as AtividadeDoObjeto[],
      agrupadores: ((n.data ?? []) as { id: string; nome: string; tipo: string }[]).map(no => ({
        id: no.id,
        rotulo: `${TIPOS_NO.find(t => t.id === no.tipo)?.rotulo ?? no.tipo} · ${no.nome}`,
      })),
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setMetas(dados.metas);
    setLocais(dados.locais);
    setAtividades(dados.atividades);
    setAgrupadores(dados.agrupadores);
    setCarregando(false);
    // Link das verificações: ?meta=<id> ou ?local=<id> abre o cadastro, só na primeira leitura.
    if (!abriuDoLink.current) {
      abriuDoLink.current = true;
      const busca = new URLSearchParams(window.location.search);
      const meta = dados.metas.find(x => x.id === busca.get("meta"));
      const local = dados.locais.find(x => x.id === busca.get("local"));
      if (meta) setEditandoMeta(meta);
      else if (local) setEditandoLocal(local);
    }
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const resumos = useMemo(() => new Map(metas.map(m => [m.id, resumoDaMeta(m, atividades)])), [metas, atividades]);
  const atividadesPorLocal = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const a of atividades) if (a.local_id) contagem.set(a.local_id, (contagem.get(a.local_id) ?? 0) + 1);
    return contagem;
  }, [atividades]);
  const placar = useMemo(() => ({
    comResultado: metas.filter(m => m.realizado !== null).length,
    semJustificativa: metas.filter(m => resumos.get(m.id)?.faltaJustificativa).length,
    porStatus: STATUS_LOCAL.map(s => ({ ...s, quantos: locais.filter(l => l.status === s.id).length })).filter(s => s.quantos > 0),
  }), [metas, locais, resumos]);

  function salvou() {
    setEditandoMeta(null);
    setEditandoLocal(null);
    carregar();
    pedirVerificacao(id);
  }

  function excluirMeta(meta: PrestacaoMeta) {
    const ligadas = resumos.get(meta.id)?.atividades ?? 0;
    confirmDelete({
      title: "Excluir meta?",
      description: ligadas
        ? `"${meta.descricao}" sai do objeto; as ${ligadas} atividades ligadas a ela ficam sem meta.`
        : `"${meta.descricao}" sai do objeto.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do objeto ainda não estão no tipo Database
        const { error } = await (supabase as any).from("prestacao_metas").delete().eq("id", meta.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a meta"));
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  function excluirLocal(local: PrestacaoLocal) {
    const ligadas = atividadesPorLocal.get(local.id) ?? 0;
    confirmDelete({
      title: "Excluir local?",
      description: ligadas
        ? `${rotuloDoLocal(local)} sai do objeto; as ${ligadas} atividades nele ficam sem local.`
        : `${rotuloDoLocal(local)} sai do objeto.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do objeto ainda não estão no tipo Database
        const { error } = await (supabase as any).from("prestacao_locais").delete().eq("id", local.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir o local"));
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Objeto</h2>
          <p className="text-[0.6875rem] text-black/45">Metas propostas × resultados e locais de realização, como o relatório do objeto pede.</p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditandoLocal("novo")}
              className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/70 transition hover:border-black/25 hover:text-black/90 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            >
              <Plus size={13} aria-hidden /> Novo local
            </button>
            <button
              type="button"
              onClick={() => setEditandoMeta("nova")}
              className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]"
            >
              <Plus size={13} aria-hidden /> Nova meta
            </button>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={BORDA}>{erro}</p>}

      {!carregando && (metas.length > 0 || locais.length > 0) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded border bg-white px-5 py-3 text-[0.6875rem]" style={BORDA}>
          <div className="flex gap-1.5"><dt className="text-black/40">Metas com resultado</dt><dd className="tabular-nums text-black/75">{placar.comResultado} de {metas.length}</dd></div>
          {placar.semJustificativa > 0 && (
            <div className="flex gap-1.5"><dt className="text-black/40">Abaixo do previsto sem justificativa</dt><dd className="tabular-nums text-[#B07A14]">{placar.semJustificativa}</dd></div>
          )}
          {placar.porStatus.length > 0 && (
            <div className="flex gap-1.5">
              <dt className="text-black/40">Locais</dt>
              <dd className="tabular-nums text-black/75">{placar.porStatus.map(s => `${s.quantos} ${s.rotulo.toLowerCase()}`).join(" · ")}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Metas */}
      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="metas-titulo">
        <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="metas-titulo" className="text-[0.75rem] font-semibold text-black">Metas <span className="font-normal tabular-nums text-black/35">({metas.length})</span></h3>
        </div>
        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : metas.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Target size={20} className="mx-auto text-black/20" aria-hidden />
            <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma meta cadastrada.</p>
            <p className="text-[0.6875rem] text-black/35">{podeEditar ? "Cadastre as metas aprovadas com o previsto; o realizado entra quando houver resultado." : "Quem edita a prestação cadastra as metas."}</p>
          </div>
        ) : (
          <>
            <table className="hidden w-full text-[0.75rem] md:table">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  <th className={`${CABECALHO} w-full`}>Meta</th>
                  <th className={`${CABECALHO} whitespace-nowrap text-right`}>Previsto</th>
                  <th className={`${CABECALHO} whitespace-nowrap text-right`}>Realizado</th>
                  <th className={`${CABECALHO} whitespace-nowrap`}>Situação</th>
                  <th className={`${CABECALHO} whitespace-nowrap`}>Atividades</th>
                  {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.05]">
                {metas.map(meta => {
                  const resumo = resumos.get(meta.id)!;
                  return (
                    <tr key={meta.id} className="align-top transition hover:bg-black/[.02]">
                      <td className="px-4 py-3">
                        <p className="text-black/80">{meta.descricao}</p>
                        {meta.justificativa && <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-black/45">{meta.justificativa}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/70">{quantidade(meta.previsto, meta.unidade)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-black/70"><Resultado meta={meta} resumo={resumo} /></td>
                      <td className="px-4 py-3">
                        <Etiqueta {...SITUACAO[resumo.situacao]} />
                        {resumo.faltaJustificativa && <p className="mt-1 whitespace-nowrap text-[0.625rem] text-[#B07A14]">Falta a justificativa</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[0.6875rem] text-black/60"><Atividades resumo={resumo} /></td>
                      {podeEditar && (
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          <button type="button" onClick={() => setEditandoMeta(meta)} aria-label={`Editar a meta ${meta.descricao}`} className={botaoIcone}><Pencil size={13} /></button>
                          <button type="button" onClick={() => excluirMeta(meta)} aria-label={`Excluir a meta ${meta.descricao}`} className={botaoExcluir}><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="divide-y divide-black/[.05] md:hidden">
              {metas.map(meta => {
                const resumo = resumos.get(meta.id)!;
                return (
                  <li key={meta.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[0.75rem] text-black/80">{meta.descricao}</p>
                      {podeEditar && (
                        <div className="flex shrink-0">
                          <button type="button" onClick={() => setEditandoMeta(meta)} aria-label={`Editar a meta ${meta.descricao}`} className={botaoIcone}><Pencil size={13} /></button>
                          <button type="button" onClick={() => excluirMeta(meta)} aria-label={`Excluir a meta ${meta.descricao}`} className={botaoExcluir}><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.6875rem]">
                      <dt className="text-black/40">Previsto</dt><dd className="tabular-nums text-black/70">{quantidade(meta.previsto, meta.unidade)}</dd>
                      <dt className="text-black/40">Realizado</dt><dd className="text-black/70"><Resultado meta={meta} resumo={resumo} /></dd>
                      <dt className="text-black/40">Atividades</dt><dd className="text-black/60"><Atividades resumo={resumo} /></dd>
                    </dl>
                    <div className="flex flex-wrap items-center gap-2">
                      <Etiqueta {...SITUACAO[resumo.situacao]} />
                      {resumo.faltaJustificativa && <span className="text-[0.625rem] text-[#B07A14]">Falta a justificativa</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Locais */}
      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="locais-titulo">
        <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="locais-titulo" className="text-[0.75rem] font-semibold text-black">Locais de realização <span className="font-normal tabular-nums text-black/35">({locais.length})</span></h3>
        </div>
        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : locais.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <MapPin size={20} className="mx-auto text-black/20" aria-hidden />
            <p className="mt-2 text-[0.75rem] text-black/55">Nenhum local cadastrado.</p>
            <p className="text-[0.6875rem] text-black/35">{podeEditar ? "Cadastre os municípios aprovados; depois diga em cada um se o projeto aconteceu." : "Quem edita a prestação cadastra os locais."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[.05]">
            {locais.map(local => {
              const status = STATUS_LOCAL.find(s => s.id === local.status) ?? STATUS_LOCAL[0];
              const periodo = periodoDoLocal(local);
              const ligadas = atividadesPorLocal.get(local.id) ?? 0;
              return (
                <li key={local.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 transition hover:bg-black/[.02]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.75rem] font-medium text-black/80">{rotuloDoLocal(local)}</p>
                      <Etiqueta rotulo={status.rotulo} cor={status.cor} />
                    </div>
                    <p className="mt-0.5 text-[0.625rem] text-black/40">
                      {[local.espaco, periodo, ligadas ? `${ligadas} ${ligadas === 1 ? "atividade" : "atividades"}` : null].filter(Boolean).join(" · ") || "Sem espaço nem período"}
                    </p>
                    {local.justificativa && <p className="mt-1 text-[0.6875rem] text-black/55">{local.justificativa}</p>}
                  </div>
                  {podeEditar && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => setEditandoLocal(local)} aria-label={`Editar ${rotuloDoLocal(local)}`} className={botaoIcone}><Pencil size={13} /></button>
                      <button type="button" onClick={() => excluirLocal(local)} aria-label={`Excluir ${rotuloDoLocal(local)}`} className={botaoExcluir}><Trash2 size={13} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[0.6875rem] text-black/40">
        As atividades se ligam a uma meta e a um local na aba <Link href={`/prestacoes/${id}/atividades`} className="text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Atividades</Link>.
      </p>

      {editandoMeta && (
        <MetaModal
          prestacaoId={id}
          meta={editandoMeta === "nova" ? null : editandoMeta}
          agrupadores={agrupadores}
          onClose={() => setEditandoMeta(null)}
          onSaved={salvou}
        />
      )}
      {editandoLocal && (
        <LocalModal
          prestacaoId={id}
          local={editandoLocal === "novo" ? null : editandoLocal}
          onClose={() => setEditandoLocal(null)}
          onSaved={salvou}
        />
      )}
    </div>
  );
}
