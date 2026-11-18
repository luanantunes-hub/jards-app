"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { saudacaoDoPainel } from "@/lib/saudacao";
import { CLASSE_DA_FRASE, FAMILIA_DA_FRASE, fonteDaFrase } from "@/components/list/TituloComFrase";

// A saudação usa a mesma voz das frases das seções (TituloComFrase): mesma fonte, tamanho e peso.
const FONTE_FRASE = `block ${CLASSE_DA_FRASE}`;

/** Título do painel: uma saudação que muda com a hora e o dia (o símbolo já está no menu). */
export function SaudacaoPainel() {
  const organizacao = useOrganizationName();
  const [frase, setFrase] = useState<string | null>(null);
  const [esperouOrganizacao, setEsperouOrganizacao] = useState(false);

  // O nome da organização chega depois da página. Montar a frase antes dele
  // e refazê-la quando chega trocava o texto na cara da pessoa; então a
  // frase só é montada quando a organização está pronta (ou após 2 s, para
  // contas sem nome) e depois disso não muda mais.
  useEffect(() => {
    const t = setTimeout(() => setEsperouOrganizacao(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // A hora é a do navegador, então a frase só é montada depois de carregar
  // (no servidor ela sairia com outro horário).
  useEffect(() => {
    if (frase !== null || (!organizacao && !esperouOrganizacao)) return;
    let ativo = true;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!ativo) return;
      const nome = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
      setFrase(saudacaoDoPainel({ nome, organizacao, agora: new Date(), semente: user?.id }));
    });
    return () => { ativo = false; };
  }, [organizacao, esperouOrganizacao, frase]);

  return <TituloSaudacao frase={frase} />;
}

// "follow-up" e "sexta-feira" não se partem no fim da linha: o word joiner
// (U+2060), invisível, tira a quebra depois do hífen.
function semQuebraNoHifen(frase: string) {
  return frase.replace(/-/g, "-\u2060");
}

export function TituloSaudacao({ frase }: { frase: string | null }) {
  return (
    <h1 className={`mt-1.5 max-w-[42rem] text-[#282525] ${fonteDaFrase.variable}`}>
      {frase
        ? <span className={`saudacao-painel text-balance ${FONTE_FRASE}`} style={{ fontFamily: FAMILIA_DA_FRASE }}>{semQuebraNoHifen(frase)}</span>
        : <span className={`invisible ${FONTE_FRASE}`} style={{ fontFamily: FAMILIA_DA_FRASE }} aria-hidden="true">Café pronto</span>}
      {!frase && <span className="sr-only">Visão geral</span>}
    </h1>
  );
}
