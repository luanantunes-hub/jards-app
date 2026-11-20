"use client";

// Grade semanal de atividades (P8.6): as turmas fixas de cada núcleo, com
// modalidade, alunos, dias, horário e equipe. Na Lei de Incentivo ao Esporte
// vira a aba GRADE do formulário da prestação; a seção só aparece quando o
// regime pede a grade ou quando já há turmas.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { TurmaModal } from "@/components/prestacao/grade/TurmaModal";
import { faltasDaTurma, gradePorNucleo, regimePedeGrade, rotuloDoHorario, rotuloDosDias, type BlocoDaGrade, type NucleoDoLocal } from "@/lib/prestacao/grade";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoTurma } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const VALOR = (n: number) => `font-semibold tabular-nums ${n ? "text-[#282525]" : "text-black/30"}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Aviso em texto neutro com o ícone âmbar de alerta. */
function Falta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1 text-[0.625rem] text-black/50">
      <AlertTriangle size={12} strokeWidth={1.75} aria-label="Alerta" className="mt-px shrink-0 text-[#B07A14]" />
      <span>{children}</span>
    </span>
  );
}

function faltasDoNucleo(b: BlocoDaGrade<PrestacaoTurma>): string[] {
  const l = b.local;
  if (!l) return [];
  return [!l.endereco?.trim() ? "endereço" : null, !b.responsavel ? "responsável" : null, !b.telefone ? "telefone" : null]
    .filter((x): x is string => Boolean(x));
}

const juntar = (itens: string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0] ?? "");

export function GradeSemanal({ prestacaoId }: { prestacaoId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const podeEditar = usePermissoesPrestacao(prestacaoId).editar;
  const regimes = useRegimesPublicados();
  const { confirmDelete } = useDeleteConfirm();

  const [turmas, setTurmas] = useState<PrestacaoTurma[]>([]);
  const [locais, setLocais] = useState<NucleoDoLocal[]>([]);
  const [regimeId, setRegimeId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<{ turma: PrestacaoTurma | null } | null>(null);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [t, l, p] = await Promise.all([
      db.from("prestacao_turmas").select("*").eq("prestacao_id", prestacaoId).order("ordem").order("created_at"),
      db.from("prestacao_locais").select("id, pais, uf, municipio, espaco, status, endereco, responsavel, telefone").eq("prestacao_id", prestacaoId).order("ordem").order("created_at"),
      db.from("prestacoes_contas").select("regime_id").eq("id", prestacaoId).maybeSingle(),
    ]);
    const falha = t.error ?? l.error ?? p.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar a grade") : "",
      turmas: (t.data ?? []) as PrestacaoTurma[],
      locais: (l.data ?? []) as NucleoDoLocal[],
      regimeId: (p.data?.regime_id ?? null) as string | null,
    };
  }, [prestacaoId, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setTurmas(dados.turmas);
    setLocais(dados.locais);
    setRegimeId(dados.regimeId);
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const recarregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  const regime = regimes.find(r => r.id === regimeId)?.regime ?? null;
  const blocos = useMemo(() => gradePorNucleo(turmas, locais), [turmas, locais]);
  const modalidades = useMemo(() => [...new Set(turmas.map(t => t.modalidade?.trim()).filter((m): m is string => Boolean(m)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [turmas]);
  const alunos = turmas.reduce((s, t) => s + (t.alunos ?? 0), 0);
  const nucleos = blocos.filter(b => b.local).length;

  if (carregando || (!regimePedeGrade(regime) && turmas.length === 0)) return null;

  function salvou() {
    setEditando(null);
    recarregar();
    pedirVerificacao(prestacaoId);
  }

  function excluir(t: PrestacaoTurma) {
    confirmDelete({
      title: "Excluir turma?",
      description: `"${t.nome}" sai da grade semanal.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
        const { error } = await (supabase as any).from("prestacao_turmas").delete().eq("id", t.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a turma"));
        await recarregar();
        pedirVerificacao(prestacaoId);
      },
    });
  }

  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";
  const vazio = <span className="text-black/30">—</span>;
  const linkObjeto = "underline decoration-black/20 underline-offset-2 transition hover:text-[#282525] hover:decoration-black/50 focus-visible:outline-2 focus-visible:outline-[#7259B5]";

  const acoes = (t: PrestacaoTurma) => podeEditar && (
    <>
      <button type="button" onClick={() => setEditando({ turma: t })} aria-label={`Editar ${t.nome}`} className={botaoIcone}><Pencil size={13} /></button>
      <button type="button" onClick={() => excluir(t)} aria-label={`Excluir ${t.nome}`} className={botaoExcluir}><Trash2 size={13} /></button>
    </>
  );

  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="grade-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="min-w-0">
          <h3 id="grade-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Grade semanal</h3>
          <p className="max-w-[40rem] text-[0.6875rem] text-black/45">
            As turmas fixas de cada núcleo, com dias e horário. Vai na aba GRADE do formulário da prestação; as atividades abaixo vão na aba EVENTOS.
          </p>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando({ turma: null })}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            style={{ borderColor: "rgba(13,13,13,.14)" }}
          >
            <Plus size={13} aria-hidden /> Nova turma
          </button>
        )}
      </div>

      {erro && <p role="alert" className="mx-5 mt-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}

      {turmas.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b px-5 py-2.5 text-[0.6875rem]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Núcleos</dt><dd className={VALOR(nucleos)}>{nucleos}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Turmas</dt><dd className={VALOR(turmas.length)}>{turmas.length}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Alunos</dt><dd className={VALOR(alunos)}>{alunos.toLocaleString("pt-BR")}</dd></div>
        </dl>
      )}

      {turmas.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <CalendarRange size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma turma na grade.</p>
          <p className="mx-auto max-w-[32rem] text-[0.6875rem] text-black/35">
            {locais.length
              ? "Adicione cada turma com o núcleo, a modalidade, os alunos, os dias da semana e o horário."
              : <>Cada local de execução é um núcleo da grade. Cadastre os locais na aba <Link href={`/prestacoes/${prestacaoId}/objeto`} className={linkObjeto}>Objeto</Link> e depois adicione as turmas.</>}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[.06]">
          {blocos.map(b => {
            const faltas = faltasDoNucleo(b);
            return (
              <div key={b.local?.id ?? "sem-nucleo"}>
                <div className="space-y-0.5 bg-black/[.02] px-5 py-2.5">
                  <p className="text-[0.75rem] font-medium text-black/80">
                    {b.local ? b.nucleo : "Sem núcleo"}
                    <span className="font-normal text-black/35"> · {plural(b.turmas.length, "turma", "turmas")}</span>
                  </p>
                  {b.local ? (
                    <>
                      {(b.endereco || b.responsavel || b.telefone) && (
                        <p className="text-[0.625rem] text-black/45">
                          {[b.endereco, b.responsavel ? `Responsável: ${b.responsavel}` : "", b.telefone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {faltas.length > 0 && (
                        <Falta>
                          {faltas.length > 1 ? "Faltam" : "Falta"} {juntar(faltas)} do núcleo. Complete no local, na aba <Link href={`/prestacoes/${prestacaoId}/objeto`} className={linkObjeto}>Objeto</Link>.
                        </Falta>
                      )}
                    </>
                  ) : (
                    <Falta>Escolha o núcleo destas turmas: a grade sai por núcleo.</Falta>
                  )}
                </div>

                {/* Computador: tabela */}
                <div className="hidden overflow-x-auto md:block">
                  {/* Larguras fixas: as colunas dos núcleos ficam alinhadas umas com as outras. */}
                  <table className="w-full min-w-[56rem] table-fixed text-[0.75rem]">
                    <colgroup>
                      <col />
                      <col className="w-[9rem]" />
                      <col className="w-[5.5rem]" />
                      <col className="w-[9rem]" />
                      <col className="w-[8.5rem]" />
                      <col className="w-[15rem]" />
                      {podeEditar && <col className="w-[5.5rem]" />}
                    </colgroup>
                    <thead>
                      <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                        <th className={CABECALHO}>Turma</th>
                        <th className={CABECALHO}>Modalidade</th>
                        <th className={`${CABECALHO} text-right`}>Alunos</th>
                        <th className={CABECALHO}>Dias</th>
                        <th className={CABECALHO}>Horário</th>
                        <th className={CABECALHO}>Equipe</th>
                        {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {b.turmas.map(t => {
                        const falta = faltasDaTurma(t).filter(f => f !== "o núcleo");
                        return (
                          <tr key={t.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                            <td className="px-4 py-2.5">
                              <p className="text-black/80">{t.nome}</p>
                              {falta.length > 0 && <Falta>{falta.length > 1 ? "Faltam" : "Falta"} {juntar(falta)}.</Falta>}
                            </td>
                            <td className="px-4 py-2.5 text-[0.6875rem] text-black/60">{t.modalidade ?? vazio}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-black/60">{t.alunos ?? vazio}</td>
                            <td className="px-4 py-2.5 text-[0.6875rem] text-black/60">{rotuloDosDias(t.dias) || vazio}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[0.6875rem] tabular-nums text-black/60">{rotuloDoHorario(t) || vazio}</td>
                            <td className="px-4 py-2.5 text-[0.6875rem] text-black/60">{t.equipe ?? vazio}</td>
                            {podeEditar && <td className="whitespace-nowrap px-2 py-1.5 text-right">{acoes(t)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Celular: cartões */}
                <ul className="divide-y divide-black/[.05] md:hidden">
                  {b.turmas.map(t => {
                    const falta = faltasDaTurma(t).filter(f => f !== "o núcleo");
                    return (
                      <li key={t.id} className="space-y-1 px-5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[0.75rem] text-black/80">{t.nome}</p>
                            <p className="text-[0.625rem] text-black/45">
                              {[t.modalidade, t.alunos !== null ? plural(t.alunos, "aluno", "alunos") : null].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {podeEditar && <div className="flex shrink-0 items-center">{acoes(t)}</div>}
                        </div>
                        {(t.dias.length > 0 || t.hora_inicio || t.hora_fim) && (
                          <p className="text-[0.6875rem] tabular-nums text-black/60">{[rotuloDosDias(t.dias), rotuloDoHorario(t)].filter(Boolean).join(" · ")}</p>
                        )}
                        {t.equipe && <p className="text-[0.6875rem] text-black/55">{t.equipe}</p>}
                        {falta.length > 0 && <Falta>{falta.length > 1 ? "Faltam" : "Falta"} {juntar(falta)}.</Falta>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <TurmaModal
          prestacaoId={prestacaoId}
          turma={editando.turma}
          locais={locais}
          modalidades={modalidades}
          ordem={turmas.length}
          onClose={() => setEditando(null)}
          onSaved={salvou}
        />
      )}
    </section>
  );
}
