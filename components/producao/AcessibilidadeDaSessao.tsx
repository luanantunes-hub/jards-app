"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { SITUACOES_DA_ACESSIBILIDADE, TIPOS_DE_ACESSIBILIDADE, type SituacaoDaAcessibilidade, type TipoDeAcessibilidade } from "@/lib/producao/estados";
import {
  coberturaDaSessao, lerRecurso, mensagemDoErroDeAcessibilidade, ROTULO_DA_SITUACAO_DA_ACESSIBILIDADE, ROTULO_DO_TIPO_DE_ACESSIBILIDADE, type RecursoDeAcessibilidade,
} from "@/lib/producao/acessibilidade";

type Pessoa = { id: string; nome: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

function RecursoSheet({ organizationId, sessaoId, pessoas, recurso, tipoInicial, onClose, onSalvou }: {
  organizationId: string; sessaoId: string; pessoas: Pessoa[]; recurso: RecursoDeAcessibilidade | null; tipoInicial: TipoDeAcessibilidade | ""; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [tipo, setTipo] = useState<TipoDeAcessibilidade | "">(recurso?.tipo ?? tipoInicial);
  const [situacao, setSituacao] = useState<SituacaoDaAcessibilidade>(recurso?.situacao ?? "planejado");
  const [pessoaId, setPessoaId] = useState(recurso?.pessoa_id ?? "");
  const [lugares, setLugares] = useState(recurso?.lugares ? String(recurso.lugares) : "");
  const [notas, setNotas] = useState(recurso?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerRecurso({ tipo, situacao, pessoaId, lugares, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = recurso
      ? await producao.from("producao_acessibilidade").update(leitura.valor).eq("id", recurso.id)
      : await producao.from("producao_acessibilidade").insert({ organization_id: organizationId, sessao_id: sessaoId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeAcessibilidade(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!recurso) return;
    confirmDelete({
      title: "Apagar recurso de acessibilidade?",
      description: `${ROTULO_DO_TIPO_DE_ACESSIBILIDADE[recurso.tipo]} sai desta sessão. Se só mudou o plano, prefira marcar como cancelado.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_acessibilidade").delete().eq("id", recurso.id);
        if (error) throw new Error("Não foi possível apagar o recurso.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={recurso ? "Editar recurso" : "Novo recurso de acessibilidade"}
      onClose={onClose}
      footer={fechar => (
        <>
          {recurso && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : recurso ? "Salvar" : "Adicionar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Recurso</span>
            <Dropdown ariaLabel="Recurso" value={tipo} onChange={valor => setTipo(valor as TipoDeAcessibilidade | "")} disabled={salvando}
              options={[{ value: "", label: "Escolha o recurso" }, ...TIPOS_DE_ACESSIBILIDADE.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_ACESSIBILIDADE[valor] }))]} />
          </div>
          <div>
            <span className={ROTULO}>Situação</span>
            <Dropdown ariaLabel="Situação" value={situacao} onChange={valor => setSituacao(valor as SituacaoDaAcessibilidade)} disabled={salvando}
              options={SITUACOES_DA_ACESSIBILIDADE.map(valor => ({ value: valor, label: ROTULO_DA_SITUACAO_DA_ACESSIBILIDADE[valor] }))} />
          </div>
        </div>
        {tipo === "lugares_reservados" ? (
          <div><label className={ROTULO} htmlFor="acess-lugares">Quantos lugares ficam reservados</label><input id="acess-lugares" inputMode="numeric" className={CAMPO} value={lugares} onChange={event => setLugares(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
        ) : (
          <div>
            <span className={ROTULO}>Pessoa escalada (opcional)</span>
            <Dropdown ariaLabel="Pessoa escalada" value={pessoaId} onChange={setPessoaId} disabled={salvando}
              options={[{ value: "", label: "Ninguém ainda" }, ...pessoas.map(pessoa => ({ value: pessoa.id, label: pessoa.nome }))]} />
          </div>
        )}
        <div>
          <label className={ROTULO} htmlFor="acess-notas">Nota (opcional)</label>
          <textarea id="acess-notas" rows={2} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={notas} maxLength={500} onChange={event => setNotas(event.target.value)} disabled={salvando} placeholder="Por exemplo: interpretação da peça inteira, duas intérpretes em revezamento." />
        </div>
      </div>
    </TopSheet>
  );
}

/** A acessibilidade de uma sessão (PD7.6): o que está confirmado, planejado ou faltando (Libras, audiodescrição, legendagem, lugares reservados) e a pessoa escalada. */
export function AcessibilidadeDaSessao({ organizationId, sessaoId, podeEditar }: { organizationId: string; sessaoId: string; podeEditar: boolean }) {
  const [recursos, setRecursos] = useState<RecursoDeAcessibilidade[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [folha, setFolha] = useState<{ recurso: RecursoDeAcessibilidade | null; tipo: TipoDeAcessibilidade | "" } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [rec, pes] = await Promise.all([
        producao.from("producao_acessibilidade").select("id, tipo, situacao, pessoa_id, lugares, notas").eq("sessao_id", sessaoId).order("created_at"),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      if (!ativo) return;
      setRecursos(rec.data ?? []);
      setPessoas(pes.data ?? []);
      setErro(rec.error ? "Não foi possível carregar a acessibilidade. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, sessaoId, versao]);

  const cobertura = useMemo(() => coberturaDaSessao(recursos ?? []), [recursos]);
  const nomes = useMemo(() => new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome])), [pessoas]);

  if (recursos === null) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <div className="space-y-5">
      {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      <section aria-labelledby="cobertura">
        <h2 id="cobertura" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Cobertura da sessão</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["libras", "audiodescricao", "legendagem", "lugares_reservados"] as const).map(tipo => {
            const confirmado = cobertura.confirmados.includes(tipo), planejado = cobertura.planejados.includes(tipo);
            return (
              <li key={tipo} className="rounded border bg-white px-4 py-3" style={{ borderColor: confirmado ? "#2E893247" : !planejado ? "#B07A1447" : "rgba(13,13,13,.08)" }}>
                <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{ROTULO_DO_TIPO_DE_ACESSIBILIDADE[tipo]}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] font-medium" style={{ color: confirmado ? "#2E8932" : planejado ? "#282525" : "#B07A14" }}>
                  {confirmado ? <Check size={13} aria-hidden="true" /> : !planejado ? <TriangleAlert size={13} aria-hidden="true" /> : null}
                  {confirmado ? "Confirmado" : planejado ? "Planejado" : "Sem recurso"}
                  {tipo === "lugares_reservados" && cobertura.lugaresReservados > 0 ? <span className="font-normal tabular-nums text-black/55"> · {cobertura.lugaresReservados} {cobertura.lugaresReservados === 1 ? "lugar" : "lugares"}</span> : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="recursos">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="recursos" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Recursos</h2>
          {podeEditar && <button type="button" onClick={() => setFolha({ recurso: null, tipo: "" })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Novo recurso</button>}
        </div>
        {recursos.length === 0 ? (
          <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Nenhum recurso de acessibilidade nesta sessão</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Registre o que a casa oferece (Libras, audiodescrição, legendagem, lugares reservados) e quem está escalado. A cobertura acima mostra o que falta.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {recursos.map(recurso => (
              <li key={recurso.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className={`truncate text-[0.8125rem] font-medium ${recurso.situacao === "cancelado" ? "text-black/40 line-through" : "text-[#282525]"}`}>{ROTULO_DO_TIPO_DE_ACESSIBILIDADE[recurso.tipo]}{recurso.lugares ? ` · ${recurso.lugares} ${recurso.lugares === 1 ? "lugar" : "lugares"}` : ""}</p>
                  <p className="truncate text-[0.6875rem] text-black/45">{[recurso.pessoa_id ? nomes.get(recurso.pessoa_id) ?? "Pessoa da equipe" : null, recurso.notas].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="w-24 text-[0.75rem] text-black/65">{ROTULO_DA_SITUACAO_DA_ACESSIBILIDADE[recurso.situacao]}</span>
                {podeEditar && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha({ recurso, tipo: recurso.tipo })}>Editar</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {folha && <RecursoSheet organizationId={organizationId} sessaoId={sessaoId} pessoas={pessoas} recurso={folha.recurso} tipoInicial={folha.tipo} onClose={() => setFolha(null)} onSalvou={() => setVersao(atual => atual + 1)} />}
    </div>
  );
}
