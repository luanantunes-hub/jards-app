"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { LIMITE_DO_PDF_BYTES, OPACIDADE_MAXIMA, OPACIDADE_MINIMA, OPACIDADE_PADRAO, paginaEscolhida, primeiroQueCabe } from "@/lib/producao/fundo-da-planta";

/** O pdfjs só é carregado aqui (na planta, ao escolher um PDF): o resto do app não paga o peso dele. */
async function carregarPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

/** Desenha uma página do PDF na largura pedida (fundo branco, porque o JPEG não tem transparência) e devolve o data URL. */
async function desenharPagina(documento: PDFDocumentProxy, numero: number, largura: number, qualidade: number): Promise<string> {
  const pagina = await documento.getPage(numero);
  const medida = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: largura / medida.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("sem_canvas");
  contexto.fillStyle = "#fff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvas, viewport }).promise;
  return canvas.toDataURL("image/jpeg", qualidade);
}

/** Escolhe o PDF e a página que viram o fundo da planta (a planta exportada do Vectorworks), com a transparência. */
export function FundoDaPlantaSheet({ plantaId, temFundo, opacidadeAtual, onClose, onSalvou }: {
  plantaId: string; temFundo: boolean; opacidadeAtual: number; onClose: () => void; onSalvou: (fundo: string | null, opacidade: number) => void;
}) {
  const documento = useRef<PDFDocumentProxy | null>(null);
  const tarefa = useRef<PDFDocumentLoadingTask | null>(null);
  const contador = useRef(0);
  const [arquivo, setArquivo] = useState("");
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState("1");
  const [opacidade, setOpacidade] = useState(opacidadeAtual || OPACIDADE_PADRAO);
  const [previa, setPrevia] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => () => { void tarefa.current?.destroy(); }, []);

  async function mostrarPrevia(numero: number) {
    if (!documento.current) return;
    const minha = ++contador.current;
    setLendo(true);
    try {
      const imagem = await desenharPagina(documento.current, numero, 700, 0.7);
      if (minha === contador.current) setPrevia(imagem);
    } catch {
      if (minha === contador.current) setErro("Não foi possível desenhar essa página.");
    } finally {
      if (minha === contador.current) setLendo(false);
    }
  }

  async function escolherArquivo(lido: File | undefined) {
    if (!lido) return;
    setErro(null);
    setPrevia(null);
    if (lido.type !== "application/pdf" && !lido.name.toLowerCase().endsWith(".pdf")) { setErro("Escolha um arquivo PDF (no Vectorworks, exporte a planta em PDF)."); return; }
    if (lido.size > LIMITE_DO_PDF_BYTES) { setErro("O PDF passa de 25 MB. Exporte só a página da planta."); return; }
    setLendo(true);
    try {
      const pdfjs = await carregarPdfjs();
      const bytes = new Uint8Array(await lido.arrayBuffer());
      const nova = pdfjs.getDocument({ data: bytes });
      const novo = await nova.promise;
      void tarefa.current?.destroy();
      tarefa.current = nova;
      documento.current = novo;
      setArquivo(lido.name);
      setTotal(novo.numPages);
      setPagina("1");
      await mostrarPrevia(1);
    } catch {
      setErro("Não foi possível abrir esse PDF. Confira se o arquivo não está protegido por senha nem corrompido.");
      setLendo(false);
    }
  }

  function mudarPagina(texto: string) {
    const numero = paginaEscolhida(texto, total);
    setPagina(texto === "" ? "" : String(numero));
    if (texto !== "") void mostrarPrevia(numero);
  }

  async function usar(fechar: () => void) {
    if (!documento.current) { setErro("Escolha um PDF primeiro."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const numero = paginaEscolhida(pagina, total);
      const imagem = await primeiroQueCabe((largura, qualidade) => desenharPagina(documento.current as PDFDocumentProxy, numero, largura, qualidade));
      if (imagem === null) { setErro("Essa página é pesada demais para virar fundo. Tente outra página ou exporte uma planta mais simples."); return; }
      const { error } = await clienteDaProducao(createClient()).from("producao_plantas").update({ fundo: imagem, fundo_opacidade: opacidade }).eq("id", plantaId);
      if (error) { setErro(error.code === "42501" ? "Você não pode mudar esta planta." : "Não foi possível guardar o fundo. Tente de novo."); return; }
      onSalvou(imagem, opacidade);
      fechar();
    } catch {
      setErro("Não foi possível desenhar essa página. Tente outra.");
    } finally {
      setSalvando(false);
    }
  }

  async function tirar(fechar: () => void) {
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_plantas").update({ fundo: null }).eq("id", plantaId);
    setSalvando(false);
    if (error) { setErro("Não foi possível tirar o fundo. Tente de novo."); return; }
    onSalvou(null, opacidade);
    fechar();
  }

  return (
    <TopSheet
      titulo="Fundo da planta"
      onClose={onClose}
      footer={fechar => (
        <>
          {temFundo && <button type="button" onClick={() => void tirar(fechar)} disabled={salvando} className={APAGAR}>Tirar o fundo</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void usar(fechar)} disabled={salvando || lendo || !documento.current} className={SALVAR}>{salvando ? "Guardando…" : "Usar como fundo"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="fundo-pdf">PDF da planta</label>
          <input id="fundo-pdf" type="file" accept="application/pdf,.pdf" disabled={salvando} onChange={event => void escolherArquivo(event.target.files?.[0])}
            className="block w-full text-[0.8125rem] text-[#282525] file:mr-3 file:h-10 file:cursor-pointer file:rounded file:border file:border-black/[.12] file:bg-white file:px-3.5 file:text-[0.75rem] file:font-medium file:text-[#282525] hover:file:bg-black/[.04]" />
          {arquivo && <p className="mt-1 text-[0.6875rem] text-black/45">{arquivo} · {total} {total === 1 ? "página" : "páginas"}</p>}
        </div>
        {total > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={ROTULO} htmlFor="fundo-pagina">Página (1 a {total})</label>
              <input id="fundo-pagina" inputMode="numeric" className={CAMPO} value={pagina} onChange={event => mudarPagina(event.target.value.replace(/\D/g, ""))} disabled={salvando || total === 1} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="fundo-opacidade">Transparência do fundo: {opacidade}%</label>
              <input id="fundo-opacidade" type="range" min={OPACIDADE_MINIMA} max={OPACIDADE_MAXIMA} step={5} value={opacidade} onChange={event => setOpacidade(Number(event.target.value))} disabled={salvando} className="mt-2 w-full accent-[#282525]" />
            </div>
          </div>
        )}
        {(previa || lendo) && (
          <div className="flex min-h-40 items-center justify-center overflow-hidden rounded border bg-black/[.02] p-2" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a prévia é uma imagem gerada no navegador (data URL): o otimizador do Next não serve */}
            {previa ? <img src={previa} alt={`Página ${pagina} do PDF`} className="max-h-[22rem] w-auto max-w-full" style={{ opacity: opacidade / 100 }} /> : null}
            {lendo && !previa && <span className="text-[0.75rem] text-black/45">Lendo o PDF…</span>}
          </div>
        )}
      </div>
    </TopSheet>
  );
}
