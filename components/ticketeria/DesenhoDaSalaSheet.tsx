"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImageIcon, Plus } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { desfazer, podeDesfazer, podeRefazer, refazer, registrar, versoesNovas, type Versoes } from "@/lib/ticketeria/desfazer-refazer";
import {
  ERRO_DO_DESENHO_EM_TEXTO, acrescentarModelo, acrescentarSetorDeFileiras, ajustarPista, atribuirSetor, comCoresCompletas, comCorDoSetor, comFundoNoDesenho, comPalcoDoDesenho, conferirDesenho, desenhoDaPlanta, desenhoVazio,
  distribuirPorSetor, escalarFundoDoDesenho, fundoNovoDoDesenho, lugaresPorSetor, maisUmaPista, opacidadeDoFundoDoDesenho, plantaDoDesenho, posicionarFundoDoDesenho, posicionarPista, resolverConflitos, tirarPista,
  type DesenhoDaSala, type ErroDoDesenho,
} from "@/lib/ticketeria/desenho-da-sala";
import { lerMapa, mensagemDoErroDoMapa, paraSalvar, type FileiraDoMapa } from "@/lib/ticketeria/mapa";
import { comEstadosDoMapa, lerLayout, type Layout } from "@/lib/ticketeria/mapa-layout";
import { ERRO_DO_LAYOUT_EM_TEXTO, comAngulo, empurrarVizinhos, moverBloco } from "@/lib/ticketeria/mapa-layout-editor";
import { CORES_DOS_SETORES, caminhoDoFundoPelaUrl, completarPlanta, detalheDaArea, lerPlanta, urlDoFundo, type AreaNoDesenho, type SetorDesenhado, type SetorEmPe } from "@/lib/ticketeria/mapa-sala";
import type { SalaDoEspaco } from "@/lib/ticketeria/salas";
import { MapaPorLayout } from "@/components/ticketeria/MapaPorLayout";
import { EditorDoLayout, type EdicaoDaSala } from "@/components/ticketeria/EditorDoLayout";
import { BibliotecaDeImagens } from "@/components/ticketeria/BibliotecaDeImagens";
import { SetorSheet } from "@/components/ticketeria/SetorDoLocal";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";

// A tela única do desenho da sala: a sala se desenha de uma vez (blocos, mesas, camarotes, pistas e a planta de fundo) e cada bloco é ATRIBUÍDO a um setor, em vez de cada setor ter o seu desenho.
// As contas estão em lib/ticketeria/desenho-da-sala.ts; o desenho é o MapaPorLayout e os controles de bloco são os do EditorDoLayout. Salvar distribui o desenho entre os setores e grava a planta,
// tudo numa transação só (fn_ticketeria_salvar_desenho_da_sala).

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const BOTAO = `inline-flex h-8 items-center justify-center rounded-xl border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`;
const BOTAO_PASSO = `flex h-7 w-7 items-center justify-center rounded-lg border border-black/[.12] bg-white text-black/60 transition hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-35 ${FOCO}`;
const CARTAO = { borderColor: "rgba(13,13,13,.08)" } as const;

export type SetorCarregado = { id: string; nome: string; numerado: boolean; lugares: number; layout: Layout | null };
/** Só para demonstração e testes: dados no lugar do banco (e o que fazer ao salvar), para ver a tela sem uma conta. */
export type DadosDeExemplo = { setores: SetorCarregado[]; mapas: Record<string, FileiraDoMapa[]>; planta: unknown; aoSalvar: (corpo: { setores: unknown; planta: unknown }) => void };

/** As medidas da imagem (em pixels), lidas pelo navegador a partir do endereço público; nulo se não abre. */
function medirImagem(url: string): Promise<{ largura: number; altura: number } | null> {
  return new Promise(resolve => {
    const imagem = new Image();
    imagem.onload = () => resolve({ largura: imagem.naturalWidth, altura: imagem.naturalHeight });
    imagem.onerror = () => resolve(null);
    imagem.src = url;
  });
}

const urlDoSupabase = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function DesenhoDaSalaSheet({ organizationId, localId, sala, nomeDoLocal, onClose, onSaved, exemplo }: { organizationId: string; localId: string; sala: SalaDoEspaco; nomeDoLocal: string; onClose: () => void; onSaved: () => void; exemplo?: DadosDeExemplo }) {
  const [setores, setSetores] = useState<SetorCarregado[] | null>(null);
  const [versoes, setVersoes] = useState<Versoes<DesenhoDaSala> | null>(null);
  const [foraDoDesenho, setForaDoDesenho] = useState<string[]>([]);
  const [tinhaPlanta, setTinhaPlanta] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null); // o id do bloco escolhido, ou "area:<setor>"
  const [biblioteca, setBiblioteca] = useState(false);
  const [criandoSetor, setCriandoSetor] = useState(false);
  const [ajustandoFundo, setAjustandoFundo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mapas = useRef<Map<string, FileiraDoMapa[]>>(new Map());

  /** Os setores da sala e, dos numerados, o mapa de hoje (para guardar bloqueios e tipos de lugar ao salvar). */
  const lerSetores = useCallback(async (): Promise<SetorCarregado[] | null> => {
    const ticketeria = clienteDaTicketeria(createClient());
    const { data, error } = await ticketeria.from("ticketeria_setores").select("id, nome, layout, numerado, lugares").eq("sala_id", sala.id).eq("arquivado", false).order("ordem").order("nome");
    if (error) return null;
    const lista = (data ?? []).map(s => ({ id: s.id, nome: s.nome, numerado: s.numerado, lugares: s.lugares, layout: lerLayout(s.layout) }));
    await Promise.all(lista.filter(s => s.numerado).map(async s => {
      const { data: mapa } = await ticketeria.rpc("fn_ticketeria_mapa_do_setor", { p_setor: s.id });
      mapas.current.set(s.id, lerMapa(mapa));
    }));
    return lista;
  }, [sala.id]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      if (exemplo) for (const [id, m] of Object.entries(exemplo.mapas)) mapas.current.set(id, m);
      const lista = exemplo ? exemplo.setores : await lerSetores();
      const { data: linha } = exemplo ? { data: { planta: exemplo.planta } } : await clienteDaTicketeria(createClient()).from("ticketeria_salas").select("planta").eq("id", sala.id).maybeSingle();
      if (!ativo) return;
      if (!lista) { setErro("Não foi possível carregar a sala. Feche e abra de novo."); setSetores([]); return; }
      const desenhados: SetorDesenhado[] = lista.filter(s => s.numerado && s.layout).map(s => ({ id: s.id, nome: s.nome, layout: s.layout as Layout }));
      const emPe: SetorEmPe[] = lista.filter(s => !s.numerado && s.lugares >= 1).map(s => ({ id: s.id, nome: s.nome, capacidade: s.lugares }));
      const guardada = lerPlanta(linha?.planta);
      let d = desenhoVazio();
      if (desenhados.length + emPe.length > 0) d = desenhoDaPlanta(completarPlanta(guardada, desenhados, emPe), desenhados, emPe);
      const fora: string[] = [];
      for (const s of lista.filter(x => x.numerado && !x.layout)) {
        const antes = d;
        d = acrescentarSetorDeFileiras(d, s.id, mapas.current.get(s.id) ?? []);
        if (d === antes) fora.push(s.nome);
      }
      d = comPalcoDoDesenho(comCoresCompletas(d, lista));
      setSetores(lista);
      setForaDoDesenho(fora);
      setTinhaPlanta(!!guardada);
      setVersoes(versoesNovas(d));
    })();
    return () => { ativo = false; };
  }, [lerSetores, sala.id, exemplo]);

  const d = versoes?.atual ?? null;
  const setoresDaSala = useMemo(() => (setores ?? []).map(s => ({ id: s.id, nome: s.nome })), [setores]);
  const nomes = useMemo(() => new Map(setoresDaSala.map(s => [s.id, s.nome])), [setoresDaSala]);
  const emPe = useMemo(() => (setores ?? []).filter(s => !s.numerado && s.lugares >= 1), [setores]);
  const erros: ErroDoDesenho[] = d && setores ? conferirDesenho(d, setoresDaSala) : [];
  const lugares = useMemo(() => (d ? lugaresPorSetor(d) : new Map<string, number>()), [d]);

  function mudar(novo: DesenhoDaSala, agrupar = false) {
    const agora = Date.now();
    const final = comPalcoDoDesenho(agrupar ? novo : resolverConflitos(novo));
    setVersoes(v => (v ? registrar(v, final, agora, agrupar) : v));
  }

  async function recarregarSetores() {
    if (exemplo) return;
    const lista = await lerSetores();
    if (!lista) return;
    setSetores(lista);
    setVersoes(v => (v ? { ...v, atual: comCoresCompletas(v.atual, lista) } : v));
  }

  async function escolherFundo(url: string) {
    if (!d) return;
    const caminho = caminhoDoFundoPelaUrl(url);
    const medidas = caminho ? await medirImagem(url) : null;
    if (!caminho || !medidas) { setErro("Não foi possível usar essa imagem como planta. Escolha outra."); return; }
    setErro(null);
    mudar(comFundoNoDesenho(d, fundoNovoDoDesenho(caminho, medidas.largura, medidas.altura, d)));
    setAjustandoFundo(true);
  }

  async function gravar(fechar: () => void, tirar = false) {
    if (!d) return;
    const ticketeria = clienteDaTicketeria(createClient());
    setSalvando(true);
    setErro(null);
    if (tirar) {
      const { error } = await ticketeria.from("ticketeria_salas").update({ planta: null }).eq("id", sala.id);
      setSalvando(false);
      if (error) { setErro("Não foi possível tirar o mapa da sala."); return; }
      onSaved();
      fechar();
      return;
    }
    if (erros.length > 0) { setSalvando(false); setErro(textoDoErro(erros[0])); return; }
    const partes = distribuirPorSetor(d).map(p => ({ setor: p.setor, corredor: true, layout: p.layout, fileiras: paraSalvar(comEstadosDoMapa(p.fileiras, mapas.current.get(p.setor) ?? [])) }));
    if (exemplo) { exemplo.aoSalvar({ setores: partes, planta: plantaDoDesenho(d) }); setSalvando(false); onSaved(); fechar(); return; }
    const { error } = await ticketeria.rpc("fn_ticketeria_salvar_desenho_da_sala", { p_sala: sala.id, p_setores: partes as unknown as Json, p_planta: plantaDoDesenho(d) as unknown as Json });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDoMapa(error)); return; }
    onSaved();
    fechar();
  }

  const cores = useMemo(() => new Map(Object.entries(d?.cores ?? {})), [d]);
  const areas: AreaNoDesenho[] = useMemo(() => (d ? d.areas.flatMap(a => { const pe = emPe.find(x => x.id === a.setor); return pe ? [{ setor: a.setor, nome: pe.nome, detalhe: detalheDaArea(pe.lugares), cor: d.cores[a.setor] ?? CORES_DOS_SETORES[0], x: a.x, y: a.y, largura: a.largura, altura: a.altura }] : []; }) : []), [d, emPe]);
  const rotulos = useMemo(() => new Map([...nomes].filter(([id]) => d?.blocos.some(b => b.setor === id))), [nomes, d]);

  const edicao: EdicaoDaSala | undefined = d && setores ? {
    setores: setores.map(s => ({ id: s.id, nome: s.nome, cor: d.cores[s.id] ?? CORES_DOS_SETORES[0] })),
    onAtribuir: (blocos, setor) => mudar(atribuirSetor(d, blocos, setor)),
    onNovoSetor: () => setCriandoSetor(true),
    onModelo: modelo => { const novo = acrescentarModelo(d, modelo); mudar(novo); setEscolhido(novo.blocos[d.blocos.length]?.id ?? null); },
  } : undefined;

  const setorDaPista = escolhido?.startsWith("area:") ? escolhido.slice(5) : null;
  const passoDaPista = (dx: number, dy: number) => { if (d && setorDaPista) { const a = d.areas.find(x => x.setor === setorDaPista); if (a) mudar(posicionarPista(d, setorDaPista, a.x + dx, a.y + dy)); } };

  return (
    <TopSheet titulo="Desenhar a sala" etiqueta={`${nomeDoLocal} · ${sala.nome}`} largura="58rem" onClose={onClose}
      footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Salvar a sala" onSalvar={() => void gravar(fechar)} onApagar={tinhaPlanta ? () => void gravar(fechar, true) : undefined} rotuloApagar="Tirar o mapa da sala" arquivar />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        {setores === null && <p role="status" className="text-[0.8125rem] text-black/55">Lendo a sala…</p>}
        {d && versoes && setores && (
          <>
            <p className="text-[0.8125rem] leading-relaxed text-black/60">Desenhe a sala toda de uma vez: blocos, mesas, camarotes e pistas. Depois escolha o setor de cada bloco (ele ganha a cor do setor). Quem compra vê a sala inteira, e cada setor mantém o seu preço e o seu estoque.</p>
            <div className="sticky top-0 z-10 rounded-xl border bg-[#fbfbfb] px-4 py-5 shadow-[0_6px_16px_-8px_rgba(13,13,13,.18)]" style={CARTAO}>
              {d.blocos.length === 0 && d.areas.length === 0 ? (
                <p className="py-10 text-center text-[0.8125rem] text-black/50">A sala está vazia. Acrescente um modelo ou uma mesa abaixo para começar.</p>
              ) : (
                <MapaPorLayout layout={d} modo="produtor" rotuloDoMapa="Desenho da sala" cores={cores} rotulos={rotulos} areas={areas}
                  fundo={d.fundo ? { ...d.fundo, url: urlDoFundo(d.fundo.caminho, urlDoSupabase()) } : undefined}
                  desenho={{
                    blocoEscolhido: escolhido, onEscolher: setEscolhido,
                    onMover: (id, x, y) => mudar({ ...d, ...moverBloco(d, id, x, y) } as DesenhoDaSala, true),
                    onGirar: (id, angulo, fim) => { const girado = comAngulo(d, id, angulo); mudar({ ...d, ...(fim ? empurrarVizinhos(girado, id) : girado) } as DesenhoDaSala, true); },
                    onMoverArea: (setor, x, y) => mudar(posicionarPista(d, setor, x, y), true),
                    fundoAtivo: ajustandoFundo && !!d.fundo, onMoverFundo: (x, y) => mudar(posicionarFundoDoDesenho(d, x, y), true),
                  }} />
              )}
            </div>
            <EditorDoLayout layout={d} onLayout={(l, agrupar) => { if (l) mudar({ ...d, ...l } as DesenhoDaSala, agrupar); }} blocoEscolhido={escolhido} onEscolherBloco={setEscolhido} sala={edicao}
              historico={{ podeDesfazer: podeDesfazer(versoes), podeRefazer: podeRefazer(versoes), onDesfazer: () => setVersoes(desfazer(versoes)), onRefazer: () => setVersoes(refazer(versoes)) }} />

            <div className="space-y-2 rounded-xl border bg-white px-4 py-3" style={CARTAO}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.8125rem] text-[#282525]">Setores</span>
                <button type="button" className={BOTAO} onClick={() => setCriandoSetor(true)}><Plus size={14} aria-hidden="true" className="mr-1" />Novo setor</button>
              </div>
              {setores.length === 0 && <p className="text-[0.75rem] text-black/50">Esta sala ainda não tem setores. Crie o primeiro (Plateia, Balcão, Pista...).</p>}
              <ul className="space-y-2" aria-label="Setores da sala">
                {setores.map(s => {
                  const pista = d.areas.find(a => a.setor === s.id);
                  const comLugares = lugares.get(s.id) ?? 0;
                  return (
                    <li key={s.id} className={`rounded-xl border px-3.5 py-3 ${setorDaPista === s.id ? "border-[#6450D2]" : ""}`} style={setorDaPista === s.id ? undefined : CARTAO}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-0 text-[0.8125rem] text-[#282525]">
                          <span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-md align-middle" style={{ background: d.cores[s.id] ?? CORES_DOS_SETORES[0] }} />
                          {s.nome}
                          <span className="ml-2 text-[0.6875rem] text-black/45">{comLugares > 0 ? `${comLugares} lugares` : pista ? `pista · ${s.lugares} pessoas` : !s.numerado ? `em pé · ${s.lugares} pessoas` : "sem blocos"}</span>
                        </span>
                        <div role="radiogroup" aria-label={`Cor de ${s.nome}`} className="flex items-center gap-1.5">
                          {CORES_DOS_SETORES.map(cor => (
                            <button key={cor} type="button" role="radio" aria-checked={d.cores[s.id] === cor} aria-label={`Cor ${cor}`} onClick={() => mudar(comCorDoSetor(d, s.id, cor))}
                              className={`h-5 w-5 rounded-full border-2 transition ${FOCO} ${d.cores[s.id] === cor ? "border-[#282525]" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]"}`} style={{ background: cor }} />
                          ))}
                        </div>
                      </div>
                      {!s.numerado && comLugares === 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                          {!pista ? (
                            <button type="button" className={BOTAO} onClick={() => { mudar(maisUmaPista(d, s.id, s.lugares)); setEscolhido(`area:${s.id}`); }}>Pôr na sala como pista</button>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[0.75rem] text-black/55">Largura</span>
                                <button type="button" className={BOTAO_PASSO} aria-label={`Menos largura em ${s.nome}`} onClick={() => mudar(ajustarPista(d, s.id, -2, 0))}>−</button>
                                <span className="min-w-8 text-center text-[0.8125rem] tabular-nums text-[#282525]" aria-live="polite">{pista.largura}</span>
                                <button type="button" className={BOTAO_PASSO} aria-label={`Mais largura em ${s.nome}`} onClick={() => mudar(ajustarPista(d, s.id, 2, 0))}>+</button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[0.75rem] text-black/55">Altura</span>
                                <button type="button" className={BOTAO_PASSO} aria-label={`Menos altura em ${s.nome}`} onClick={() => mudar(ajustarPista(d, s.id, 0, -1))}>−</button>
                                <span className="min-w-8 text-center text-[0.8125rem] tabular-nums text-[#282525]" aria-live="polite">{pista.altura}</span>
                                <button type="button" className={BOTAO_PASSO} aria-label={`Mais altura em ${s.nome}`} onClick={() => mudar(ajustarPista(d, s.id, 0, 1))}>+</button>
                              </div>
                              <button type="button" className="text-[0.75rem] text-[#B23B3B] underline underline-offset-2 hover:text-[#8f2e2e]" onClick={() => { mudar(tirarPista(d, s.id)); if (setorDaPista === s.id) setEscolhido(null); }}>Tirar da sala</button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {setorDaPista && (
                <div className="flex items-center justify-between gap-3 border-t pt-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  <span className="text-[0.8125rem] text-black/65">Mover {nomes.get(setorDaPista)}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" className={BOTAO_PASSO} aria-label="Mover a pista para a esquerda" onClick={() => passoDaPista(-1, 0)}><ArrowLeft size={14} aria-hidden="true" /></button>
                    <button type="button" className={BOTAO_PASSO} aria-label="Mover a pista para cima" onClick={() => passoDaPista(0, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
                    <button type="button" className={BOTAO_PASSO} aria-label="Mover a pista para baixo" onClick={() => passoDaPista(0, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
                    <button type="button" className={BOTAO_PASSO} aria-label="Mover a pista para a direita" onClick={() => passoDaPista(1, 0)}><ArrowRight size={14} aria-hidden="true" /></button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border bg-white px-4 py-3" style={CARTAO}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.8125rem] text-[#282525]">Planta de fundo</span>
                <button type="button" className={BOTAO} onClick={() => setBiblioteca(true)}><ImageIcon size={14} aria-hidden="true" className="mr-1.5" />{d.fundo ? "Trocar a planta" : "Escolher a planta"}</button>
              </div>
              {!d.fundo && <p className="text-[0.75rem] leading-relaxed text-black/50">Suba a planta da sala (um PDF ou uma imagem) para desenhar em cima dela. Ela só ajuda você e quem compra a se situar: não muda nenhum lugar.</p>}
              {d.fundo && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[0.8125rem] text-black/65">Arrastar a planta no desenho</span>
                    <button type="button" role="switch" aria-checked={ajustandoFundo} aria-label="Arrastar a planta no desenho" onClick={() => setAjustandoFundo(v => !v)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${FOCO} ${ajustandoFundo ? "bg-[#6450D2]" : "bg-black/20"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ajustandoFundo ? "left-[1.375rem]" : "left-0.5"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[0.8125rem] text-black/65">Tamanho</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" className={BOTAO_PASSO} aria-label="Diminuir a planta" onClick={() => mudar(escalarFundoDoDesenho(d, 0.9))}>−</button>
                      <span className="min-w-[4.5rem] text-center text-[0.8125rem] tabular-nums text-[#282525]" aria-live="polite">{Math.round(d.fundo.largura)} lugares</span>
                      <button type="button" className={BOTAO_PASSO} aria-label="Aumentar a planta" onClick={() => mudar(escalarFundoDoDesenho(d, 1.1))}>+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[0.8125rem] text-black/65">Transparência</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" className={BOTAO_PASSO} aria-label="Planta mais transparente" disabled={d.fundo.opacidade <= 10} onClick={() => mudar(opacidadeDoFundoDoDesenho(d, d.fundo!.opacidade - 10))}>−</button>
                      <span className="min-w-[4.5rem] text-center text-[0.8125rem] tabular-nums text-[#282525]" aria-live="polite">{d.fundo.opacidade}%</span>
                      <button type="button" className={BOTAO_PASSO} aria-label="Planta mais visível" disabled={d.fundo.opacidade >= 100} onClick={() => mudar(opacidadeDoFundoDoDesenho(d, d.fundo!.opacidade + 10))}>+</button>
                    </div>
                  </div>
                  <button type="button" className="text-[0.75rem] text-[#B23B3B] underline underline-offset-2 hover:text-[#8f2e2e]" onClick={() => { mudar(comFundoNoDesenho(d, null)); setAjustandoFundo(false); }}>Tirar a planta</button>
                </div>
              )}
            </div>

            {erros.length > 0 && d.blocos.length + d.areas.length > 0 && (
              <ul role="alert" className="space-y-1 rounded-xl border border-[#B23B3B]/25 bg-[#B23B3B]/[.04] px-4 py-3 text-[0.8125rem] text-[#B23B3B]">
                {erros.map(e => <li key={e}>{textoDoErro(e)}</li>)}
              </ul>
            )}
            {foraDoDesenho.length > 0 && (
              <p className="text-[0.75rem] leading-relaxed text-black/50">Ficam fora do desenho, por serem listas de fileiras que não cabem num bloco: {foraDoDesenho.join(", ")}. Seguem à venda com o mapa de fileiras de sempre.</p>
            )}
          </>
        )}
      </div>
      {biblioteca && <BibliotecaDeImagens organizationId={organizationId} aceitaPdf aoEscolher={url => void escolherFundo(url)} onClose={() => setBiblioteca(false)} />}
      {criandoSetor && typeof document !== "undefined" && createPortal(
        <SetorSheet organizationId={organizationId} localId={localId} salaId={sala.id} nomeDoLocal={`${nomeDoLocal} · ${sala.nome}`} onClose={() => setCriandoSetor(false)} onSaved={() => void recarregarSetores()} />, document.body)}
    </TopSheet>
  );
}

function textoDoErro(e: ErroDoDesenho): string {
  return e in ERRO_DO_DESENHO_EM_TEXTO ? ERRO_DO_DESENHO_EM_TEXTO[e as keyof typeof ERRO_DO_DESENHO_EM_TEXTO] : ERRO_DO_LAYOUT_EM_TEXTO[e as keyof typeof ERRO_DO_LAYOUT_EM_TEXTO];
}
