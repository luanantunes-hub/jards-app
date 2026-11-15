"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CATEGORIAS_DA_COTA, type CategoriaDaCota } from "@/lib/producao/estados";
import {
  COR_DA_CATEGORIA, lerPintura, lerSetor, mapaDosSetores, mensagemDoErroDePlateia, resumoDaPlateia, ROTULO_DA_CATEGORIA,
  type CotaDoSetor, type SetorDaSala,
} from "@/lib/producao/plateia";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const APAGAR = "mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

const Erro = ({ texto }: { texto: string }) => <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;

function SetorSheet({ organizationId, salaId, setor, onClose, onSalvou }: { organizationId: string; salaId: string; setor: SetorDaSala | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [lugares, setLugares] = useState(setor ? String(setor.lugares) : "");
  const [ordem, setOrdem] = useState(setor ? String(setor.ordem) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerSetor({ nome, lugares, ordem });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = setor
      ? await producao.from("producao_setores").update(leitura.valor).eq("id", setor.id)
      : await producao.from("producao_setores").insert({ organization_id: organizationId, sala_id: salaId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDePlateia(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!setor) return;
    confirmDelete({
      title: "Apagar setor?",
      description: `“${setor.nome}” sai da sala, com o que está pintado nele em todas as sessões.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_setores").delete().eq("id", setor.id);
        if (error) throw new Error("Não foi possível apagar o setor.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={setor ? "Editar setor" : "Novo setor"}
      onClose={onClose}
      footer={fechar => (
        <>
          {setor && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : setor ? "Salvar" : "Criar setor"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div><label className={ROTULO} htmlFor="set-nome">Nome do setor</label><input id="set-nome" className={CAMPO} value={nome} maxLength={60} onChange={event => setNome(event.target.value)} disabled={salvando} placeholder="Plateia baixa" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="set-lugares">Lugares</label><input id="set-lugares" inputMode="numeric" className={CAMPO} value={lugares} onChange={event => setLugares(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor="set-ordem">Ordem (opcional)</label><input id="set-ordem" inputMode="numeric" className={CAMPO} value={ordem} onChange={event => setOrdem(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="0" /></div>
        </div>
      </div>
    </TopSheet>
  );
}

function PinturaSheet({ organizationId, sessaoId, setor, cotas, onClose, onSalvou }: { organizationId: string; sessaoId: string; setor: SetorDaSala; cotas: CotaDoSetor[]; onClose: () => void; onSalvou: () => void }) {
  const [valores, setValores] = useState<Partial<Record<CategoriaDaCota, string>>>(() => Object.fromEntries(cotas.map(cota => [cota.categoria, String(cota.lugares)])));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const soma = CATEGORIAS_DA_COTA.reduce((total, categoria) => total + (Number(valores[categoria]) || 0), 0);

  async function salvar(fechar: () => void) {
    const leitura = lerPintura(setor, cotas, valores);
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    for (const mudanca of leitura.mudancas) {
      const { error } = mudanca.acao === "apagar"
        ? await producao.from("producao_setor_cotas").delete().eq("id", mudanca.id as string)
        : mudanca.acao === "alterar"
          ? await producao.from("producao_setor_cotas").update({ lugares: mudanca.lugares }).eq("id", mudanca.id as string)
          : await producao.from("producao_setor_cotas").insert({ organization_id: organizationId, sessao_id: sessaoId, setor_id: setor.id, categoria: mudanca.categoria, lugares: mudanca.lugares });
      if (error) { setSalvando(false); setErro(mensagemDoErroDePlateia(error)); onSalvou(); return; }
    }
    setSalvando(false);
    onSalvou();
    fechar();
  }

  return (
    <TopSheet
      titulo={`Pintar ${setor.nome}`}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : "Salvar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div className="space-y-2.5">
          {CATEGORIAS_DA_COTA.map(categoria => (
            <div key={categoria} className="flex items-center gap-3">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: COR_DA_CATEGORIA[categoria] }} />
              <label className="w-32 text-[0.8125rem] text-[#282525]" htmlFor={`cota-${categoria}`}>{ROTULO_DA_CATEGORIA[categoria]}</label>
              <input id={`cota-${categoria}`} inputMode="numeric" className={`${CAMPO} w-28`} value={valores[categoria] ?? ""} onChange={event => setValores(atual => ({ ...atual, [categoria]: event.target.value.replace(/\D/g, "") }))} disabled={salvando} placeholder="0" />
            </div>
          ))}
        </div>
        <p className={`text-[0.75rem] tabular-nums ${soma > setor.lugares ? "text-[#B23B3B]" : "text-black/55"}`}>{soma} de {setor.lugares} lugares com destino{soma <= setor.lugares ? ` · ${setor.lugares - soma} sem destino` : " · passou do setor"}</p>
      </div>
    </TopSheet>
  );
}

/** O mapa da plateia de uma sessão (PD7.7): os setores da sala e o que a sessão faz com os lugares de cada um, pintado por categoria. */
export function PlateiaDaSessao({ organizationId, sessaoId, podeEditar }: { organizationId: string; sessaoId: string; podeEditar: boolean }) {
  const [salaId, setSalaId] = useState<string | null>(null);
  const [salaNome, setSalaNome] = useState("");
  const [setores, setSetores] = useState<SetorDaSala[] | null>(null);
  const [cotas, setCotas] = useState<CotaDoSetor[]>([]);
  const [folhaSetor, setFolhaSetor] = useState<{ setor: SetorDaSala | null } | null>(null);
  const [pintando, setPintando] = useState<SetorDaSala | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const ses = await producao.from("producao_sessoes").select("pauta_id").eq("id", sessaoId).maybeSingle();
      const pau = ses.data ? await producao.from("producao_pautas").select("sala_id").eq("id", ses.data.pauta_id).maybeSingle() : { data: null, error: null };
      const sala = pau.data?.sala_id ?? null;
      const [nome, set, cot] = sala
        ? await Promise.all([
            producao.from("producao_salas").select("nome").eq("id", sala).maybeSingle(),
            producao.from("producao_setores").select("id, nome, lugares, ordem").eq("sala_id", sala).order("ordem").order("nome"),
            producao.from("producao_setor_cotas").select("id, setor_id, categoria, lugares").eq("sessao_id", sessaoId),
          ])
        : [{ data: null, error: null }, { data: [], error: null }, { data: [], error: null }];
      if (!ativo) return;
      setSalaId(sala);
      setSalaNome(nome.data?.nome ?? "");
      setSetores(set.data ?? []);
      setCotas(cot.data ?? []);
      setErro(ses.error || pau.error || nome.error || set.error || cot.error ? "Não foi possível carregar a plateia. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [sessaoId, versao]);

  const mapa = useMemo(() => mapaDosSetores(setores ?? [], cotas), [setores, cotas]);
  const resumo = useMemo(() => resumoDaPlateia(mapa), [mapa]);
  const recarregar = () => setVersao(atual => atual + 1);

  if (setores === null) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <div className="space-y-6">
      {erro && <Erro texto={erro} />}

      <section aria-labelledby="resumo-plateia">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="resumo-plateia" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Plateia{salaNome ? ` · ${salaNome}` : ""}</h2>
          {podeEditar && salaId && <button type="button" onClick={() => setFolhaSetor({ setor: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Novo setor</button>}
        </div>
        {setores.length === 0 ? (
          <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.8125rem] font-medium text-black/55">Esta sala ainda não tem setores</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Crie os setores (plateia baixa, balcão, camarote...) com o número de lugares. Depois, para cada sessão, pinte quantos vão para venda, patrocinador, gratuidade, acessibilidade, imprensa ou bloqueio.</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[0.75rem] tabular-nums text-black/55">
              {resumo.totalDeLugares} lugares
              {resumo.porCategoria.map(item => ` · ${item.lugares} ${ROTULO_DA_CATEGORIA[item.categoria].toLowerCase()}`).join("")}
              {` · ${resumo.semDestino} sem destino`}
            </p>
            <ul className="space-y-3">
              {mapa.map(item => (
                <li key={item.setor.id} className="rounded border bg-white px-4 py-3" style={{ borderColor: item.estourado ? "#B07A1447" : "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <p className="min-w-0 flex-1 basis-40 truncate text-[0.8125rem] font-medium text-[#282525]">{item.setor.nome}</p>
                    <p className="flex items-center gap-1 text-[0.75rem] tabular-nums text-black/55">
                      {item.estourado && <TriangleAlert size={12} aria-hidden="true" className="text-[#B07A14]" />}
                      {item.pintados} de {item.setor.lugares} com destino{item.estourado ? " · acima do setor" : item.semDestino > 0 ? ` · ${item.semDestino} sem destino` : ""}
                    </p>
                    {podeEditar && (
                      <span className="flex gap-1.5">
                        <button type="button" className={BOTAO_PEQUENO} onClick={() => setPintando(item.setor)}>Pintar</button>
                        <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaSetor({ setor: item.setor })}>Editar setor</button>
                      </span>
                    )}
                  </div>
                  <div role="img" aria-label={`${item.setor.nome}: ${item.segmentos.map(segmento => `${segmento.lugares} ${ROTULO_DA_CATEGORIA[segmento.categoria].toLowerCase()}`).join(", ") || "nada pintado"}`}
                    className="mt-2.5 flex h-5 w-full overflow-hidden rounded-sm bg-black/[.06]">
                    {item.segmentos.map(segmento => (
                      <span key={segmento.categoria} title={`${ROTULO_DA_CATEGORIA[segmento.categoria]}: ${segmento.lugares}`} className="h-full border-r-2 border-white last:border-r-0"
                        style={{ width: `${Math.min((segmento.lugares / Math.max(item.setor.lugares, item.pintados)) * 100, 100)}%`, backgroundColor: COR_DA_CATEGORIA[segmento.categoria] }} />
                    ))}
                  </div>
                  {item.segmentos.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-black/55">
                      {item.segmentos.map(segmento => (
                        <li key={segmento.categoria} className="flex items-center gap-1.5 tabular-nums">
                          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_DA_CATEGORIA[segmento.categoria] }} />
                          {ROTULO_DA_CATEGORIA[segmento.categoria]} {segmento.lugares}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {folhaSetor && salaId && <SetorSheet organizationId={organizationId} salaId={salaId} setor={folhaSetor.setor} onClose={() => setFolhaSetor(null)} onSalvou={recarregar} />}
      {pintando && <PinturaSheet organizationId={organizationId} sessaoId={sessaoId} setor={pintando} cotas={cotas.filter(cota => cota.setor_id === pintando.id)} onClose={() => setPintando(null)} onSalvou={recarregar} />}
    </div>
  );
}
