"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { destinoInterno } from "@/lib/destino-interno";
import { consentiuMedicao } from "@/lib/origem-cadastro";
import { esperarTagDoGoogle, registrarCadastroNoGoogleAds } from "@/lib/conversao-google-ads";

// Passagem de quem acabou de criar a conta com o Google: a tag só existe fora
// da plataforma, então o cadastro é avisado ao Google Ads aqui, com o aceite
// dos cookies, e a pessoa segue para o destino.
export default function CadastroConcluidoPage() {
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    const destino = destinoInterno(next, "/dashboard?onboarding=1");

    (async () => {
      try {
        if (!consentiuMedicao()) return;
        const { data: { user } } = await createClient().auth.getUser();
        if (user?.email && (await esperarTagDoGoogle())) await registrarCadastroNoGoogleAds(user.email);
      } finally {
        window.location.replace(destino);
      }
    })();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white" aria-busy="true">
      <span className="sr-only">Preparando seu workspace</span>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#684DB0]/25 border-t-[#684DB0]" aria-hidden="true" />
    </main>
  );
}
