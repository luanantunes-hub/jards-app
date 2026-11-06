"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { saudacaoDoPainel } from "@/lib/saudacao";

/** Título do painel: o símbolo do Jards e uma saudação que muda com a hora e o dia. */
export function SaudacaoPainel() {
  const organizacao = useOrganizationName();
  const [frase, setFrase] = useState<string | null>(null);

  // A hora é a do navegador, então a frase só é montada depois de carregar
  // (no servidor ela sairia com outro horário).
  useEffect(() => {
    let ativo = true;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!ativo) return;
      const nome = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
      setFrase(saudacaoDoPainel({ nome, organizacao, agora: new Date(), semente: user?.id }));
    });
    return () => { ativo = false; };
  }, [organizacao]);

  return <TituloSaudacao frase={frase} />;
}

export function TituloSaudacao({ frase }: { frase: string | null }) {
  return (
    <h1 className="mt-1 flex items-start gap-[0.625rem] text-[1.75rem] font-bold leading-tight tracking-[-.025em] text-[#282525]">
      <img src="/jards-icon.svg" alt="" aria-hidden="true" className="mt-[0.22rem] h-[1.75rem] w-[1.75rem] shrink-0" />
      {frase
        ? <span className="saudacao-painel text-balance">{frase}</span>
        : <span className="invisible" aria-hidden="true">Bom dia</span>}
      {!frase && <span className="sr-only">Visão geral</span>}
    </h1>
  );
}
