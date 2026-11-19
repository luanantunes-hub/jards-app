"use client";

import { useEffect, useMemo, useState } from "react";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { Check, Pencil, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { instanteParaHoraLocal } from "@/lib/producao/dia";
import { GRAVIDADES_DA_OCORRENCIA, TIPOS_DE_OCORRENCIA, type GravidadeDaOcorrencia, type TipoDeOcorrencia } from "@/lib/producao/estados";
import { lerOcorrencia, ordenarOcorrencias, resumoDasOcorrencias, ROTULO_DA_GRAVIDADE, ROTULO_DO_TIPO_DE_OCORRENCIA } from "@/lib/producao/ocorrencias";

type Ocorrencia = {
  id: string; tipo: TipoDeOcorrencia; gravidade: GravidadeDaOcorrencia; descricao: string; providencia: string | null; ocorreu_em: string; resolvida: boolean;
};

const CAMPO_TEXTO = "w-full resize-none rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const COR_DA_GRAVIDADE: Record<GravidadeDaOcorrencia, string> = { alta: "#B23B3B", media: "#B07A14", baixa: "#282525" };

function OcorrenciaSheet({ organizationId, dataId, ocorrencia, onClose, onSaved }: {
  organizationId: string; dataId: string; ocorrencia: Ocorrencia | null; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [tipo, setTipo] = useState<string>(ocorrencia?.tipo ?? "tecnica");
  const [gravidade, setGravidade] = useState<string>(ocorrencia?.gravidade ?? "media");
  const [descricao, setDescricao] = useState(ocorrencia?.descricao ?? "");
  const [providencia, setProvidencia] = useState(ocorrencia?.providencia ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerOcorrencia({ tipo, gravidade, descricao, providencia });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const producao = clienteDaProducao(supabase);
    let error;
    if (ocorrencia) {
      ({ error } = await producao.from("producao_ocorrencias").update(leitura.ocorrencia).eq("id", ocorrencia.id));
    } else {
      const quem = (await supabase.auth.getSession()).data.session?.user.id ?? null;
      ({ error } = await producao.from("producao_ocorrencias").insert({ ...leitura.ocorrencia, organization_id: organizationId, data_id: dataId, criado_por: quem }));
    }
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode registrar ocorrências aqui." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!ocorrencia) return;
    confirmDelete({
      title: "Apagar ocorrência?",
      description: "A ocorrência sai do relatório do dia.",
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_ocorrencias").delete().eq("id", ocorrencia.id);
        if (error) throw new Error("Não foi possível apagar a ocorrência.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={ocorrencia ? "Editar ocorrência" : "Nova ocorrência"}
      onClose={onClose}
      footer={fechar => (
        <>
          {ocorrencia && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : ocorrencia ? "Salvar" : "Registrar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Tipo</span>
            <Dropdown value={tipo} onChange={setTipo} options={TIPOS_DE_OCORRENCIA.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_OCORRENCIA[valor] }))} />
          </div>
          <div>
            <span className={ROTULO}>Gravidade</span>
            <Dropdown value={gravidade} onChange={setGravidade} options={GRAVIDADES_DA_OCORRENCIA.map(valor => ({ value: valor, label: ROTULO_DA_GRAVIDADE[valor] }))} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="ocorrencia-descricao">O que aconteceu</label>
          <textarea id="ocorrencia-descricao" autoFocus rows={4} className={CAMPO_TEXTO} value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={2000} disabled={salvando} placeholder="A mesa de som caiu no meio do ensaio." />
        </div>
        <div>
          <label className={ROTULO} htmlFor="ocorrencia-providencia">Providência (opcional)</label>
          <textarea id="ocorrencia-providencia" rows={3} className={CAMPO_TEXTO} value={providencia} onChange={event => setProvidencia(event.target.value)} maxLength={1000} disabled={salvando} placeholder="O que foi feito ou combinado." />
        </div>
        <p className="text-[0.6875rem] text-black/40">A descrição e a providência não entram no histórico de alterações. Evite nomes de pessoas e dados de saúde quando não forem necessários.</p>
      </div>
    </TopSheet>
  );
}

/** As ocorrências do dia (PD7.8): o que aconteceu, a gravidade, a providência e se já foi resolvida. */
export function OcorrenciasDaData({ organizationId, data, podeEditar }: { organizationId: string; data: { id: string; fuso: string }; podeEditar: boolean }) {
  const [itens, setItens] = useState<Ocorrencia[] | null>(null);
  const [folha, setFolha] = useState<{ ocorrencia: Ocorrencia | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: linhas, error } = await clienteDaProducao(createClient()).from("producao_ocorrencias")
        .select("id, tipo, gravidade, descricao, providencia, ocorreu_em, resolvida").eq("data_id", data.id);
      if (!ativo) return;
      setItens(linhas ?? []);
      setErro(error ? "Não foi possível carregar as ocorrências. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [data.id, versao]);

  const ordenadas = useMemo(() => ordenarOcorrencias(itens ?? []), [itens]);
  const resumo = useMemo(() => resumoDasOcorrencias(itens ?? []), [itens]);

  async function resolver(ocorrencia: Ocorrencia) {
    setErro(null);
    setItens(atual => (atual ?? []).map(item => (item.id === ocorrencia.id ? { ...item, resolvida: !item.resolvida } : item)));
    const { error } = await clienteDaProducao(createClient()).from("producao_ocorrencias").update({ resolvida: !ocorrencia.resolvida }).eq("id", ocorrencia.id);
    if (error) { setVersao(atual => atual + 1); setErro("Não foi possível marcar a ocorrência. Tente de novo."); }
  }

  return (
    <section aria-labelledby="ocorrencias" className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="ocorrencias" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Ocorrências{resumo.abertas > 0 ? ` · ${resumo.abertas} em aberto` : ""}</h2>
        {podeEditar && (
          <PrimaryListAction onClick={() => setFolha({ ocorrencia: null })}><Plus size={13} aria-hidden="true" /> Nova ocorrência</PrimaryListAction>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {itens === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : ordenadas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhuma ocorrência neste dia</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Registre o que acontecer durante o dia (um problema técnico, de segurança, um atraso), com a gravidade e a providência.</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {ordenadas.map(item => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className={`block text-[0.8125rem] ${item.resolvida ? "text-black/45 line-through" : "font-medium text-[#282525]"}`}>{item.descricao}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-black/45">
                  {ROTULO_DO_TIPO_DE_OCORRENCIA[item.tipo]} · <span style={{ color: item.resolvida ? undefined : COR_DA_GRAVIDADE[item.gravidade] }}>gravidade {ROTULO_DA_GRAVIDADE[item.gravidade].toLowerCase()}</span> · {instanteParaHoraLocal(item.ocorreu_em, data.fuso).hora}{item.resolvida ? " · resolvida" : ""}
                </span>
                {item.providencia && <span className="mt-0.5 block text-[0.6875rem] text-black/55">Providência: {item.providencia}</span>}
              </span>
              {podeEditar && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => void resolver(item)} aria-pressed={item.resolvida} aria-label={item.resolvida ? "Reabrir ocorrência" : "Marcar como resolvida"} title={item.resolvida ? "Resolvida (reabrir)" : "Marcar como resolvida"} className={`flex h-10 w-10 items-center justify-center rounded transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-[#7259B5] ${item.resolvida ? "text-[#2E8932]" : "text-black/30"}`}><Check size={15} aria-hidden="true" /></button>
                  <button type="button" onClick={() => setFolha({ ocorrencia: item })} aria-label="Editar ocorrência" title="Editar" className="flex h-10 w-10 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} aria-hidden="true" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {folha && <OcorrenciaSheet organizationId={organizationId} dataId={data.id} ocorrencia={folha.ocorrencia} onClose={() => setFolha(null)} onSaved={() => setVersao(atual => atual + 1)} />}
    </section>
  );
}
