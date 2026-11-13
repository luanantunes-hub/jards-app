"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { lerCodigo } from "@/lib/producao/credenciais";

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type FabricaDeDetector = new (opcoes: { formats: string[] }) => Detector;

/** Quanto tempo o mesmo QR fica sem ser lido de novo (a câmera continua apontada para ele depois da leitura). */
const PAUSA_DO_MESMO_CODIGO_MS = 4000;
const INTERVALO_DA_LEITURA_MS = 250;

/**
 * Lê o QR das credenciais pela câmera, só nesta página (a câmera é liberada por cabeçalho apenas em /producoes/porta). Usa o leitor
 * de QR do próprio navegador (`BarcodeDetector`); onde ele não existe, avisa e deixa o campo de código como saída. Só o código que
 * tem o formato da credencial é entregue.
 */
export function LeitorDeCamera({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const [ligada, setLigada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const entrega = useRef(onCodigo);
  const [suportado] = useState(() => typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);

  useEffect(() => { entrega.current = onCodigo; }, [onCodigo]);

  useEffect(() => {
    if (!ligada) return;
    let parado = false;
    let fluxo: MediaStream | null = null;
    let relogio: ReturnType<typeof setInterval> | null = null;
    let ultimo = { codigo: "", em: 0 };
    void (async () => {
      try {
        const Fabrica = (window as unknown as { BarcodeDetector: FabricaDeDetector }).BarcodeDetector;
        const detector = new Fabrica({ formats: ["qr_code"] });
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (parado) { fluxo.getTracks().forEach(faixa => faixa.stop()); return; }
        const elemento = video.current;
        if (!elemento) return;
        elemento.srcObject = fluxo;
        await elemento.play();
        relogio = setInterval(() => {
          void (async () => {
            if (parado || elemento.readyState < 2) return;
            try {
              const achados = await detector.detect(elemento);
              for (const achado of achados) {
                const codigo = lerCodigo(achado.rawValue);
                if (!codigo) continue;
                const agora = Date.now();
                if (codigo === ultimo.codigo && agora - ultimo.em < PAUSA_DO_MESMO_CODIGO_MS) continue;
                ultimo = { codigo, em: agora };
                entrega.current(codigo);
                break;
              }
            } catch { /* um quadro sem QR ou ainda sem imagem: tenta no próximo */ }
          })();
        }, INTERVALO_DA_LEITURA_MS);
      } catch (falha) {
        const negou = falha instanceof DOMException && (falha.name === "NotAllowedError" || falha.name === "SecurityError");
        setErro(negou ? "A câmera está bloqueada. Libere a câmera para este site no navegador, ou digite o código." : "Não foi possível abrir a câmera. Digite o código.");
        setLigada(false);
      }
    })();
    return () => {
      parado = true;
      if (relogio) clearInterval(relogio);
      fluxo?.getTracks().forEach(faixa => faixa.stop());
    };
  }, [ligada]);

  if (!suportado) {
    return <p className="rounded border bg-white px-4 py-3 text-[0.75rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>Este navegador não lê QR pela câmera. Digite o código abaixo, ou abra esta página no Chrome do Android ou do computador.</p>;
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => { setErro(null); setLigada(atual => !atual); }} aria-pressed={ligada}
        className="flex h-11 w-full items-center justify-center gap-2 rounded border border-black/12 bg-white text-[0.8125rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99]">
        <Camera size={15} aria-hidden="true" /> {ligada ? "Desligar a câmera" : "Ler o QR pela câmera"}
      </button>
      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {ligada && (
        <video ref={video} playsInline muted aria-label="Imagem da câmera para ler o QR da credencial" className="aspect-square w-full rounded border bg-black/[.04] object-cover" style={{ borderColor: "rgba(13,13,13,.1)" }} />
      )}
    </div>
  );
}
