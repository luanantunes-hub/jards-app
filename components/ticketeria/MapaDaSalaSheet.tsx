"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Redo2, Undo2 } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { desfazer, podeDesfazer, podeRefazer, refazer, registrar, versoesNovas, type Versoes } from "@/lib/ticketeria/desfazer-refazer";
import { lerLayout } from "@/lib/ticketeria/mapa-layout";
import {
  CORES_DOS_SETORES, ERRO_DA_PLANTA_EM_TEXTO, comCorDoSetor, comPalcoDaSala, completarPlanta, comporSala, conferirPlanta, lerPlanta, moverSetor, partesDoBlocoNaSala, plantaAutomatica, posicionarSetor,
  type Planta, type SetorDesenhado,
} from "@/lib/ticketeria/mapa-sala";
import type { SalaDoEspaco } from "@/lib/ticketeria/salas";
import { MapaPorLayout } from "@/components/ticketeria/MapaPorLayout";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";

// O editor do mapa da sala inteira: os setores da sala (cada um com o seu desenho em blocos) num desenho só, para o produtor pôr cada um no lugar e escolher a cor. As contas estão em
// lib/ticketeria/mapa-sala.ts; o desenho é o MapaPorLayout. Grava em ticketeria_salas.planta (quem edita a sala já pode).

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const BOTAO = `inline-flex h-8 items-center justify-center rounded-xl border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`;
const BOTAO_PASSO = `flex h-7 w-7 items-center justify-center rounded-lg border border-black/[.12] bg-white text-black/60 transition hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-35 ${FOCO}`;

export function MapaDaSalaSheet({ sala, nomeDoLocal, onClose, onSaved }: { sala: SalaDoEspaco; nomeDoLocal: string; onClose: () => void; onSaved: () => void }) {
  const [desenhados, setDesenhados] = useState<SetorDesenhado[] | null>(null);
  const [semDesenho, setSemDesenho] = useState<string[]>([]);
  const [tinhaPlanta, setTinhaPlanta] = useState(false);
  const [versoes, setVersoes] = useState<Versoes<Planta> | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null); // o id do bloco tocado (na sala: "setor:bloco")
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const partida = useRef<{ bx: number; by: number; ex: number; ey: number } | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const ticketeria = clienteDaTicketeria(createClient());
      const [{ data: setores, error: e1 }, { data: linha, error: e2 }] = await Promise.all([
        ticketeria.from("ticketeria_setores").select("id, nome, layout, numerado").eq("sala_id", sala.id).eq("arquivado", false).order("ordem").order("nome"),
        ticketeria.from("ticketeria_salas").select("planta").eq("id", sala.id).maybeSingle(),
      ]);
      if (!ativo) return;
      if (e1 || e2) { setErro("Não foi possível carregar a sala. Feche e abra de novo."); setDesenhados([]); return; }
      const lista: SetorDesenhado[] = [];
      const fora: string[] = [];
      for (const s of setores ?? []) {
        if (!s.numerado) continue;
        const layout = lerLayout(s.layout);
        if (layout) lista.push({ id: s.id, nome: s.nome, layout }); else fora.push(s.nome);
      }
      const guardada = lerPlanta(linha?.planta);
      setDesenhados(lista);
      setSemDesenho(fora);
      setTinhaPlanta(!!guardada);
      if (lista.length > 0) setVersoes(versoesNovas(completarPlanta(guardada, lista)));
    })();
    return () => { ativo = false; };
  }, [sala.id]);

  const planta = versoes?.atual ?? null;
  const montada = useMemo(() => (planta && desenhados ? comporSala(planta, desenhados) : null), [planta, desenhados]);
  const erros = planta && desenhados ? conferirPlanta(planta, desenhados) : [];
  const setorEscolhido = escolhido ? partesDoBlocoNaSala(escolhido)?.setor ?? null : null;
  const nomes = useMemo(() => new Map((desenhados ?? []).map(s => [s.id, s.nome])), [desenhados]);

  function mudar(nova: Planta, agrupar = false) {
    if (!desenhados) return;
    const agora = Date.now();
    const comPalco = comPalcoDaSala(nova, desenhados);
    setVersoes(v => (v ? registrar(v, comPalco, agora, agrupar) : v));
  }

  async function gravar(fechar: () => void, tirar = false) {
    if (!desenhados || (!tirar && (!planta || erros.length > 0))) { if (erros.length > 0) setErro(ERRO_DA_PLANTA_EM_TEXTO[erros[0]]); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaTicketeria(createClient()).from("ticketeria_salas").update({ planta: tirar ? null : (planta as unknown as Json) }).eq("id", sala.id);
    setSalvando(false);
    if (error) { setErro(error.code === "23514" ? "O banco não aceitou este mapa da sala. Confira os setores e tente de novo." : "Não foi possível salvar o mapa da sala."); return; }
    onSaved();
    fechar();
  }

  const entrada = planta?.setores.find(e => e.setor === setorEscolhido) ?? null;
  const passo = (dx: number, dy: number) => { if (planta && setorEscolhido) mudar(moverSetor(planta, setorEscolhido, dx, dy)); };

  return (
    <TopSheet titulo="Mapa da sala" etiqueta={`${nomeDoLocal} · ${sala.nome}`} largura="46rem" onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Salvar o mapa" onSalvar={() => void gravar(fechar)} onApagar={tinhaPlanta ? () => void gravar(fechar, true) : undefined} rotuloApagar="Voltar ao mapa por setor" arquivar />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {desenhados === null && <p role="status" className="text-[0.8125rem] text-black/55">Lendo a sala…</p>}
        {desenhados !== null && desenhados.length === 0 && !erro && (
          <p className="text-[0.8125rem] leading-relaxed text-black/60">Nenhum setor desta sala está desenhado em blocos. Abra um setor numerado, monte o mapa na ferramenta Desenho e volte aqui para juntá-los no mapa da sala.</p>
        )}
        {planta && montada && versoes && (
          <>
            <p className="text-[0.8125rem] text-black/60">Arraste um setor para pô-lo no lugar na sala. Quem compra vê a sala inteira, cada setor na sua cor, e escolhe os lugares no setor do ingresso.</p>
            <div className="sticky top-0 z-10 rounded-xl border bg-[#fbfbfb] px-4 py-5 shadow-[0_6px_16px_-8px_rgba(13,13,13,.18)]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <MapaPorLayout layout={montada.layout} modo="produtor" rotuloDoMapa="Mapa da sala" cores={montada.cores} rotulos={nomes}
                desenho={{
                  blocoEscolhido: escolhido,
                  onEscolher: id => {
                    setEscolhido(id);
                    const b = id ? montada.layout.blocos.find(x => x.id === id) : undefined;
                    const e = b && planta.setores.find(x => x.setor === partesDoBlocoNaSala(b.id)?.setor);
                    partida.current = b && e ? { bx: b.x, by: b.y, ex: e.x, ey: e.y } : null;
                  },
                  onMover: (id, x, y) => {
                    const p = partida.current;
                    const setor = partesDoBlocoNaSala(id)?.setor;
                    if (p && setor) mudar(posicionarSetor(planta, setor, p.ex + (x - p.bx), p.ey + (y - p.by)), true);
                  },
                }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className={BOTAO} onClick={() => desenhados && mudar(plantaAutomatica(desenhados, planta.palco?.rotulo))}>Arrumar sozinho</button>
              <div className="flex items-center gap-1.5">
                <button type="button" className={BOTAO} onClick={() => setVersoes(v => (v ? desfazer(v) : v))} disabled={!podeDesfazer(versoes)} aria-label="Desfazer"><Undo2 size={14} aria-hidden="true" className="mr-1.5" />Desfazer</button>
                <button type="button" className={BOTAO} onClick={() => setVersoes(v => (v ? refazer(v) : v))} disabled={!podeRefazer(versoes)} aria-label="Refazer"><Redo2 size={14} aria-hidden="true" className="mr-1.5" />Refazer</button>
              </div>
            </div>
            <ul className="space-y-2" aria-label="Setores da sala">
              {planta.setores.map(e => (
                <li key={e.setor} className={`rounded-xl border bg-white px-4 py-3 ${e.setor === setorEscolhido ? "border-[#6450D2]" : ""}`} style={e.setor === setorEscolhido ? undefined : { borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[0.8125rem] text-[#282525]"><span aria-hidden="true" className="h-3.5 w-3.5 rounded-md" style={{ background: e.cor }} />{nomes.get(e.setor) ?? "Setor"}</span>
                    <div role="radiogroup" aria-label={`Cor de ${nomes.get(e.setor) ?? "setor"}`} className="flex items-center gap-1.5">
                      {CORES_DOS_SETORES.map(cor => (
                        <button key={cor} type="button" role="radio" aria-checked={e.cor === cor} aria-label={`Cor ${cor}`} onClick={() => mudar(comCorDoSetor(planta, e.setor, cor))}
                          className={`h-5 w-5 rounded-full border-2 transition ${FOCO} ${e.cor === cor ? "border-[#282525]" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]"}`} style={{ background: cor }} />
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {entrada && (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <span className="text-[0.8125rem] text-black/65">Mover {nomes.get(entrada.setor)}</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover o setor para a esquerda" onClick={() => passo(-1, 0)}><ArrowLeft size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover o setor para cima" onClick={() => passo(0, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover o setor para baixo" onClick={() => passo(0, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover o setor para a direita" onClick={() => passo(1, 0)}><ArrowRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
            )}
            {erros.length > 0 && <p role="alert" className="rounded-xl border border-[#B23B3B]/25 bg-[#B23B3B]/[.04] px-4 py-3 text-[0.8125rem] text-[#B23B3B]">{ERRO_DA_PLANTA_EM_TEXTO[erros[0]]}</p>}
          </>
        )}
        {semDesenho.length > 0 && (
          <p className="text-[0.75rem] leading-relaxed text-black/50">Ficam de fora do mapa da sala, por ainda serem só uma lista de fileiras: {semDesenho.join(", ")}. Desenhe-os em blocos para incluí-los.</p>
        )}
      </div>
    </TopSheet>
  );
}
