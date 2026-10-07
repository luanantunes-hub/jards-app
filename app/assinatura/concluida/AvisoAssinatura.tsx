"use client";

import { useEffect } from "react";
import { consentiuMedicao } from "@/lib/origem-cadastro";
import { esperarTagDoGoogle, registrarAssinaturaNoGoogleAds, type CompraVerificada } from "@/lib/conversao-google-ads";

// Com o aceite dos cookies, avisa a assinatura ao Google Ads; depois segue.
export default function AvisoAssinatura({ compra, destino }: { compra: CompraVerificada | null; destino: string }) {
  useEffect(() => {
    (async () => {
      try {
        if (compra && consentiuMedicao() && (await esperarTagDoGoogle())) await registrarAssinaturaNoGoogleAds(compra);
      } finally {
        window.location.replace(destino);
      }
    })();
  }, [compra, destino]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white" aria-busy="true">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#684DB0]/25 border-t-[#684DB0]" aria-hidden="true" />
      <a href={destino} className="text-xs text-black/40 transition hover:text-black/70">
        Assinatura confirmada. Continuar para o Jards
      </a>
    </main>
  );
}
