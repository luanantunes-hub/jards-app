"use client";

import { useEffect, useState } from "react";
import { Fraunces } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { escolherFrase } from "@/lib/saudacao";
import { FRASES_DAS_SECOES, type SecaoComFrase } from "@/lib/frases-das-secoes";

// Teste da GT Super Display: o site não carrega o arquivo da fonte (a versão é de avaliação);
// usa a fonte instalada no computador de quem abre. Sem ela instalada, vale a Fraunces em negrito.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["700"], variable: "--font-frase-secao" });
const FAMILIA = '"GT Super Ds Trial", "GT Super Display", var(--font-frase-secao), Georgia, serif';
const FONTE_FRASE = "text-[1.625rem] font-bold leading-[1.08] tracking-[-.02em] sm:text-[1.875rem]";

/**
 * Topo da seção no estilo do painel: o nome da seção vira a etiqueta pequena e a frase do dia
 * ocupa o lugar do título. Para leitores de tela, o título continua sendo o nome da seção.
 */
export function TituloComFrase({ secao, titulo }: { secao: SecaoComFrase; titulo: string }) {
  const organizacao = useOrganizationName();
  const [frase, setFrase] = useState<string | null>(null);
  const [esperouOrganizacao, setEsperouOrganizacao] = useState(false);

  // Mesmo cuidado do painel: a frase só é montada quando o nome da organização chega (ou após 2 s),
  // para o texto não trocar na frente da pessoa.
  useEffect(() => {
    const t = setTimeout(() => setEsperouOrganizacao(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (frase !== null || (!organizacao && !esperouOrganizacao)) return;
    let ativo = true;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!ativo) return;
      const nome = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
      setFrase(escolherFrase([...FRASES_DAS_SECOES[secao]], { nome, organizacao, agora: new Date(), semente: user?.id }, secao) ?? "");
    });
    return () => { ativo = false; };
  }, [organizacao, esperouOrganizacao, frase, secao]);

  return (
    <div className={fraunces.variable}>
      <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/30">{titulo}</p>
      <h1 className="mt-1.5 max-w-[42rem] text-[#282525]">
        <span className="sr-only">{titulo}. </span>
        {frase
          ? <span className={`saudacao-painel block text-balance ${FONTE_FRASE}`} style={{ fontFamily: FAMILIA }}>{frase.replace(/-/g, "-⁠")}</span>
          : <span className={`invisible block ${FONTE_FRASE}`} style={{ fontFamily: FAMILIA }} aria-hidden="true">{frase === "" ? titulo : "Carregando"}</span>}
      </h1>
    </div>
  );
}
