"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Download, RotateCcw, RotateCw, Search, Trash2, TriangleAlert } from "lucide-react";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { papelNaProducao } from "@/lib/producao/permissoes";
import { FASES_DE_ENERGIA, TIPOS_DE_OBJETO_DA_PLANTA, type FaseDeEnergia, type TipoDeObjetoDaPlanta, type TipoDePlanta } from "@/lib/producao/estados";
import { cargaDeEnergia, csvDaEnergia, csvDosCanais, listaDeCanais, ROTULO_DO_TIPO_DE_OBJETO } from "@/lib/producao/palco";
import { Dropdown } from "@/components/ui/Dropdown";
import { encaixar, girar, manterDentro, objetoDoItem, pixelsParaMetros, ROTULO_DO_TIPO_DE_PLANTA } from "@/lib/producao/planta";
import { lerNumero } from "@/lib/producao/inventario";
import { chaveDoNome } from "@/lib/dominio";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";

type Planta = { id: string; nome: string; tipo: TipoDePlanta; largura_m: number; profundidade_m: number };
type Objeto = {
  id: string; item_id: string | null; rotulo: string; x_m: number; y_m: number; largura_m: number; profundidade_m: number; rotacao_graus: number;
  tipo: TipoDeObjetoDaPlanta; canais: number | null; potencia_w: number | null; circuito: string | null; fase: FaseDeEnergia | null; canal_inicial: number | null;
};
const COLUNAS_DO_OBJETO = "id, item_id, rotulo, x_m, y_m, largura_m, profundidade_m, rotacao_graus, tipo, canais, potencia_w, circuito, fase, canal_inicial";
type ValoresDoPainel = { rotulo: string; largura: string; profundidade: string; tipo: string; canais: string; canalInicial: string; potencia: string; circuito: string; fase: string };
type ItemDoInventario = { id: string; nome: string; categoria: string; comprimento_cm: number | null; largura_cm: number | null; canais: number | null; potencia_w: number | null };

const CAMPO = "h-9 w-full rounded border border-black/[.12] bg-white px-2.5 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/50";
const metros = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const tipoDoItem = (categoria: string): TipoDeObjetoDaPlanta => (categoria === "instrumento" || categoria === "praticavel" || categoria === "cenario" ? categoria : "outro");

function baixar(nome: string, conteudo: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** O painel do objeto selecionado: rótulo, medidas e giro. Nasce de novo a cada objeto (a `key` muda), então os campos partem do valor guardado. */
function PainelDoObjeto({ objeto, podeEditar, onGirar, onAplicar, onRemover }: {
  objeto: Objeto; podeEditar: boolean; onGirar: (passo: number) => void; onAplicar: (valores: ValoresDoPainel) => void; onRemover: () => void;
}) {
  const [rotulo, setRotulo] = useState(objeto.rotulo);
  const [largura, setLargura] = useState(metros(objeto.largura_m));
  const [profundidade, setProfundidade] = useState(metros(objeto.profundidade_m));
  const [tipo, setTipo] = useState<string>(objeto.tipo);
  const [canais, setCanais] = useState(objeto.canais === null ? "" : String(objeto.canais));
  const [canalInicial, setCanalInicial] = useState(objeto.canal_inicial === null ? "" : String(objeto.canal_inicial));
  const [potencia, setPotencia] = useState(objeto.potencia_w === null ? "" : String(objeto.potencia_w));
  const [circuito, setCircuito] = useState(objeto.circuito ?? "");
  const [fase, setFase] = useState<string>(objeto.fase ?? "");
  return (
    <section className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-label="Objeto selecionado">
      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Objeto selecionado</p>
      <p className="mt-1 text-[0.6875rem] tabular-nums text-black/45">x {metros(objeto.x_m)} m · y {metros(objeto.y_m)} m · {metros(objeto.rotacao_graus)}°</p>
      <div className="mt-3 space-y-3">
        <div><label className={ROTULO} htmlFor="obj-rotulo">Rótulo</label><input id="obj-rotulo" className={CAMPO} value={rotulo} onChange={event => setRotulo(event.target.value)} maxLength={120} disabled={!podeEditar} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={ROTULO} htmlFor="obj-largura">Largura (m)</label><input id="obj-largura" inputMode="decimal" className={CAMPO} value={largura} onChange={event => setLargura(event.target.value)} disabled={!podeEditar} /></div>
          <div><label className={ROTULO} htmlFor="obj-profundidade">Profundidade (m)</label><input id="obj-profundidade" inputMode="decimal" className={CAMPO} value={profundidade} onChange={event => setProfundidade(event.target.value)} disabled={!podeEditar} /></div>
        </div>
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} onChange={setTipo} options={TIPOS_DE_OBJETO_DA_PLANTA.map(valor => ({ value: valor, label: ROTULO_DO_TIPO_DE_OBJETO[valor] }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={ROTULO} htmlFor="obj-canais">Canais de áudio</label><input id="obj-canais" inputMode="numeric" className={CAMPO} value={canais} onChange={event => setCanais(event.target.value)} placeholder="0" disabled={!podeEditar} /></div>
          <div><label className={ROTULO} htmlFor="obj-canal-inicial">Fixar no canal</label><input id="obj-canal-inicial" inputMode="numeric" className={CAMPO} value={canalInicial} onChange={event => setCanalInicial(event.target.value)} placeholder="auto" disabled={!podeEditar} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className={ROTULO} htmlFor="obj-potencia">Potência (W)</label><input id="obj-potencia" inputMode="numeric" className={CAMPO} value={potencia} onChange={event => setPotencia(event.target.value)} disabled={!podeEditar} /></div>
          <div><label className={ROTULO} htmlFor="obj-circuito">Circuito</label><input id="obj-circuito" className={CAMPO} value={circuito} onChange={event => setCircuito(event.target.value)} placeholder="C1" maxLength={20} disabled={!podeEditar} /></div>
          <div><span className={ROTULO}>Fase</span><Dropdown value={fase} onChange={setFase} options={[{ value: "", label: "—" }, ...FASES_DE_ENERGIA.map(valor => ({ value: valor, label: valor }))]} /></div>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onGirar(-15)} aria-label="Girar 15 graus para a esquerda" className="flex h-9 w-9 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><RotateCcw size={14} aria-hidden="true" /></button>
            <button type="button" onClick={() => onGirar(15)} aria-label="Girar 15 graus para a direita" className="flex h-9 w-9 items-center justify-center rounded border border-black/[.12] text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><RotateCw size={14} aria-hidden="true" /></button>
            <button type="button" onClick={() => onGirar(90)} className="h-9 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">Girar 90°</button>
            <button type="button" onClick={() => onAplicar({ rotulo, largura, profundidade, tipo, canais, canalInicial, potencia, circuito, fase })} className="ml-auto h-9 rounded bg-[#2E8932] px-3.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]">Aplicar</button>
            <button type="button" onClick={onRemover} aria-label="Tirar da planta" title="Tirar da planta" className="flex h-9 w-9 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
          </div>
        )}
      </div>
    </section>
  );
}

/** O editor da planta: o desenho em metros, com os objetos que se arrastam (pointer events, funciona no celular). */
export default function PlantaPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = useOrganizationId();
  const papel = useOrganizationRole();
  const { confirmDelete } = useDeleteConfirm();
  const svgRef = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ id: string; deslocX: number; deslocY: number } | null>(null);
  const [planta, setPlanta] = useState<Planta | null | undefined>(undefined);
  const [objetos, setObjetos] = useState<Objeto[]>([]);
  const [itens, setItens] = useState<ItemDoInventario[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [livre, setLivre] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = papel !== null && papelNaProducao(papel) !== null && papelNaProducao(papel) !== "leitor";

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [pla, obj, ite] = await Promise.all([
        producao.from("producao_plantas").select("id, nome, tipo, largura_m, profundidade_m").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
        producao.from("producao_planta_objetos").select(COLUNAS_DO_OBJETO).eq("planta_id", id).order("created_at"),
        producao.from("producao_itens").select("id, nome, categoria, comprimento_cm, largura_cm, canais, potencia_w").eq("organization_id", organizationId).eq("arquivado", false).order("nome"),
      ]);
      if (!ativo) return;
      setPlanta(pla.error ? null : (pla.data as Planta | null));
      setObjetos((obj.data ?? []) as Objeto[]);
      setItens((ite.data ?? []) as ItemDoInventario[]);
    })();
    return () => { ativo = false; };
  }, [id, organizationId]);

  const atual = objetos.find(objeto => objeto.id === selecionado) ?? null;
  const disponiveis = useMemo(() => {
    const chave = chaveDoNome(busca);
    return itens.filter(item => !chave || chaveDoNome(item.nome).includes(chave)).slice(0, 40);
  }, [itens, busca]);

  const canais = useMemo(() => listaDeCanais(objetos), [objetos]);
  const energia = useMemo(() => cargaDeEnergia(objetos), [objetos]);
  const faixaDoObjeto = useMemo(() => {
    const faixas = new Map<string, [number, number]>();
    for (const linha of canais.linhas) {
      const atualFaixa = faixas.get(linha.objetoId);
      faixas.set(linha.objetoId, atualFaixa ? [Math.min(atualFaixa[0], linha.canal), Math.max(atualFaixa[1], linha.canal)] : [linha.canal, linha.canal]);
    }
    return faixas;
  }, [canais]);

  const viewBox = planta ? { x: -0.5, y: -0.5, largura: planta.largura_m + 1, altura: planta.profundidade_m + 1 } : null;

  function aoPressionar(event: React.PointerEvent<SVGGElement>, objeto: Objeto) {
    setSelecionado(objeto.id);
    if (!podeEditar || !svgRef.current || !viewBox) return;
    const ponto = pixelsParaMetros({ x: event.clientX, y: event.clientY }, svgRef.current.getBoundingClientRect(), viewBox);
    arrasto.current = { id: objeto.id, deslocX: ponto.x - objeto.x_m, deslocY: ponto.y - objeto.y_m };
    svgRef.current.setPointerCapture(event.pointerId);
  }

  function aoMover(event: React.PointerEvent<SVGSVGElement>) {
    const atualArrasto = arrasto.current;
    if (!atualArrasto || !planta || !viewBox) return;
    const ponto = pixelsParaMetros({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), viewBox);
    setObjetos(lista => lista.map(objeto => {
      if (objeto.id !== atualArrasto.id) return objeto;
      const novo = { ...objeto, x_m: encaixar(ponto.x - atualArrasto.deslocX), y_m: encaixar(ponto.y - atualArrasto.deslocY) };
      return { ...novo, ...manterDentro(novo, planta) };
    }));
  }

  async function aoSoltar() {
    const atualArrasto = arrasto.current;
    arrasto.current = null;
    if (!atualArrasto) return;
    const objeto = objetos.find(item => item.id === atualArrasto.id);
    if (!objeto) return;
    const { error } = await clienteDaProducao(createClient()).from("producao_planta_objetos").update({ x_m: objeto.x_m, y_m: objeto.y_m }).eq("id", objeto.id);
    if (error) setErro("Não foi possível guardar a posição. Tente de novo.");
  }

  async function adicionar(dados: { item_id?: string; rotulo: string; largura_m: number; profundidade_m: number; x_m: number; y_m: number; tipo?: TipoDeObjetoDaPlanta; canais?: number | null; potencia_w?: number | null }) {
    if (!organizationId || !planta) return;
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).from("producao_planta_objetos")
      .insert({ organization_id: organizationId, planta_id: planta.id, ...dados })
      .select(COLUNAS_DO_OBJETO).single();
    if (error || !data) { setErro(error?.code === "42501" ? "Você não pode mudar esta planta." : "Não foi possível pôr o objeto. Tente de novo."); return; }
    setObjetos(lista => [...lista, data as Objeto]);
    setSelecionado(data.id);
  }

  async function guardar(mudanca: Partial<Pick<Objeto, "rotulo" | "largura_m" | "profundidade_m" | "rotacao_graus" | "x_m" | "y_m" | "tipo" | "canais" | "potencia_w" | "circuito" | "fase" | "canal_inicial">>) {
    if (!atual || !planta) return;
    setErro(null);
    const novo = { ...atual, ...mudanca };
    const dentro = manterDentro(novo, planta);
    const final = { ...novo, ...dentro };
    setObjetos(lista => lista.map(objeto => (objeto.id === atual.id ? final : objeto)));
    const { error } = await clienteDaProducao(createClient()).from("producao_planta_objetos")
      .update({ rotulo: final.rotulo, largura_m: final.largura_m, profundidade_m: final.profundidade_m, rotacao_graus: final.rotacao_graus, x_m: final.x_m, y_m: final.y_m, tipo: final.tipo, canais: final.canais, potencia_w: final.potencia_w, circuito: final.circuito, fase: final.fase, canal_inicial: final.canal_inicial }).eq("id", atual.id);
    if (error) setErro("Não foi possível guardar. Tente de novo.");
  }

  function aplicar(valores: ValoresDoPainel) {
    const l = lerNumero(valores.largura), p = lerNumero(valores.profundidade);
    if (!valores.rotulo.trim() || l === null || l === "invalido" || p === null || p === "invalido" || l < 0.05 || p < 0.05 || l > 500 || p > 500) {
      setErro("O rótulo é obrigatório e as medidas ficam entre 0,05 e 500 metros.");
      return;
    }
    const inteiro = (texto: string, minimo: number, maximo: number): number | null | "erro" => {
      const n = lerNumero(texto);
      if (n === null) return null;
      return n === "invalido" || !Number.isInteger(n) || n < minimo || n > maximo ? "erro" : n;
    };
    const canais = inteiro(valores.canais, 0, 128), inicial = inteiro(valores.canalInicial, 1, 512), potencia = inteiro(valores.potencia, 0, 1_000_000);
    if (canais === "erro") { setErro("Os canais são um número inteiro de 0 a 128."); return; }
    if (inicial === "erro") { setErro("O canal fixado é um número inteiro de 1 a 512."); return; }
    if (potencia === "erro") { setErro("A potência é um número inteiro de watts."); return; }
    if (inicial !== null && !(canais && canais > 0)) { setErro("Para fixar o canal, informe quantos canais o objeto usa."); return; }
    const circuito = valores.circuito.trim();
    void guardar({
      rotulo: valores.rotulo.trim().slice(0, 120), largura_m: Math.round(l * 100) / 100, profundidade_m: Math.round(p * 100) / 100,
      tipo: valores.tipo as TipoDeObjetoDaPlanta, canais: canais === 0 ? null : canais, canal_inicial: inicial, potencia_w: potencia,
      circuito: circuito === "" ? null : circuito.slice(0, 20), fase: valores.fase === "" ? null : (valores.fase as FaseDeEnergia),
    });
  }

  function remover() {
    if (!atual) return;
    const alvo = atual;
    confirmDelete({
      title: "Tirar da planta?",
      description: `"${alvo.rotulo}" sai desta planta. O item continua no inventário.`,
      confirmLabel: "Tirar",
      pendingLabel: "Tirando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_planta_objetos").delete().eq("id", alvo.id);
        if (error) throw new Error("Não foi possível tirar o objeto.");
        setObjetos(lista => lista.filter(objeto => objeto.id !== alvo.id));
        setSelecionado(null);
      },
    });
  }

  if (planta === undefined) return <DetailPageSkeleton />;
  if (planta === null || !viewBox) return <DetailNotFound title="Planta não encontrada" description="Ela pode ter sido apagada ou você não tem acesso." backHref="/producoes/plantas" backLabel="Voltar às plantas" />;

  const linhasX = Array.from({ length: Math.floor(planta.largura_m) + 1 }, (_, i) => i);
  const linhasY = Array.from({ length: Math.floor(planta.profundidade_m) + 1 }, (_, i) => i);

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <DetailBackLink href="/producoes/plantas" label="Plantas" />
          <h1 className="mt-5 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{planta.nome}</h1>
          <p className="mt-1 text-[0.75rem] text-black/45">{ROTULO_DO_TIPO_DE_PLANTA[planta.tipo]} · {metros(planta.largura_m)} × {metros(planta.profundidade_m)} m · cada quadrado é 1 m</p>
        </div>
      </header>
      <DetailPageContent>
        {erro && <p role="alert" className="mb-4 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.largura} ${viewBox.altura}`}
              role="img"
              aria-label={`Planta ${planta.nome}, ${metros(planta.largura_m)} por ${metros(planta.profundidade_m)} metros, com ${objetos.length} ${objetos.length === 1 ? "objeto" : "objetos"}`}
              className="block w-full select-none"
              style={{ touchAction: "none" }}
              onPointerMove={aoMover}
              onPointerUp={() => void aoSoltar()}
              onPointerCancel={() => void aoSoltar()}
              onPointerDown={event => { if (event.target === event.currentTarget) setSelecionado(null); }}
            >
              <rect x={0} y={0} width={planta.largura_m} height={planta.profundidade_m} fill="#fff" stroke="rgba(13,13,13,.35)" strokeWidth={0.05} />
              {linhasX.map(x => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={planta.profundidade_m} stroke="rgba(13,13,13,.08)" strokeWidth={x % 5 === 0 ? 0.04 : 0.02} />)}
              {linhasY.map(y => <line key={`y${y}`} x1={0} y1={y} x2={planta.largura_m} y2={y} stroke="rgba(13,13,13,.08)" strokeWidth={y % 5 === 0 ? 0.04 : 0.02} />)}
              <text x={planta.largura_m / 2} y={-0.12} textAnchor="middle" fontSize={0.3} fill="rgba(13,13,13,.4)">fundo do palco</text>
              <text x={planta.largura_m / 2} y={planta.profundidade_m + 0.38} textAnchor="middle" fontSize={0.3} fill="rgba(13,13,13,.4)">plateia</text>
              {objetos.map(objeto => {
                const marcado = objeto.id === selecionado;
                const tamanhoDaLetra = Math.max(0.16, Math.min(0.34, (objeto.largura_m / Math.max(objeto.rotulo.length, 1)) * 1.7));
                return (
                  <g
                    key={objeto.id}
                    transform={`translate(${objeto.x_m} ${objeto.y_m}) rotate(${objeto.rotacao_graus} ${objeto.largura_m / 2} ${objeto.profundidade_m / 2})`}
                    onPointerDown={event => aoPressionar(event, objeto)}
                    style={{ cursor: podeEditar ? "grab" : "pointer" }}
                  >
                    <title>{objeto.rotulo}</title>
                    <rect width={objeto.largura_m} height={objeto.profundidade_m} fill="rgba(114,89,181,.12)" stroke={marcado ? "#7259B5" : "rgba(13,13,13,.45)"} strokeWidth={marcado ? 0.08 : 0.04} />
                    <text x={objeto.largura_m / 2} y={objeto.profundidade_m / 2 + tamanhoDaLetra * 0.35} textAnchor="middle" fontSize={tamanhoDaLetra} fill="#282525" style={{ pointerEvents: "none" }}>{objeto.rotulo}</text>
                    {faixaDoObjeto.has(objeto.id) && (
                      <text x={0.06} y={0.2} fontSize={0.18} fill="rgba(13,13,13,.55)" style={{ pointerEvents: "none" }}>
                        {(() => { const [de, ate] = faixaDoObjeto.get(objeto.id) as [number, number]; return de === ate ? `CH ${de}` : `CH ${de}–${ate}`; })()}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <aside className="space-y-6" aria-label="Objetos da planta">
            {atual && (
              <PainelDoObjeto key={`${atual.id}-${atual.largura_m}-${atual.profundidade_m}-${atual.rotulo}`} objeto={atual} podeEditar={podeEditar} onGirar={passo => void guardar({ rotacao_graus: girar(atual.rotacao_graus, passo) })} onAplicar={aplicar} onRemover={remover} />
            )}

            {podeEditar && (
              <section aria-label="Pôr na planta">
                <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Pôr na planta</p>
                <label className="relative mb-2 block">
                  <span className="sr-only">Buscar item do inventário</span>
                  <Search size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                  <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar no inventário" className="h-10 w-full rounded border border-black/[.12] bg-white pl-8 pr-3 text-[0.8125rem] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
                </label>
                {itens.length === 0 ? (
                  <p className="text-[0.75rem] text-black/45">O inventário está vazio. Cadastre itens em Inventário, ou ponha um objeto solto abaixo.</p>
                ) : (
                  <ul className="max-h-64 divide-y divide-black/[.06] overflow-y-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    {disponiveis.map(item => (
                      <li key={item.id}>
                        <button type="button" onClick={() => void adicionar({ item_id: item.id, ...objetoDoItem(item, planta), tipo: tipoDoItem(item.categoria), canais: item.canais && item.canais > 0 ? item.canais : null, potencia_w: item.potencia_w })} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.75rem] text-[#282525] transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                          <span className="truncate">{item.nome}</span>
                          <span className="shrink-0 text-[0.6875rem] text-black/40">+ pôr</span>
                        </button>
                      </li>
                    ))}
                    {disponiveis.length === 0 && <li className="px-3 py-2 text-[0.75rem] text-black/45">Nenhum item com esse nome.</li>}
                  </ul>
                )}
                <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); const nome = livre.trim(); if (!nome) return; void adicionar(objetoDoItem({ nome, comprimento_cm: null, largura_cm: null }, planta)); setLivre(""); }}>
                  <input value={livre} onChange={event => setLivre(event.target.value)} aria-label="Nome do objeto solto" placeholder="Objeto solto (ex.: bateria)" maxLength={120} className="h-10 min-w-0 flex-1 rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
                  <button type="submit" className="h-10 rounded border border-black/[.12] px-3.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Pôr</button>
                </form>
              </section>
            )}
          </aside>
        </div>

        <section aria-labelledby="canais-e-energia" className="mt-10 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="canais-e-energia" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Lista de canais{canais.total > 0 ? ` · ${canais.total}` : ""}</h2>
              {canais.linhas.length > 0 && <button type="button" onClick={() => baixar(`canais-${planta.nome}.csv`, csvDosCanais(canais))} className="inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Download size={13} aria-hidden="true" /> Planilha</button>}
            </div>
            {canais.conflitos.length > 0 && (
              <p className="mb-3 flex items-start gap-2 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>
                <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {canais.conflitos.length === 1 ? "O canal" : "Os canais"} {canais.conflitos.map(conflito => conflito.canal).join(", ")} {canais.conflitos.length === 1 ? "tem" : "têm"} mais de uma fonte fixada.
              </p>
            )}
            {canais.linhas.length === 0 ? (
              <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Diga quantos canais de áudio cada objeto usa (microfone, instrumento) e a lista aparece aqui, numerada.</p>
            ) : (
              <table className="w-full overflow-hidden rounded border bg-white text-left" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <thead><tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}><th scope="col" className="w-16 px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Canal</th><th scope="col" className="px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Fonte</th></tr></thead>
                <tbody>{canais.linhas.map((linha, indice) => (
                  <tr key={`${linha.objetoId}-${linha.canal}-${indice}`} className="border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    <td className="px-3 py-1.5 text-[0.75rem] tabular-nums text-black/55">{linha.canal}</td><td className="px-3 py-1.5 text-[0.8125rem] text-[#282525]">{linha.fonte}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Energia{energia.totalW > 0 ? ` · ${energia.totalW.toLocaleString("pt-BR")} W` : ""}</h2>
              {energia.linhas.length > 0 && <button type="button" onClick={() => baixar(`energia-${planta.nome}.csv`, csvDaEnergia(energia))} className="inline-flex h-9 items-center gap-1.5 rounded border border-black/[.12] px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Download size={13} aria-hidden="true" /> Planilha</button>}
            </div>
            {energia.linhas.length === 0 ? (
              <p className="rounded border bg-white px-4 py-5 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Informe a potência, o circuito e a fase de cada objeto e a carga por circuito aparece aqui.</p>
            ) : (
              <>
                <table className="w-full overflow-hidden rounded border bg-white text-left" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <thead><tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    {["Circuito", "Fase", "Objetos", "Potência", `A (${energia.tensaoV} V)`].map(titulo => <th key={titulo} scope="col" className="px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{titulo}</th>)}
                  </tr></thead>
                  <tbody>{energia.linhas.map(linha => (
                    <tr key={`${linha.circuito}-${linha.fase}`} className="border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      <td className="px-3 py-1.5 text-[0.8125rem] text-[#282525]">{linha.circuito}</td>
                      <td className="px-3 py-1.5 text-[0.75rem] text-black/55">{linha.fase ?? "—"}</td>
                      <td className="px-3 py-1.5 text-[0.75rem] tabular-nums text-black/55">{linha.objetos}</td>
                      <td className="px-3 py-1.5 text-[0.75rem] tabular-nums text-black/65">{linha.potenciaW.toLocaleString("pt-BR")} W</td>
                      <td className="px-3 py-1.5 text-[0.75rem] tabular-nums text-black/65">{linha.correnteA.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <p className="mt-2 text-[0.6875rem] tabular-nums text-black/45">
                  Por fase: R {energia.porFase.R.toLocaleString("pt-BR")} W · S {energia.porFase.S.toLocaleString("pt-BR")} W · T {energia.porFase.T.toLocaleString("pt-BR")} W
                  {energia.porFase.sem > 0 ? ` · sem fase ${energia.porFase.sem.toLocaleString("pt-BR")} W` : ""}
                  {energia.desequilibrioPct !== null ? ` · desequilíbrio ${energia.desequilibrioPct}%` : ""}
                </p>
              </>
            )}
          </div>
        </section>
      </DetailPageContent>
    </div>
  );
}
