"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { LUZES_DA_OBRA, POSICOES_NA_EXPOSICAO, type LuzDaObra, type PosicaoNaExposicao } from "@/lib/producao/estados";
import {
  lerObraNaSala, medidasDaObra, mensagemDoErroDeExpografia, ordenarMontagem, pendenciasDaObra, progressoDaMontagem, ROTULO_DA_LUZ, ROTULO_DA_POSICAO,
  type ObraDeArte, type ObraNaSala,
} from "@/lib/producao/expografia";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const APAGAR = "mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

const Erro = ({ texto }: { texto: string }) => <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;

function ObraSheet({ organizationId, salaId, obras, obra, livres, onClose, onSalvou }: {
  organizationId: string; salaId: string; obras: Map<string, ObraDeArte>; obra: ObraNaSala | null; livres: ObraDeArte[]; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [itemId, setItemId] = useState(obra?.item_id ?? "");
  const [posicao, setPosicao] = useState<PosicaoNaExposicao>(obra?.posicao ?? "parede");
  const [altura, setAltura] = useState(obra?.altura_instalacao_cm === null || obra === null ? "" : String(obra?.altura_instalacao_cm));
  const [ordem, setOrdem] = useState(obra ? String(obra.ordem_montagem) : "");
  const [luz, setLuz] = useState<LuzDaObra>(obra?.luz ?? "difusa");
  const [lux, setLux] = useState(obra?.lux === null || obra === null ? "" : String(obra?.lux));
  const [notas, setNotas] = useState(obra?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerObraNaSala({ itemId, posicao, altura, ordem, luz, lux, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { item_id: _item, ...resto } = leitura.valor;
    void _item;
    const { error } = obra
      ? await producao.from("producao_expografia").update(resto).eq("id", obra.id)
      : await producao.from("producao_expografia").insert({ organization_id: organizationId, sala_id: salaId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeExpografia(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!obra) return;
    confirmDelete({
      title: "Tirar a obra da sala?",
      description: `${obras.get(obra.item_id)?.nome ?? "A obra"} sai da planta desta sala. Ela continua no inventário.`,
      confirmLabel: "Tirar", pendingLabel: "Tirando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_expografia").delete().eq("id", obra.id);
        if (error) throw new Error("Não foi possível tirar a obra da sala.");
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={obra ? "Editar obra na sala" : "Colocar obra na sala"}
      onClose={onClose}
      footer={fechar => (
        <>
          {obra && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Tirar da sala</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : obra ? "Salvar" : "Colocar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {obra ? (
          <p className="text-[0.8125rem] font-medium text-[#282525]">{obras.get(obra.item_id)?.nome ?? "Obra"}</p>
        ) : (
          <div>
            <span className={ROTULO}>Obra do inventário</span>
            <Dropdown ariaLabel="Obra" value={itemId} onChange={setItemId} disabled={salvando}
              options={[{ value: "", label: livres.length === 0 ? "Nenhuma obra de arte livre" : "Escolha a obra" }, ...livres.map(item => ({ value: item.id, label: item.nome }))]} />
            {livres.length === 0 && <p className="mt-1 text-[0.6875rem] text-black/45">Cadastre as obras no Inventário, na categoria “Obra de arte”.</p>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Onde fica</span>
            <Dropdown ariaLabel="Posição" value={posicao} onChange={valor => setPosicao(valor as PosicaoNaExposicao)} disabled={salvando} options={POSICOES_NA_EXPOSICAO.map(valor => ({ value: valor, label: ROTULO_DA_POSICAO[valor] }))} />
          </div>
          <div><label className={ROTULO} htmlFor="exp-altura">Altura da instalação (cm)</label><input id="exp-altura" inputMode="numeric" className={CAMPO} value={altura} onChange={event => setAltura(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="Centro da obra, do piso" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Luz</span>
            <Dropdown ariaLabel="Luz" value={luz} onChange={valor => setLuz(valor as LuzDaObra)} disabled={salvando} options={LUZES_DA_OBRA.map(valor => ({ value: valor, label: ROTULO_DA_LUZ[valor] }))} />
          </div>
          <div><label className={ROTULO} htmlFor="exp-lux">Nível de luz (lux)</label><input id="exp-lux" inputMode="numeric" className={CAMPO} value={lux} onChange={event => setLux(event.target.value.replace(/\D/g, ""))} disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor="exp-ordem">Ordem de montagem</label><input id="exp-ordem" inputMode="numeric" className={CAMPO} value={ordem} onChange={event => setOrdem(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="1 é a primeira a montar" /></div>
        <div><label className={ROTULO} htmlFor="exp-notas">Nota (opcional)</label><input id="exp-notas" className={CAMPO} value={notas} maxLength={300} onChange={event => setNotas(event.target.value)} disabled={salvando} placeholder="Por exemplo: longe da janela, trilho de luz 2" /></div>
      </div>
    </TopSheet>
  );
}

/** A planta expográfica de uma sala (PD8.5): as obras de arte, onde ficam, a altura, a luz e a ordem de montagem, com o andamento da montagem. */
export function ExpografiaDaSala({ organizationId, salaId, podeEditar }: { organizationId: string; salaId: string; podeEditar: boolean }) {
  const [obrasNaSala, setObrasNaSala] = useState<ObraNaSala[] | null>(null);
  const [inventario, setInventario] = useState<ObraDeArte[]>([]);
  const [folha, setFolha] = useState<{ obra: ObraNaSala | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [exp, inv] = await Promise.all([
        producao.from("producao_expografia").select("id, item_id, posicao, altura_instalacao_cm, ordem_montagem, luz, lux, notas, instalada_em").eq("sala_id", salaId),
        producao.from("producao_itens").select("id, nome, altura_cm, largura_cm, comprimento_cm").eq("organization_id", organizationId).eq("categoria", "obra_de_arte").eq("arquivado", false).order("nome"),
      ]);
      if (!ativo) return;
      setObrasNaSala(exp.data ?? []);
      setInventario(inv.data ?? []);
      setErro(exp.error || inv.error ? "Não foi possível carregar a exposição. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, salaId, versao]);

  const recarregar = () => setVersao(atual => atual + 1);
  const porItem = useMemo(() => new Map(inventario.map(item => [item.id, item])), [inventario]);
  const ordenadas = useMemo(() => ordenarMontagem(obrasNaSala ?? []), [obrasNaSala]);
  const progresso = useMemo(() => progressoDaMontagem(obrasNaSala ?? []), [obrasNaSala]);
  const livres = useMemo(() => inventario.filter(item => !(obrasNaSala ?? []).some(obra => obra.item_id === item.id)), [inventario, obrasNaSala]);

  async function alternarInstalada(obra: ObraNaSala) {
    setTrabalhando(obra.id);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_expografia").update({ instalada_em: obra.instalada_em ? null : new Date().toISOString() }).eq("id", obra.id);
    setTrabalhando(null);
    if (error) { setErro(mensagemDoErroDeExpografia(error)); return; }
    recarregar();
  }

  if (obrasNaSala === null) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  return (
    <div className="space-y-4">
      {erro && <Erro texto={erro} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.75rem] tabular-nums text-black/55">
          {progresso.total === 0 ? "Nenhuma obra nesta sala ainda" : `${progresso.instaladas} de ${progresso.total} ${progresso.total === 1 ? "obra instalada" : "obras instaladas"}${progresso.proxima ? ` · próxima: ${porItem.get(progresso.proxima.item_id)?.nome ?? "obra"}` : " · montagem completa"}`}
        </p>
        {podeEditar && <button type="button" onClick={() => setFolha({ obra: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Colocar obra</button>}
      </div>
      {ordenadas.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">A planta desta sala está vazia</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Coloque as obras de arte do inventário na sala: onde ficam (parede, piso, teto, vitrine), a altura, a luz e a ordem de montagem.</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {ordenadas.map(obra => {
            const item = porItem.get(obra.item_id);
            const pendencias = pendenciasDaObra(obra);
            const medidas = item ? medidasDaObra(item) : null;
            return (
              <li key={obra.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                {podeEditar
                  ? <input type="checkbox" checked={obra.instalada_em !== null} disabled={trabalhando === obra.id} onChange={() => void alternarInstalada(obra)} aria-label={`${item?.nome ?? "Obra"} instalada`} className="h-5 w-5 accent-[#282525]" />
                  : <span className="w-5 text-center text-[0.75rem] text-black/45">{obra.instalada_em ? "✓" : "·"}</span>}
                <span className="w-8 text-[0.75rem] tabular-nums text-black/45" title="Ordem de montagem">{obra.ordem_montagem}</span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className={`truncate text-[0.8125rem] font-medium ${obra.instalada_em ? "text-black/45" : "text-[#282525]"}`}>{item?.nome ?? "Obra"}{medidas ? <span className="font-normal text-black/45"> · {medidas}</span> : null}</p>
                  <p className="truncate text-[0.6875rem] text-black/45">
                    {[ROTULO_DA_POSICAO[obra.posicao], obra.altura_instalacao_cm !== null ? `a ${obra.altura_instalacao_cm.toLocaleString("pt-BR")} cm do piso` : null, `${ROTULO_DA_LUZ[obra.luz]}${obra.lux !== null ? ` (${obra.lux.toLocaleString("pt-BR")} lux)` : ""}`, obra.notas].filter(Boolean).join(" · ")}
                  </p>
                  {pendencias.length > 0 && <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-[#B07A14]"><TriangleAlert size={11} aria-hidden="true" /> {pendencias.join(" · ")}</p>}
                </div>
                {podeEditar && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolha({ obra })}>Editar</button>}
              </li>
            );
          })}
        </ul>
      )}
      {folha && <ObraSheet organizationId={organizationId} salaId={salaId} obras={porItem} obra={folha.obra} livres={livres} onClose={() => setFolha(null)} onSalvou={recarregar} />}
    </div>
  );
}
