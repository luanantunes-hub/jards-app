"use client";

import { useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerSetor, mensagemDoErroDoEvento } from "@/lib/ticketeria/eventos";
import { adicionarFileira, alternarBloqueio, comCorredor, comTipoNoLugar, lerMapa, maisLugares, mapaNovo, menosLugares, mensagemDoErroDoMapa, paraSalvar, resumoDoMapa, resumoEmTexto, type FileiraDoMapa } from "@/lib/ticketeria/mapa";
import { MapaEditorSheet } from "@/components/ticketeria/AssentosView";
import { conferirLayout, lerLayout, type Layout } from "@/lib/ticketeria/mapa-layout";
import { ERRO_DO_LAYOUT_EM_TEXTO } from "@/lib/ticketeria/mapa-layout-editor";
import { Aviso, CAMPO, ROTULO, Rodape } from "@/components/ticketeria/FolhasDosEventos";

export type SetorEditavel = { id: string; nome: string; lugares: number; arquivado: boolean; numerado: boolean; corredor_no_meio: boolean };

/** A folha do setor: nome, e a quantidade de lugares ou, com a chave "Lugares numerados", o mapa de fileiras e lugares (montado num editor próprio). */
export function SetorSheet({ organizationId, localId, salaId, nomeDoLocal, setor, onClose, onSaved }: { organizationId: string; localId: string; /** A sala do setor novo; sem ela, vale a primeira sala em uso do espaço. */ salaId?: string; nomeDoLocal?: string; setor?: SetorEditavel; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [lugares, setLugares] = useState(setor ? String(setor.lugares) : "");
  const [numerado, setNumerado] = useState(setor?.numerado ?? false);
  const [corredor, setCorredor] = useState(setor?.corredor_no_meio ?? true);
  // O mapa guardado no banco (null: ainda lendo) e o rascunho do editor (null: editor fechado).
  const [mapa, setMapa] = useState<FileiraDoMapa[] | null>(setor ? null : []);
  const [rascunho, setRascunho] = useState<FileiraDoMapa[] | null>(null);
  // O layout (o desenho em blocos) guardado no banco (null: o setor é só a lista de fileiras) e o do editor aberto.
  const [layoutDoBanco, setLayoutDoBanco] = useState<Layout | null>(null);
  // O desenho do setor (o layout que a sala distribuiu para ele), sem mexer: aqui só se bloqueiam lugares e se marca o tipo. O desenho se faz na sala toda (DesenhoDaSalaSheet).
  const [layout, setLayout] = useState<Layout | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDoMapa, setErroDoMapa] = useState<string | null>(null);

  useEffect(() => {
    if (!setor) return;
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [{ data }, { data: linha }] = await Promise.all([
        ticketeria.rpc("fn_ticketeria_mapa_do_setor", { p_setor: setor.id }),
        ticketeria.from("ticketeria_setores").select("layout").eq("id", setor.id).maybeSingle(),
      ]);
      if (!ativo) return;
      setMapa(lerMapa(data));
      setLayoutDoBanco(lerLayout(linha?.layout));
    })();
    return () => { ativo = false; };
  }, [setor]);

  const temMapa = (mapa?.length ?? 0) > 0;


  async function gravar(fechar: () => void, mudanca?: { arquivado: boolean }) {
    const leitura = lerSetor({ nome, lugares: numerado ? String(setor?.lugares ?? 1) : lugares });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    if (numerado && !temMapa) { setErro(mensagemDoErroDoMapa({ message: "mapa_vazio" })); return; }
    setSalvando(true);
    setErro(null);
    const ticketeria = clienteDaTicketeria(createClient());
    const campos = numerado ? { nome: leitura.valor.nome, numerado: true } : { ...leitura.valor, numerado: false };
    const { error } = setor
      ? await ticketeria.from("ticketeria_setores").update({ ...campos, ...mudanca }).eq("id", setor.id)
      : await ticketeria.from("ticketeria_setores").insert({ organization_id: organizationId, local_id: localId, ...(salaId ? { sala_id: salaId } : {}), ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(error.message?.includes("mapa_") ? mensagemDoErroDoMapa(error) : mensagemDoErroDoEvento(error)); return; }
    onSaved();
    fechar();
  }

  async function salvarMapa() {
    if (!setor || !rascunho) return;
    setSalvando(true);
    setErroDoMapa(null);
    const problemas = layout ? conferirLayout(layout) : [];
    if (problemas.length > 0) { setSalvando(false); setErroDoMapa(ERRO_DO_LAYOUT_EM_TEXTO[problemas[0]]); return; }
    // Sempre pela função com layout: sem layout (null), ela tira o desenho que estiver guardado e o setor volta a ser a lista de fileiras.
    const { error } = await clienteDaTicketeria(createClient()).rpc("fn_ticketeria_salvar_mapa_com_layout", { p_setor: setor.id, p_fileiras: paraSalvar(rascunho), p_corredor: corredor, p_layout: layout as unknown as Json | null });
    setSalvando(false);
    if (error) { setErroDoMapa(mensagemDoErroDoMapa(error)); return; }
    setMapa(rascunho);
    setLayoutDoBanco(layout);
    setNumerado(true);
    setRascunho(null);
    onSaved();
  }

  if (rascunho && setor) {
    const r = resumoDoMapa(rascunho);
    return (
      <MapaEditorSheet setor={nome.trim() || setor.nome} local={nomeDoLocal ?? ""} fileiras={comCorredor(rascunho, corredor)} lugares={r.aVenda} bloqueados={r.bloqueados} vendidos={r.vendidos} corredor={corredor} erro={erroDoMapa} salvando={salvando}
        onCorredor={setCorredor} onAlternar={(f, n) => setRascunho(m => (m ? alternarBloqueio(m, f, n) : m))} onMarcarTipo={(f, n, t) => setRascunho(m => (m ? comTipoNoLugar(m, f, n, t) : m))}
        layout={layout} onAdicionarFileira={() => setRascunho(m => (m ? adicionarFileira(m) : m))}
        onMaisLugares={f => setRascunho(m => (m ? maisLugares(m, f) : m))} onMenosLugares={f => setRascunho(m => (m ? menosLugares(m, f) : m))} onClose={() => { setRascunho(null); setErroDoMapa(null); }} onSalvar={() => void salvarMapa()} />
    );
  }

  return (
    <TopSheet
      titulo={setor ? "Editar setor" : "Novo setor"}
      etiqueta={nomeDoLocal}
      onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo={setor ? "Salvar" : "Criar setor"} onSalvar={() => void gravar(fechar)} onApagar={setor ? () => void gravar(fechar, { arquivado: !setor.arquivado }) : undefined} rotuloApagar={setor?.arquivado ? "Tirar do arquivo" : "Arquivar"} arquivar />}
    >
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor="st-nome">Nome</label><input id="st-nome" autoFocus className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} placeholder="Plateia" maxLength={120} disabled={salvando} /></div>
        {setor ? (
          <>
            <div className="flex items-start justify-between gap-4 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="min-w-0"><p className="text-[0.8125rem] font-normal text-[#282525]">Lugares numerados</p><p className="mt-0.5 text-[0.75rem] leading-relaxed text-black/50">Quem compra escolhe os lugares no mapa. Sem isto, só se compra a quantidade.</p></div>
              <button type="button" role="switch" aria-checked={numerado} aria-label="Lugares numerados" disabled={salvando || mapa === null} onClick={() => setNumerado(v => !v)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50 ${numerado ? "bg-[#7259B5]" : "bg-black/20"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${numerado ? "left-[1.375rem]" : "left-0.5"}`} /></button>
            </div>
            {numerado ? (
              <div className="rounded-xl border px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/40">Mapa</p>
                <p className="mt-1 text-[0.8125rem] text-[#282525]">{mapa === null ? "Lendo o mapa…" : temMapa ? resumoEmTexto(resumoDoMapa(mapa)) : "Ainda sem mapa. Monte as fileiras e os lugares."}</p>
                <button type="button" disabled={salvando || mapa === null} onClick={() => { setErroDoMapa(null); setRascunho(temMapa && mapa ? mapa : mapaNovo()); setLayout(layoutDoBanco); }} className="mt-3 inline-flex h-9 items-center rounded-xl border border-black/[.12] bg-white px-3.5 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50">{temMapa ? "Editar o mapa" : "Montar o mapa"}</button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <div><label className={ROTULO} htmlFor="st-lugares">Lugares</label><input id="st-lugares" inputMode="numeric" className={CAMPO} value={lugares} onChange={e => setLugares(e.target.value)} placeholder="300" disabled={salvando} /></div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <div><label className={ROTULO} htmlFor="st-lugares">Lugares</label><input id="st-lugares" inputMode="numeric" className={CAMPO} value={lugares} onChange={e => setLugares(e.target.value)} placeholder="300" disabled={salvando} /></div>
            </div>
            <p className="text-[0.75rem] text-black/55">A capacidade do local é a soma dos setores. Depois de criar o setor, dá para ligar os lugares numerados e montar o mapa.</p>
          </>
        )}
      </div>
    </TopSheet>
  );
}
