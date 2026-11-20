"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Clock3, Eye, EyeOff, GripVertical, MessageCircleQuestion, MessageSquareWarning, Mic2, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Section = "roteiro" | "argumentos" | "treinamento" | "objecoes";
type Deck = { id: string; nome: string };
type Bloco = { id: string; tipo: string; titulo: string; conteudo: string | null; notas: string | null; ordem: number; ativo: boolean };
type Argumento = { id: string; titulo: string; ideia_central: string | null; raciocinio: string | null; evidencia: string | null; relevancia_interlocutor: string | null; versao_15s: string | null; versao_30s: string | null; versao_90s: string | null; dominio: number; ordem: number };
type Objecao = { id: string; objecao: string; pergunta_diagnostico: string | null; resposta_curta: string | null; resposta_aprofundada: string | null; evidencias: string | null; ordem: number };
type Card = { id: string; tipo: string; frente: string; verso: string; dominio: number; proxima_revisao: string; objecao_id?: string | null; slide_id?: string | null };
type Avaliacao = "nao_lembrei" | "quase" | "lembrei";

const SECOES = [["roteiro", "Roteiro de Apresentação", Mic2], ["argumentos", "Argumentos", ChevronRight], ["objecoes", "Objeções", MessageSquareWarning], ["treinamento", "Flash cards", BookOpen]] as const;

function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = <span ref={setActivatorNodeRef} {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none text-black/15 hover:text-black/35 active:cursor-grabbing"><GripVertical size={12} /></span>;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>{children(handle)}</div>;
}

export function PitchWorkspace({ projectId, projectName }: { projectId: string; projectName: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [section, setSection] = useState<Section>("roteiro");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [argumentos, setArgumentos] = useState<Argumento[]>([]);
  const [objecoes, setObjecoes] = useState<Objecao[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newObjection, setNewObjection] = useState("");
  const [newArgument, setNewArgument] = useState("");
  const [newBlock, setNewBlock] = useState("");
  const [activeCard, setActiveCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [confirmBlank, setConfirmBlank] = useState(false);
  const [selectedArgId, setSelectedArgId] = useState<string | null>(null);
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);
  const [versionTab, setVersionTab] = useState<"15s" | "30s" | "90s">("15s");

  async function load() {
    setLoading(true);
    const { data: decks } = await (supabase as any).from("pitch_decks").select("id,nome").eq("projeto_id", projectId).order("created_at").limit(1);
    const current = decks?.[0] ?? null;
    setDeck(current);
    const [{ data: args }, { data: obs }, { data: study }] = await Promise.all([
      (supabase as any).from("pitch_argumentos").select("id,titulo,ideia_central,raciocinio,evidencia,relevancia_interlocutor,versao_15s,versao_30s,versao_90s,dominio,ordem").eq("projeto_id", projectId).order("ordem"),
      (supabase as any).from("pitch_objecoes").select("id,objecao,pergunta_diagnostico,resposta_curta,resposta_aprofundada,evidencias,ordem").eq("projeto_id", projectId).order("ordem"),
      (supabase as any).from("pitch_cards").select("id,tipo,frente,verso,dominio,proxima_revisao,objecao_id,slide_id").eq("projeto_id", projectId).order("proxima_revisao"),
    ]);
    setArgumentos(args ?? []); setObjecoes(obs ?? []); setCards(study ?? []);
    setSelectedArgId(prev => prev && (args ?? []).some((a: Argumento) => a.id === prev) ? prev : (args?.[0]?.id ?? null));
    setSelectedObsId(prev => prev && (obs ?? []).some((o: Objecao) => o.id === prev) ? prev : (obs?.[0]?.id ?? null));
    if (current) {
      const { data } = await (supabase as any).from("pitch_slides").select("id,tipo,titulo,conteudo,notas,ordem,ativo").eq("deck_id", current.id).order("ordem");
      setBlocos(data ?? []);
      setSelectedId(previous => previous && data?.some((item: Bloco) => item.id === previous) ? previous : data?.[0]?.id ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createWorkspace() {
    setCreating(true);
    await (supabase as any).from("pitch_decks").insert({ projeto_id: projectId, nome: `Preparação de pitch — ${projectName}`, tipo: "oral" }).select("id,nome").single();
    setCreating(false); await load();
  }

  async function updateBlock(id: string, values: Partial<Bloco>) { setBlocos(current => current.map(item => item.id === id ? { ...item, ...values } : item)); await (supabase as any).from("pitch_slides").update(values).eq("id", id); }
  async function addBlock() { if (!deck || !newBlock.trim()) return; const { data } = await (supabase as any).from("pitch_slides").insert({ deck_id: deck.id, tipo: "livre", titulo: newBlock.trim(), notas: "Organize este assunto.", ordem: blocos.length }).select("id").single(); setNewBlock(""); await load(); if (data?.id) setSelectedId(data.id); }
  async function deleteBlock(id: string) { await (supabase as any).from("pitch_slides").delete().eq("id", id); setSelectedId(null); await load(); }
  async function startBlank() { if (!deck) return; await (supabase as any).from("pitch_slides").delete().eq("deck_id", deck.id); setSelectedId(null); await load(); }
  async function updateArgument(id: string, values: Partial<Argumento>) { setArgumentos(current => current.map(item => item.id === id ? { ...item, ...values } : item)); await (supabase as any).from("pitch_argumentos").update(values).eq("id", id); }
  async function updateObjection(id: string, values: Partial<Objecao>) { setObjecoes(current => current.map(item => item.id === id ? { ...item, ...values } : item)); await (supabase as any).from("pitch_objecoes").update(values).eq("id", id); }
  async function addArgument() { if (!newArgument.trim()) return; await (supabase as any).from("pitch_argumentos").insert({ projeto_id: projectId, deck_id: deck?.id ?? null, titulo: newArgument.trim() }); setNewArgument(""); await load(); }
  async function addObjection() { if (!newObjection.trim()) return; await (supabase as any).from("pitch_objecoes").insert({ projeto_id: projectId, deck_id: deck?.id ?? null, categoria: "geral", objecao: newObjection.trim() }); setNewObjection(""); await load(); }
  async function deleteArgument(id: string) { await (supabase as any).from("pitch_argumentos").delete().eq("id", id); setSelectedArgId(null); await load(); }
  async function deleteObjection(id: string) { await (supabase as any).from("pitch_objecoes").delete().eq("id", id); setSelectedObsId(null); await load(); }

  async function generateCards() {
    if (!deck) return;
    const existing = new Set(cards.map(card => card.frente));
    const roteiroCards = blocos.filter(item => item.ativo && item.conteudo).map(item => ({ projeto_id: projectId, deck_id: deck.id, slide_id: item.id, tipo: "evocacao", frente: item.titulo, verso: item.conteudo ?? "" }));
    const argumentoCards = argumentos.filter(item => item.ideia_central).map(item => ({ projeto_id: projectId, deck_id: deck.id, tipo: "argumento", frente: `Defenda este argumento: ${item.titulo}`, verso: [item.ideia_central, item.raciocinio ? `Por quê: ${item.raciocinio}` : null, item.evidencia ? `Evidência: ${item.evidencia}` : null, item.relevancia_interlocutor ? `Relevância: ${item.relevancia_interlocutor}` : null].filter(Boolean).join("\n\n") }));
    const objecaoCards = objecoes.filter(item => item.resposta_curta).map(item => ({ projeto_id: projectId, deck_id: deck.id, objecao_id: item.id, tipo: "objecao", frente: "— " + item.objecao, verso: [item.pergunta_diagnostico ? "Primeiro pergunte: " + item.pergunta_diagnostico : null, item.resposta_curta].filter(Boolean).join("\n\n") }));
    const payload = [...roteiroCards, ...argumentoCards, ...objecaoCards].filter(item => !existing.has(item.frente));
    if (payload.length) await (supabase as any).from("pitch_cards").insert(payload);
    await load(); setActiveCard(0); setShowAnswer(false); setSection("treinamento");
  }

  async function reviewCard(card: Card, avaliacao: Avaliacao) {
    const days = avaliacao === "lembrei" ? 5 : avaliacao === "quase" ? 2 : 0;
    const dominio = Math.max(0, Math.min(5, card.dominio + (avaliacao === "nao_lembrei" ? -1 : 1)));
    const next = new Date(); next.setDate(next.getDate() + days);
    await Promise.all([(supabase as any).from("pitch_card_revisoes").insert({ card_id: card.id, avaliacao }), (supabase as any).from("pitch_cards").update({ dominio, proxima_revisao: next.toISOString().slice(0, 10) }).eq("id", card.id)]);
    setCards(current => current.map(item => item.id === card.id ? { ...item, dominio, proxima_revisao: next.toISOString().slice(0, 10) } : item));
    setShowAnswer(false); setActiveCard(current => cards.length ? (current + 1) % cards.length : 0);
  }

  const selected = blocos.find(item => item.id === selectedId) ?? null;
  const selectedArg = argumentos.find(a => a.id === selectedArgId) ?? null;
  const selectedObs = objecoes.find(o => o.id === selectedObsId) ?? null;
  const dominioByObjecao = new Map(cards.filter(c => c.objecao_id).map(c => [c.objecao_id!, c.dominio]));
  const dominioByBloco = new Map(cards.filter(c => c.slide_id).map(c => [c.slide_id!, c.dominio]));
  const dominioByArgTitulo = new Map(cards.filter(c => c.tipo === "argumento").map(c => [c.frente.replace(/^Defenda este argumento: /, ""), c.dominio]));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  async function reorderBlocos(oi: number, ni: number) { const r = arrayMove(blocos, oi, ni); setBlocos(r); await Promise.all(r.map((b, i) => (supabase as any).from("pitch_slides").update({ ordem: i }).eq("id", b.id))); }
  async function reorderArgumentos(oi: number, ni: number) { const r = arrayMove(argumentos, oi, ni); setArgumentos(r); await Promise.all(r.map((a, i) => (supabase as any).from("pitch_argumentos").update({ ordem: i }).eq("id", a.id))); }
  async function reorderObjecoes(oi: number, ni: number) { const r = arrayMove(objecoes, oi, ni); setObjecoes(r); await Promise.all(r.map((o, i) => (supabase as any).from("pitch_objecoes").update({ ordem: i }).eq("id", o.id))); }
  const currentCard = cards[activeCard] ?? null;
  if (loading) return <div className="rounded border bg-white py-20 text-center text-xs text-black/30">Carregando preparação…</div>;
  if (!deck) return <div className="rounded border bg-white px-6 py-16 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}><Mic2 size={25} className="mx-auto mb-3 text-[#7259B5]"/><h3 className="text-[1.0625rem] font-semibold tracking-[-.02em] text-black/75">Prepare-se para falar sobre o projeto</h3><p className="mx-auto mt-2 max-w-lg text-[0.75rem] leading-relaxed text-black/40">Estruture o raciocínio, pratique diferentes durações, responda objeções e revise os pontos essenciais com flash cards.</p><button type="button" disabled={creating} onClick={createWorkspace} className="mt-5 rounded border border-[#7259B5]/30 bg-white px-4 py-2.5 text-[0.6875rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40">{creating ? "Preparando…" : "Criar preparação de pitch"}</button></div>;

  return <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
    <header className="flex items-center justify-between gap-4 border-b px-5" style={{ borderColor: "rgba(13,13,13,.07)" }}><div className="flex overflow-x-auto">{SECOES.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setSection(key)} className={`flex h-14 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.8125rem] font-medium transition ${section === key ? "border-[#7259B5] text-[#7259B5]" : "border-transparent text-black/45 hover:text-black/65"}`}><Icon size={15}/>{label}</button>)}</div><button type="button" onClick={() => void generateCards()} className="hidden shrink-0 items-center gap-1.5 rounded border border-black/15 bg-white px-3.5 py-2.5 text-[0.75rem] font-medium text-black/70 hover:bg-black/[.04] sm:flex"><Sparkles size={14}/>Atualizar cards</button></header>

    {section === "roteiro" && <div className="grid min-h-[35rem] md:grid-cols-[16.25rem_1fr]">
      <aside className="border-b p-3 md:border-b-0 md:border-r" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="px-1 pt-1"><p className="text-[0.875rem] font-semibold text-black/65">Seu roteiro</p></div>
        <div className="mt-4 flex gap-1.5"><input value={newBlock} onChange={event => setNewBlock(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void addBlock(); }} placeholder="Nome do assunto" className="h-10 min-w-0 flex-1 rounded border border-black/10 px-3 text-[0.75rem] outline-none focus:border-[#7259B5]"/><button type="button" onClick={() => void addBlock()} aria-label="Adicionar assunto" className="flex h-10 w-10 items-center justify-center rounded border border-[#7259B5]/25 bg-white text-[#7259B5] hover:bg-black/[.04]"><Plus size={15}/></button></div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => { const { active, over } = e; if (over && active.id !== over.id) { const oi = blocos.findIndex(b => b.id === active.id); const ni = blocos.findIndex(b => b.id === over.id); void reorderBlocos(oi, ni); } }}><SortableContext items={blocos.map(b => b.id)} strategy={verticalListSortingStrategy}><div className="mt-4 flex gap-1 overflow-x-auto pb-1 md:block">{blocos.map((item, index) => <SortableRow key={item.id} id={item.id}>{handle => <button type="button" onClick={() => setSelectedId(item.id)} className={`flex min-w-[13.125rem] w-full items-center gap-2 rounded border px-3 py-3 text-left md:mb-1.5 ${selectedId === item.id ? "border-[#7259B5]/35 text-[#7259B5]" : "border-transparent text-black/50 hover:bg-black/[.03]"}`}>{handle}<span className="w-4 text-[0.625rem] text-black/30">{index + 1}</span><span className="flex-1 truncate text-[0.75rem] font-medium">{item.titulo}</span><Dominio valor={dominioByBloco.get(item.id) ?? 0}/><span onClick={event => { event.stopPropagation(); void updateBlock(item.id, { ativo: !item.ativo }); }} className="text-black/30">{item.ativo ? <Eye size={14}/> : <EyeOff size={14}/>}</span></button>}</SortableRow>)}</div></SortableContext></DndContext>
        {blocos.length > 0 && (confirmBlank ? <div className="mt-4 rounded border border-[#D94E4E]/20 p-2.5"><p className="text-[0.5625rem] leading-relaxed text-black/40">Isso remove todos os assuntos deste roteiro.</p><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => { setConfirmBlank(false); void startBlank(); }} className="text-[0.625rem] font-medium text-[#D94E4E]">Remover tudo</button><button type="button" onClick={() => setConfirmBlank(false)} className="text-[0.625rem] text-black/35 hover:text-black/55">Cancelar</button></div></div> : <button type="button" onClick={() => setConfirmBlank(true)} className="mt-4 px-1 text-[0.625rem] text-black/30 hover:text-[#D94E4E]">Começar do zero</button>)}
      </aside>
      <main className="p-6 sm:p-9">{selected ? <div className="mx-auto max-w-3xl"><div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-[0.625rem] font-semibold uppercase tracking-[.14em] text-black/35">Assunto {selected.ordem + 1}</p><p className="mt-1.5 text-[0.8125rem] leading-relaxed text-black/45">{selected.notas}</p></div><button type="button" onClick={() => void deleteBlock(selected.id)} className="flex items-center gap-1.5 text-[0.6875rem] text-black/35 hover:text-[#D94E4E]"><Trash2 size={13}/>Remover</button></div><input value={selected.titulo} onChange={event => setBlocos(current => current.map(item => item.id === selected.id ? { ...item, titulo: event.target.value } : item))} onBlur={event => void updateBlock(selected.id, { titulo: event.target.value })} className="w-full bg-transparent text-[1.75rem] font-semibold tracking-[-.035em] text-black/80 outline-none"/><label className="mt-8 block text-[0.6875rem] font-semibold uppercase tracking-[.1em] text-black/40">Pontos essenciais</label><textarea value={selected.conteudo ?? ""} onChange={event => setBlocos(current => current.map(item => item.id === selected.id ? { ...item, conteudo: event.target.value } : item))} onBlur={event => void updateBlock(selected.id, { conteudo: event.target.value || null })} placeholder="Registre fatos, ideias e exemplos que você precisa conseguir explicar com suas próprias palavras…" className="mt-2.5 min-h-[15.625rem] w-full resize-none rounded border border-black/[.08] bg-black/[.012] p-5 text-[0.9375rem] leading-7 text-black/65 outline-none focus:border-[#7259B5]/35"/><div className="mt-4 flex items-center justify-between"><p className="flex items-center gap-1.5 text-[0.6875rem] text-black/30"><Save size={12}/>Salvo ao sair do campo</p><button type="button" onClick={() => { setNewArgument(selected.titulo); setSection("argumentos"); }} className="rounded border border-black/15 bg-white px-3.5 py-2.5 text-[0.75rem] font-medium text-black/70 hover:bg-black/[.04]">Desdobrar argumento</button></div></div> : <Empty icon={Mic2} title="O roteiro começa com você" text="Dê um nome ao primeiro assunto que deseja saber explicar. Não existe uma ordem obrigatória."/>}</main>
    </div>}

    {section === "argumentos" && <div className="grid min-h-[35rem] md:grid-cols-[16.25rem_1fr]">
      <aside className="border-b p-3 md:border-b-0 md:border-r" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-[0.875rem] font-semibold text-black/65">Argumentos</p>
          <span className="text-[0.6875rem] text-black/30">{argumentos.length}</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          <input value={newArgument} onChange={e => setNewArgument(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void addArgument(); }} placeholder="Nome do argumento" className="h-10 min-w-0 flex-1 rounded border border-black/10 px-3 text-[0.75rem] outline-none focus:border-[#7259B5]" />
          <button type="button" onClick={() => void addArgument()} aria-label="Adicionar argumento" className="flex h-10 w-10 items-center justify-center rounded border border-[#7259B5]/25 bg-white text-[#7259B5] hover:bg-black/[.04]"><Plus size={15} /></button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => { const { active, over } = e; if (over && active.id !== over.id) { const oi = argumentos.findIndex(a => a.id === active.id); const ni = argumentos.findIndex(a => a.id === over.id); void reorderArgumentos(oi, ni); } }}><SortableContext items={argumentos.map(a => a.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1 md:block">
          {argumentos.map(arg => (
            <SortableRow key={arg.id} id={arg.id}>{handle => <button type="button" onClick={() => setSelectedArgId(arg.id)} className={`flex min-w-[13.125rem] w-full items-center gap-2 rounded border px-3 py-2.5 text-left md:mb-1 ${selectedArgId === arg.id ? "border-[#7259B5]/35 text-[#7259B5]" : "border-transparent text-black/50 hover:bg-black/[.03]"}`}>{handle}<span className="flex-1 truncate text-[0.75rem] font-medium">{arg.titulo}</span><Dominio valor={dominioByArgTitulo.get(arg.titulo) ?? arg.dominio}/></button>}</SortableRow>
          ))}
        </div>
        </SortableContext></DndContext>
      </aside>
      <main className="p-6 sm:p-9">
        {selectedArg ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <input value={selectedArg.titulo} onChange={e => setArgumentos(cur => cur.map(a => a.id === selectedArg.id ? { ...a, titulo: e.target.value } : a))} onBlur={e => void updateArgument(selectedArg.id, { titulo: e.target.value })} className="flex-1 bg-transparent text-[1.5rem] font-semibold tracking-[-.03em] text-black/80 outline-none" />
              <button type="button" onClick={() => void deleteArgument(selectedArg.id)} className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] text-black/30 hover:text-[#D94E4E]"><Trash2 size={13} />Remover</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ideia central" value={selectedArg.ideia_central} placeholder="O que a pessoa deve compreender?" onBlur={v => updateArgument(selectedArg.id, { ideia_central: v })} />
              <Field label="Por que isso é verdade?" value={selectedArg.raciocinio} placeholder="Construa a ligação lógica do argumento" onBlur={v => updateArgument(selectedArg.id, { raciocinio: v })} />
              <Field label="Evidência" value={selectedArg.evidencia} placeholder="Que dado, história ou resultado sustenta isso?" onBlur={v => updateArgument(selectedArg.id, { evidencia: v })} />
              <Field label="Relevância para o interlocutor" value={selectedArg.relevancia_interlocutor} placeholder="Conecte o argumento aos interesses de quem escuta" onBlur={v => updateArgument(selectedArg.id, { relevancia_interlocutor: v })} />
            </div>
            <div className="mt-6">
              <div className="mb-4 flex items-center gap-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.625rem] font-semibold uppercase tracking-[.1em] text-black/35 mr-1">Versões</p>
                {(["15s", "30s", "90s"] as const).map(v => (
                  <button key={v} type="button" onClick={() => setVersionTab(v)} className={`pb-2.5 text-[0.75rem] font-medium border-b-2 transition ${versionTab === v ? "border-black/55 text-black/75" : "border-transparent text-black/35 hover:text-black/55"}`}>{v}</button>
                ))}
              </div>
              {versionTab === "15s" && <Field label="Versão de 15 segundos" value={selectedArg.versao_15s} placeholder="Resposta direta e objetiva" onBlur={v => updateArgument(selectedArg.id, { versao_15s: v })} />}
              {versionTab === "30s" && <Field label="Versão de 30 segundos" value={selectedArg.versao_30s} placeholder="Explique e contextualize" onBlur={v => updateArgument(selectedArg.id, { versao_30s: v })} />}
              {versionTab === "90s" && <Field label="Versão de 90 segundos" value={selectedArg.versao_90s} placeholder="Desenvolva com evidência e exemplos" onBlur={v => updateArgument(selectedArg.id, { versao_90s: v })} />}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-black/25"><Save size={12} />Salvo ao sair do campo</p>
          </div>
        ) : <Empty icon={ChevronRight} title="Construa argumentos recuperáveis" text="Selecione um argumento ou crie um novo para editar os detalhes." />}
      </main>
    </div>}

    {section === "treinamento" && <div className="p-5 sm:p-7">{currentCard ? <div className="mx-auto max-w-2xl"><div className="mb-4 flex justify-between text-[0.5625rem] font-medium uppercase tracking-[.12em] text-black/25"><span>Card {activeCard + 1} de {cards.length}</span><span className="flex items-center gap-1"><Clock3 size={11}/>Domínio {currentCard.dominio}/5</span></div><div className="flex min-h-[20.625rem] flex-col rounded border border-black/[.08] p-6 sm:p-8"><p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{currentCard.tipo === "argumento" ? "ARGUMENTO" : currentCard.tipo === "objecao" ? "OBJEÇÃO" : "ROTEIRO"}</p><h3 className="mt-4 whitespace-pre-line text-[1.375rem] font-semibold leading-snug tracking-[-.025em] text-black/75">{currentCard.frente.replace(/\\n/g, "\n").replace(/^LEMBRE-SE\n+(?:Assunto:\s*)?/i, "").trim()}</h3>{showAnswer ? <div className="mt-8 border-t border-black/[.07] pt-5"><p className="whitespace-pre-line text-[0.75rem] leading-relaxed text-black/50">{currentCard.verso.replace(/\\n/g, "\n")}</p></div> : <div className="flex flex-1 items-end"><button type="button" onClick={() => setShowAnswer(true)} className="flex items-center gap-1.5 rounded border border-black/15 bg-white px-3.5 py-2.5 text-[0.6875rem] font-medium text-black/70 hover:bg-black/[.04]"><Eye size={13}/>Ver pontos essenciais</button></div>}</div>{showAnswer && <div className="mt-3 grid grid-cols-3 gap-2"><Review color="#D94E4E" label="Não lembrei" onClick={() => void reviewCard(currentCard, "nao_lembrei")}/><Review color="#B07A14" label="Quase" onClick={() => void reviewCard(currentCard, "quase")}/><Review color="#2E8932" label="Lembrei" onClick={() => void reviewCard(currentCard, "lembrei")}/></div>}<div className="mt-4 flex justify-between"><button type="button" onClick={() => { setActiveCard(current => (current - 1 + cards.length) % cards.length); setShowAnswer(false); }} className="flex items-center gap-1 text-[0.625rem] text-black/35 hover:text-black/55"><ArrowLeft size={12}/>Anterior</button><button type="button" onClick={() => { setActiveCard(current => (current + 1) % cards.length); setShowAnswer(false); }} className="flex items-center gap-1 text-[0.625rem] text-black/35 hover:text-black/55">Próximo<ArrowRight size={12}/></button></div></div> : <Empty icon={RotateCcw} title="Seus flash cards aparecerão aqui" text="Preencha roteiro, argumentos ou objeções e gere os cards." action="Gerar flash cards" onAction={generateCards}/>}</div>}

    {section === "objecoes" && <div className="grid min-h-[35rem] md:grid-cols-[16.25rem_1fr]">
      <aside className="border-b p-3 md:border-b-0 md:border-r" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-[0.875rem] font-semibold text-black/65">Objeções</p>
          <span className="text-[0.6875rem] text-black/30">{objecoes.length}</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          <input value={newObjection} onChange={e => setNewObjection(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void addObjection(); }} placeholder="Registrar objeção…" className="h-10 min-w-0 flex-1 rounded border border-black/10 px-3 text-[0.75rem] outline-none focus:border-[#7259B5]" />
          <button type="button" onClick={() => void addObjection()} aria-label="Adicionar objeção" className="flex h-10 w-10 items-center justify-center rounded border border-[#7259B5]/25 bg-white text-[#7259B5] hover:bg-black/[.04]"><Plus size={15} /></button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => { const { active, over } = e; if (over && active.id !== over.id) { const oi = objecoes.findIndex(o => o.id === active.id); const ni = objecoes.findIndex(o => o.id === over.id); void reorderObjecoes(oi, ni); } }}><SortableContext items={objecoes.map(o => o.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1 md:block">
          {objecoes.map(obs => (
            <SortableRow key={obs.id} id={obs.id}>{handle => <button type="button" onClick={() => setSelectedObsId(obs.id)} className={`flex min-w-[13.125rem] w-full items-start gap-2 rounded border px-3 py-2.5 text-left md:mb-1 ${selectedObsId === obs.id ? "border-[#7259B5]/35" : "border-transparent hover:bg-black/[.03]"}`}>{handle}<span className={`flex-1 line-clamp-2 text-[0.75rem] font-medium leading-snug ${selectedObsId === obs.id ? "text-[#7259B5]" : "text-black/50"}`}>{obs.objecao}</span><Dominio valor={dominioByObjecao.get(obs.id) ?? 0} className="mt-0.5"/></button>}</SortableRow>
          ))}
        </div>
        </SortableContext></DndContext>
      </aside>
      <main className="p-6 sm:p-9">
        {selectedObs ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <textarea value={selectedObs.objecao} onChange={e => setObjecoes(cur => cur.map(o => o.id === selectedObs.id ? { ...o, objecao: e.target.value } : o))} onBlur={e => void updateObjection(selectedObs.id, { objecao: e.target.value })} rows={2} className="flex-1 resize-none bg-transparent text-[1.25rem] font-semibold leading-snug tracking-[-.02em] text-black/75 outline-none" />
              <button type="button" onClick={() => void deleteObjection(selectedObs.id)} className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] text-black/30 hover:text-[#D94E4E]"><Trash2 size={13} />Remover</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pergunta de diagnóstico" value={selectedObs.pergunta_diagnostico} placeholder="O que perguntar antes de responder?" onBlur={v => updateObjection(selectedObs.id, { pergunta_diagnostico: v })} />
              <Field label="Resposta curta" value={selectedObs.resposta_curta} placeholder="Como responder diretamente?" onBlur={v => updateObjection(selectedObs.id, { resposta_curta: v })} />
              <Field label="Resposta aprofundada" value={selectedObs.resposta_aprofundada} placeholder="Como desenvolver a resposta?" onBlur={v => updateObjection(selectedObs.id, { resposta_aprofundada: v })} />
              <Field label="Evidências" value={selectedObs.evidencias} placeholder="Que fatos sustentam a resposta?" onBlur={v => updateObjection(selectedObs.id, { evidencias: v })} />
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-black/25"><Save size={12} />Salvo ao sair do campo</p>
          </div>
        ) : <Empty icon={MessageCircleQuestion} title="Antecipe conversas difíceis" text="Selecione uma objeção ou registre uma nova para trabalhar diagnóstico e resposta." />}
      </main>
    </div>}
  </div>;
}

function AddRow({ value, setValue, placeholder, onAdd }: { value: string; setValue: (value: string) => void; placeholder: string; onAdd: () => void | Promise<void> }) { return <div className="flex flex-col gap-2 sm:flex-row"><input value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void onAdd(); }} placeholder={placeholder} className="h-11 flex-1 rounded border border-black/10 px-3.5 text-[0.875rem] outline-none focus:border-[#7259B5]"/><button type="button" onClick={() => void onAdd()} className="flex h-11 items-center justify-center gap-1.5 rounded border border-black/[.15] bg-white px-4 text-[0.75rem] font-medium text-black/70 transition hover:bg-black/[.04]"><Plus size={14}/>Adicionar</button></div>; }
function Field({ label, value, placeholder, onBlur }: { label: string; value: string | null; placeholder: string; onBlur: (value: string | null) => void | Promise<void> }) { const [draft, setDraft] = useState(value ?? ""); useEffect(() => setDraft(value ?? ""), [value]); return <label className="block"><span className="text-[0.6875rem] font-semibold uppercase tracking-[.08em] text-black/40">{label}</span><textarea value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => void onBlur(draft.trim() || null)} placeholder={placeholder} className="mt-2 min-h-[7rem] w-full resize-none rounded border border-black/[.08] bg-black/[.012] p-4 text-[0.875rem] leading-6 text-black/65 outline-none focus:border-[#7259B5]/35"/></label>; }
function Dominio({ valor, className = "" }: { valor: number; className?: string }) { return <span className={`shrink-0 text-[0.625rem] tabular-nums ${valor ? "text-black/40" : "text-black/30"} ${className}`} title={`Domínio ${valor} de 5`}><span aria-hidden="true">{valor}/5</span><span className="sr-only">Domínio {valor} de 5</span></span>; }
function Review({ color, label, onClick }: { color: string; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded border bg-white px-3 py-3 text-[0.75rem] font-medium hover:bg-black/[.04] active:scale-[.98]" style={{ borderColor: `${color}45`, color }}>{label}</button>; }
function Empty({ icon: Icon, title, text, action, onAction }: { icon: typeof Check; title: string; text: string; action?: string; onAction?: () => void | Promise<void> }) { return <div className="py-20 text-center"><Icon size={24} className="mx-auto text-black/20"/><p className="mt-4 text-[1rem] font-semibold text-black/65">{title}</p><p className="mx-auto mt-2 max-w-md text-[0.8125rem] leading-relaxed text-black/40">{text}</p>{action && <button type="button" onClick={() => void onAction?.()} className="mt-5 rounded border border-[#7259B5]/25 bg-white px-3.5 py-2.5 text-[0.75rem] font-medium text-[#7259B5] hover:bg-black/[.04]">{action}</button>}</div>; }
