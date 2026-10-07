"use client";

// Piloto da prestação de contas (P4.8): as organizações do piloto, o tempo
// que a equipe levava antes e as medidas da seção 16 do estudo, por
// organização e por prestação. A cortesia do módulo continua em Organizações.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { erroDoPiloto, tituloDoApontamento, type MedidasDaPrestacao, type ResumoDaOrganizacao, type SituacaoDoCriterio } from "@/lib/prestacao/piloto";

type Prestacao = MedidasDaPrestacao & { regime: string | null; status: string };
type Organizacao = {
  organization_id: string;
  nome: string;
  entrou_em: string;
  dias_antes: number | null;
  observacoes: string | null;
  contrato: { status: string; cortesia_ate: string | null } | null;
  resumo: ResumoDaOrganizacao;
  prestacoes: Prestacao[];
};
type Candidata = { id: string; nome: string; status: string };

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const ICONE = "rounded p-2 text-black/35 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
const META_DE_ORGANIZACOES = 3;

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const dolares = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const mensagem = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);

const COR: Record<SituacaoDoCriterio, string> = { atendido: "#2E8932", nao_atendido: "#D94A4A", sem_dados: "#6B6B6B" };
const TEXTO: Record<SituacaoDoCriterio, string> = { atendido: "Atendido", nao_atendido: "Não atendido", sem_dados: "Sem dados" };

function Criterio({ situacao }: { situacao: SituacaoDoCriterio }) {
  const cor = COR[situacao];
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {TEXTO[situacao]}
    </span>
  );
}

async function lerJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar");
  return data as T;
}

function textoDoTempo(r: ResumoDaOrganizacao): string {
  if (r.mediaDeDias === null) return "Nenhuma prestação final enviada ainda";
  const media = `${r.mediaDeDias.toLocaleString("pt-BR")} ${r.mediaDeDias === 1 ? "dia" : "dias"} em média`;
  if (!r.diasAntes) return `${media}; informe o tempo de antes para comparar`;
  const reducao = Math.round((r.reducao ?? 0) * 100);
  return `${media}, antes ${r.diasAntes}; ${reducao >= 0 ? `${reducao}% menos` : `${-reducao}% mais`}`;
}

/** Os débitos das prestações finais já enviadas, e quantas saíram depois do prazo. */
function textoDaConciliacao(prestacoes: readonly Prestacao[]): string {
  const enviadas = prestacoes.filter(p => p.enviadaEm);
  if (!enviadas.length) return "Nenhuma prestação final enviada ainda";
  const total = enviadas.reduce((s, p) => s + p.debitos.total, 0);
  const conciliados = enviadas.reduce((s, p) => s + p.debitos.conciliados, 0);
  const atrasadas = enviadas.filter(p => p.noPrazo === false).length;
  return [
    total ? `${conciliados} de ${plural(total, "débito conciliado", "débitos conciliados")} nas finais enviadas` : "Sem débitos importados nas finais enviadas",
    atrasadas ? `${plural(atrasadas, "enviada", "enviadas")} depois do prazo` : null,
  ].filter(Boolean).join("; ");
}

function CartaoDaOrganizacao({ o, onEditar, onTirar }: { o: Organizacao; onEditar: () => void; onTirar: () => void }) {
  const r = o.resumo;
  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-label={o.nome}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">{o.nome}</h2>
          <p className="text-[0.6875rem] text-black/45">
            {[
              `No piloto desde ${dataBr(o.entrou_em)}`,
              o.contrato ? (o.contrato.status === "cortesia" ? `cortesia${o.contrato.cortesia_ate ? ` até ${dataBr(o.contrato.cortesia_ate)}` : ""}` : `módulo ${o.contrato.status}`) : "sem o módulo",
              o.dias_antes ? `antes: ${plural(o.dias_antes, "dia", "dias")} para montar a prestação final` : "sem o tempo de antes",
            ].join(" · ")}
          </p>
          {o.observacoes && <p className="mt-1 whitespace-pre-line text-[0.6875rem] text-black/55">{o.observacoes}</p>}
        </div>
        <span className="flex items-center">
          <button type="button" onClick={onEditar} aria-label={`Editar ${o.nome} no piloto`} title="Editar" className={ICONE}><Pencil size={13} aria-hidden /></button>
          <button type="button" onClick={onTirar} aria-label={`Tirar ${o.nome} do piloto`} title="Tirar do piloto" className={ICONE}><Trash2 size={13} aria-hidden /></button>
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t px-5 py-4 text-[0.6875rem] sm:grid-cols-2 lg:grid-cols-4" style={BORDA}>
        <div>
          <dt className="flex items-center justify-between gap-2 text-black/40">Tempo pela metade <Criterio situacao={r.tempo} /></dt>
          <dd className="mt-1 text-black/70">{textoDoTempo(r)}</dd>
        </div>
        <div>
          <dt className="flex items-center justify-between gap-2 text-black/40">Débitos conciliados no prazo <Criterio situacao={r.conciliacao} /></dt>
          <dd className="mt-1 text-black/70">{textoDaConciliacao(o.prestacoes)}</dd>
        </div>
        <div>
          <dt className="flex items-center justify-between gap-2 text-black/40">Sem diligência por erro formal <Criterio situacao={r.diligencias} /></dt>
          <dd className="mt-1 text-black/70">{plural(o.prestacoes.reduce((s, p) => s + p.diligencias.porErroFormal, 0), "diligência preditiva por erro que o sistema confere", "diligências preditivas por erro que o sistema confere")}</dd>
        </div>
        <div>
          <dt className="text-black/40">Custo de IA</dt>
          <dd className="mt-1 tabular-nums text-black/70">{dolares(r.custoUsd)}{r.custoMedioUsd !== null && r.prestacoes > 1 ? ` · ${dolares(r.custoMedioUsd)} por prestação` : ""}</dd>
        </div>
      </dl>

      {o.prestacoes.length === 0 ? (
        <p className="border-t px-5 py-4 text-[0.75rem] text-black/45" style={BORDA}>Nenhuma prestação cadastrada nesta organização.</p>
      ) : (
        <ul className="divide-y divide-black/[.05] border-t" style={BORDA} aria-label={`Prestações de ${o.nome}`}>
          {o.prestacoes.map(p => (
            <li key={p.id} className="grid grid-cols-1 gap-x-6 gap-y-1 px-5 py-3 text-[0.6875rem] sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
              <div className="min-w-0">
                <p className="truncate text-[0.75rem] font-medium text-black/85">{p.titulo}</p>
                <p className="text-black/40">{p.regime ?? "sem regime"}</p>
              </div>
              <p className="tabular-nums text-black/65">
                {p.diasDeMontagem === null ? <span className="text-black/40">Final não enviada</span> : <>{plural(p.diasDeMontagem, "dia", "dias")} até o envio</>}
                {p.enviadaEm && <span className="block text-black/40">em {dataBr(p.enviadaEm)}{p.noPrazo === false ? "" : p.noPrazo ? ", no prazo" : ""}</span>}
                {p.noPrazo === false && <span className="block text-[#D94A4A]">depois do prazo</span>}
              </p>
              <p className="tabular-nums text-black/65">
                {p.debitos.total ? `${p.debitos.conciliados} de ${p.debitos.total} débitos conciliados` : <span className="text-black/40">Sem débitos importados</span>}
              </p>
              <p className="text-black/65">
                {p.diligencias.total ? `${plural(p.diligencias.total, "diligência", "diligências")}, ${p.diligencias.preditivas} preditiva${p.diligencias.preditivas === 1 ? "" : "s"}` : <span className="text-black/40">Sem diligência</span>}
                {p.diligencias.porErroFormal > 0 && (
                  <span className="block text-[#D94A4A]">{p.diligencias.porErroFormal} por erro formal ({p.diligencias.codigos.map(tituloDoApontamento).join("; ")})</span>
                )}
              </p>
              <p className="tabular-nums text-black/65">
                {p.ia.chamadas ? `${dolares(p.ia.custoUsd)} em ${plural(p.ia.chamadas, "leitura", "leituras")}` : <span className="text-black/40">Sem leitura por IA</span>}
                {p.ia.falhas > 0 && <span className="block text-black/40">{plural(p.ia.falhas, "falhou", "falharam")}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PilotoModal({ organizacao, candidatas, onClose, onSaved }: {
  organizacao: Organizacao | null;
  candidatas: Candidata[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [organizationId, setOrganizationId] = useState(organizacao?.organization_id ?? "");
  const [diasAntes, setDiasAntes] = useState(organizacao?.dias_antes ? String(organizacao.dias_antes) : "");
  const [entrouEm, setEntrouEm] = useState(organizacao?.entrou_em ?? new Date().toLocaleDateString("sv-SE"));
  const [observacoes, setObservacoes] = useState(organizacao?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!organizationId) { setErro("Escolha a organização."); return; }
    const problema = erroDoPiloto({ diasAntes, observacoes });
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    try {
      await lerJson("/api/admin/piloto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, diasAntes: diasAntes.trim() || null, observacoes, entrouEm }),
      });
      onSaved();
    } catch (e) {
      setErro(mensagem(e, "Não foi possível salvar."));
      setSalvando(false);
    }
  }

  return (
    <ModalPrestacao
      titulo={organizacao ? organizacao.nome : "Incluir no piloto"}
      subtitulo="O tempo de antes é a base da meta: montar a prestação final na metade do tempo"
      onClose={onClose}
      largura="max-w-[32rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {organizacao ? "Salvar" : "Incluir no piloto"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        {!organizacao && (
          <div className="sm:col-span-2">
            <span className={ROTULO}>Organização</span>
            <Dropdown value={organizationId} onChange={setOrganizationId} ariaLabel="Organização" placeholder="Escolha a organização"
              options={candidatas.map(c => ({ value: c.id, label: `${c.nome}${c.status === "cortesia" ? "" : ` (${c.status})`}` }))} />
            {candidatas.length === 0 && <p className="mt-1 text-[0.625rem] text-black/45">Nenhuma organização com a prestação fora do piloto. Libere a cortesia em Organizações.</p>}
          </div>
        )}
        <label>
          <span className={ROTULO}>Dias para montar a prestação final, antes</span>
          <input value={diasAntes} onChange={e => setDiasAntes(e.target.value)} inputMode="numeric" placeholder="Ex.: 45" className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>No piloto desde</span>
          <input type="date" value={entrouEm} onChange={e => setEntrouEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Observações</span>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} maxLength={2000}
            placeholder="Como a equipe mediu o tempo de antes, quem acompanha, os projetos"
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

export default function AdminPilotoPage() {
  const { confirmDelete } = useDeleteConfirm();
  const [dados, setDados] = useState<{ organizacoes: Organizacao[]; candidatas: Candidata[] } | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<{ organizacao: Organizacao | null } | null>(null);

  const carregar = useCallback(() =>
    lerJson<{ organizacoes: Organizacao[]; candidatas: Candidata[] }>("/api/admin/piloto")
      .then(d => { setDados(d); setErro(""); })
      .catch(e => setErro(mensagem(e, "Erro ao carregar o piloto"))), []);

  useEffect(() => { void carregar(); }, [carregar]);

  const comRouanet = useMemo(() => (dados?.organizacoes ?? []).filter(o => o.prestacoes.some(p => p.regime?.startsWith("rouanet"))).length, [dados]);

  function tirar(o: Organizacao) {
    confirmDelete({
      title: "Tirar do piloto?",
      description: `${o.nome} sai do painel; as prestações e a cortesia continuam como estão.`,
      confirmLabel: "Tirar",
      onConfirm: async () => {
        await lerJson(`/api/admin/piloto?organizacao=${o.organization_id}`, { method: "DELETE" });
        await carregar();
      },
    });
  }

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#0D0D0D]">Piloto da prestação de contas</h1>
          <p className="mt-0.5 max-w-[48rem] text-sm text-black/45">
            As medidas da seção 16 do estudo: o tempo de montar a prestação final contra o de antes, os débitos da conta de movimento conciliados até o prazo, as diligências da análise preditiva por erro que o sistema já confere e o custo de IA. A cortesia do módulo fica em <Link href="/admin/organizacoes" className="underline decoration-black/20 underline-offset-2 hover:text-black/70">Organizações</Link>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando({ organizacao: null })}
          disabled={!dados}
          className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={13} aria-hidden /> Incluir organização
        </button>
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}

      {!dados && !erro && <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-40 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {dados && (
        <>
          <p className="rounded border bg-white px-5 py-3 text-[0.75rem] text-black/65" style={BORDA}>
            {comRouanet >= META_DE_ORGANIZACOES
              ? `${comRouanet} organizações com projeto Rouanet no piloto.`
              : `${plural(comRouanet, "organização", "organizações")} com projeto Rouanet no piloto; a meta é ${META_DE_ORGANIZACOES}, de organizações diferentes.`}
          </p>
          {dados.organizacoes.length === 0 ? (
            <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
              <FlaskConical size={22} className="mx-auto text-black/20" aria-hidden />
              <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">
                Nenhuma organização no piloto. Libere a cortesia em Organizações e inclua aqui, com o tempo que a equipe levava para montar a prestação final.
              </p>
            </div>
          ) : (
            dados.organizacoes.map(o => (
              <CartaoDaOrganizacao key={o.organization_id} o={o} onEditar={() => setEditando({ organizacao: o })} onTirar={() => tirar(o)} />
            ))
          )}
        </>
      )}

      {editando && dados && (
        <PilotoModal
          organizacao={editando.organizacao}
          candidatas={dados.candidatas}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); void carregar(); }}
        />
      )}
    </div>
  );
}
