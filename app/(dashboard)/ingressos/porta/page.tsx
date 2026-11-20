"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListEmptyState, ListPageHeader, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PortaView, type EntradaRecente, type ResultadoDaConferencia } from "@/components/ticketeria/PortaView";
import type { IngressoAchado } from "@/components/ticketeria/PortaExtrasView";
import { frasesDoDesfazer, horaNoFuso, normalizarCodigo, resultadoDaBusca, resultadoDoDesfazer, type ResumoDaPorta } from "@/lib/ticketeria/porta";

type SessaoNaLista = { id: string; rotulo: string; inicio: number };

// O leitor de QR Code do navegador (BarcodeDetector: Chrome no Android e em parte dos computadores). Sem ele, só o código digitado.
type Detector = { detect(imagem: CanvasImageSource): Promise<{ rawValue: string }[]> };
const criarDetector = (): Detector | null => {
  const Classe = (globalThis as unknown as { BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector }).BarcodeDetector;
  return Classe ? new Classe({ formats: ["qr_code"] }) : null;
};

/** A porta: quem confere os ingressos na entrada do evento. Lê o QR Code pela câmera (ou o código digitado), marca como usado uma vez só e mostra o resultado em verde, âmbar ou vermelho. */
export default function PortaPage() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<{ lojaId: string | null; sessoes: SessaoNaLista[] } | undefined>(undefined);
  const [sessaoId, setSessaoId] = useState("");
  const [resumo, setResumo] = useState<ResumoDaPorta | null>(null);
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<ResultadoDaConferencia | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [semCamera, setSemCamera] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const conferindoAgora = useRef(false);
  // Buscar pelo nome e desfazer uma entrada.
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<IngressoAchado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [desfazer, setDesfazer] = useState<{ codigo: string; comprador: string; ingresso: string; trabalhando?: boolean; erro?: string | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSemCamera(!(typeof navigator !== "undefined" && Boolean(navigator.mediaDevices) && criarDetector() !== null)));
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const t = clienteDaTicketeria(createClient());
      const { data: loja } = await t.from("ticketeria_lojas").select("id").eq("organization_id", organizationId).maybeSingle();
      if (!loja) { if (ativo) setEstado({ lojaId: null, sessoes: [] }); return; }
      const desde = new Date(Date.now() - 12 * 3600e3).toISOString();
      const [{ data: sessoes }, { data: eventos }, { data: locais }] = await Promise.all([
        t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio").eq("organization_id", organizationId).is("cancelada_em", null).gte("inicio", desde).order("inicio").limit(40),
        t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", loja.id),
        t.from("ticketeria_locais").select("id, fuso").eq("loja_id", loja.id),
      ]);
      if (!ativo) return;
      const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
      const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
      const lista = (sessoes ?? []).map(s => {
        const z = fuso.get(s.local_id) ?? "America/Sao_Paulo";
        const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: z, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(s.inicio)).replace(".", "");
        return { id: s.id, inicio: Date.parse(s.inicio), rotulo: `${titulo.get(s.evento_id) ?? "Evento"} · ${dia[0].toUpperCase()}${dia.slice(1)} às ${horaNoFuso(s.inicio, z)}` };
      });
      setEstado({ lojaId: loja.id, sessoes: lista });
      // A sessão mais próxima de agora.
      const agora = Date.now();
      const perto = [...lista].sort((a, b) => Math.abs(a.inicio - agora) - Math.abs(b.inicio - agora))[0];
      if (perto) setSessaoId(perto.id);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const lojaId = estado?.lojaId ?? null;

  const atualizarResumo = useCallback(async () => {
    if (!lojaId || !sessaoId) return;
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/porta?sessao=${sessaoId}`, { cache: "no-store" });
      if (r.ok) setResumo((await r.json()) as ResumoDaPorta);
    } catch { /* o resumo se atualiza na próxima conferência */ }
  }, [lojaId, sessaoId]);

  useEffect(() => { queueMicrotask(() => { setResumo(null); setResultado(null); void atualizarResumo(); }); }, [atualizarResumo]);

  const buscar = useCallback(async (texto: string) => {
    if (!lojaId || !sessaoId || texto.trim().length < 2) { setAchados(null); setBuscando(false); return; }
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/porta/buscar?sessao=${sessaoId}&q=${encodeURIComponent(texto.trim())}`, { cache: "no-store" });
      const achado = r.ok ? resultadoDaBusca(await r.json().catch(() => null)) : null;
      setAchados(achado ? achado.achados : null);
      if (!achado) setErro("Não foi possível buscar agora. Tente de novo.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setBuscando(false);
    }
  }, [lojaId, sessaoId]);

  // A busca espera a pessoa parar de digitar.
  useEffect(() => {
    if (termo.trim().length < 2) { queueMicrotask(() => { setAchados(null); setBuscando(false); }); return; }
    queueMicrotask(() => setBuscando(true));
    const espera = setTimeout(() => void buscar(termo), 350);
    return () => clearTimeout(espera);
  }, [termo, buscar]);

  const confirmarDesfazer = useCallback(async () => {
    if (!lojaId || !sessaoId || !desfazer) return;
    setDesfazer({ ...desfazer, trabalhando: true, erro: null });
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/porta/desfazer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao_id: sessaoId, codigo: desfazer.codigo }) });
      const d = r.ok ? resultadoDoDesfazer(await r.json().catch(() => null)) : null;
      if (!d) { setDesfazer({ ...desfazer, trabalhando: false, erro: r.status === 403 ? "Só quem edita a Ticketeria desfaz entradas." : "Não foi possível desfazer agora. Tente de novo." }); return; }
      const frase = frasesDoDesfazer(d);
      if (frase) { setDesfazer({ ...desfazer, trabalhando: false, erro: frase }); return; }
      setDesfazer(null);
      setAviso(`Entrada de ${desfazer.comprador} desfeita.`);
      setResultado(atual => (atual && "codigo" in atual && atual.codigo === desfazer.codigo ? null : atual));
      void atualizarResumo();
      if (termo.trim().length >= 2) void buscar(termo);
    } catch {
      setDesfazer({ ...desfazer, trabalhando: false, erro: "Sem conexão. Tente de novo." });
    }
  }, [lojaId, sessaoId, desfazer, atualizarResumo, buscar, termo]);

  const pararCamera = useCallback(() => {
    fluxo.current?.getTracks().forEach(t => t.stop());
    fluxo.current = null;
    setLendo(false);
  }, []);
  useEffect(() => pararCamera, [pararCamera]);

  const conferir = useCallback(async (bruto: string) => {
    const limpo = normalizarCodigo(bruto);
    if (!lojaId || !sessaoId || limpo === "" || conferindoAgora.current) return;
    conferindoAgora.current = true;
    setConferindo(true);
    setErro(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/porta`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessao_id: sessaoId, codigo: limpo }) });
      const d = (await r.json().catch(() => ({}))) as ResultadoDaConferencia & { error?: string };
      if (!r.ok || !("tipo" in d)) { setErro(r.status === 403 ? "Só quem edita a Ticketeria confere ingressos." : "Não foi possível conferir agora. Tente de novo."); return; }
      setResultado(d);
      setCodigo("");
      setAviso(null);
      if (termo.trim().length >= 2) void buscar(termo);
      try { navigator.vibrate?.(d.tipo === "pode_entrar" ? 80 : [120, 60, 120]); } catch { /* sem vibração */ }
      void atualizarResumo();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      conferindoAgora.current = false;
      setConferindo(false);
    }
  }, [lojaId, sessaoId, atualizarResumo, buscar, termo]);

  const lerQr = useCallback(async () => {
    if (lendo) { pararCamera(); return; }
    const detector = criarDetector();
    if (!detector) { setSemCamera(true); return; }
    try {
      const f = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      fluxo.current = f;
      setLendo(true);
      setResultado(null);
      await new Promise(resolver => setTimeout(resolver, 50));
      const el = video.current;
      if (el) { el.srcObject = f; await el.play().catch(() => undefined); }
      const volta = setInterval(async () => {
        if (!fluxo.current || !video.current || video.current.readyState < 2) return;
        try {
          const achados = await detector.detect(video.current);
          if (achados.length > 0) { clearInterval(volta); pararCamera(); void conferir(achados[0].rawValue); }
        } catch { /* quadro sem QR: tenta no próximo */ }
      }, 250);
      const parar = f.getTracks()[0];
      parar.addEventListener("ended", () => clearInterval(volta));
    } catch {
      setErro("Não foi possível abrir a câmera. Permita o acesso ou digite o código.");
      setLendo(false);
    }
  }, [lendo, pararCamera, conferir]);

  const opcoes = useMemo(() => (estado?.sessoes ?? []).map(s => ({ id: s.id, rotulo: s.rotulo })), [estado]);

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader eyebrow="Ticketeria" title="Porta" />
      <ListContent>
        {aviso && <p role="status" className="mx-auto mb-4 max-w-[34rem] rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}
        {erro && <p role="alert" className="mx-auto mb-4 max-w-[34rem] rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {opcoes.length === 0 ? (
          <ListTableSurface><ListEmptyState icon={ScanLine} title="Nenhuma sessão para conferir" description="As sessões que ainda vão acontecer (e as das últimas 12 horas) aparecem aqui." /></ListTableSurface>
        ) : (
          <PortaView
            sessoes={opcoes} sessaoId={sessaoId} onSessao={setSessaoId}
            entraram={resumo?.entraram ?? 0} lugares={resumo?.validos ?? 0} recentes={resumo?.recentes ?? ([] as EntradaRecente[])}
            codigo={codigo} onCodigo={setCodigo} onConferir={() => void conferir(codigo)} onLerQr={() => void lerQr()} lendo={lendo} conferindo={conferindo} semCamera={semCamera}
            resultado={resultado} onProximo={() => setResultado(null)}
            busca={{ termo, resultados: achados, buscando }} onBusca={setTermo} onDarEntrada={codigoDoIngresso => void conferir(codigoDoIngresso)}
            desfazer={desfazer} onDesfazer={codigoDaEntrada => { const e = resumo?.recentes.find(x => x.codigo === codigoDaEntrada); if (e) { setAviso(null); setDesfazer({ codigo: e.codigo, comprador: e.comprador, ingresso: e.ingresso }); } }}
            onConfirmarDesfazer={() => void confirmarDesfazer()} onCancelarDesfazer={() => setDesfazer(null)}
            relatorioHref={`/ingressos/porta/relatorio?sessao=${sessaoId}`}
            previa={lendo ? <video ref={video} muted playsInline className="mb-3 aspect-video w-full rounded-xl border border-black/10 bg-[#1C0E33] object-cover" aria-label="Câmera lendo o QR Code" /> : undefined}
          />
        )}
      </ListContent>
    </>
  );
}
