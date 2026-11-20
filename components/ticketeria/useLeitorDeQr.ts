"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// O leitor de QR Code do navegador (BarcodeDetector: Chrome no Android e em parte dos computadores), para a porta da equipe. Sem ele, só o código digitado.
// (A tela da Porta de quem edita tem o mesmo código escrito dentro dela; a troca por este gancho fica para quando a Porta puder ser testada com a câmera.)

type Detector = { detect(imagem: CanvasImageSource): Promise<{ rawValue: string }[]> };
const criarDetector = (): Detector | null => {
  const Classe = (globalThis as unknown as { BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector }).BarcodeDetector;
  return Classe ? new Classe({ formats: ["qr_code"] }) : null;
};

/** Lê um QR Code pela câmera e chama `aoLer` com o texto lido (a câmera se desliga sozinha). `video` vai no elemento <video> da prévia. */
export function useLeitorDeQr(aoLer: (valor: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const [lendo, setLendo] = useState(false);
  const [semCamera, setSemCamera] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSemCamera(!(typeof navigator !== "undefined" && Boolean(navigator.mediaDevices) && criarDetector() !== null)));
  }, []);

  const parar = useCallback(() => {
    fluxo.current?.getTracks().forEach(t => t.stop());
    fluxo.current = null;
    setLendo(false);
  }, []);
  useEffect(() => parar, [parar]);

  const alternar = useCallback(async () => {
    if (lendo) { parar(); return; }
    const detector = criarDetector();
    if (!detector) { setSemCamera(true); return; }
    setErro(null);
    try {
      const f = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      fluxo.current = f;
      setLendo(true);
      await new Promise(resolver => setTimeout(resolver, 50));
      const el = video.current;
      if (el) { el.srcObject = f; await el.play().catch(() => undefined); }
      const volta = setInterval(async () => {
        if (!fluxo.current || !video.current || video.current.readyState < 2) return;
        try {
          const achados = await detector.detect(video.current);
          if (achados.length > 0) { clearInterval(volta); parar(); aoLer(achados[0].rawValue); }
        } catch { /* quadro sem QR: tenta no próximo */ }
      }, 250);
      f.getTracks()[0].addEventListener("ended", () => clearInterval(volta));
    } catch {
      setErro("Não foi possível abrir a câmera. Permita o acesso ou digite o código.");
      setLendo(false);
    }
  }, [lendo, parar, aoLer]);

  return { video, lendo, semCamera, erro, alternar };
}
