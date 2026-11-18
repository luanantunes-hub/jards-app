"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Fraunces } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { escolherFrase } from "@/lib/saudacao";
import { FRASES_DAS_SECOES, ilustracaoDoDia, type SecaoComFrase } from "@/lib/frases-das-secoes";

// Teste da GT Super Display: o site não carrega o arquivo da fonte (a versão é de avaliação);
// usa a fonte instalada no computador de quem abre. Sem ela instalada, vale a Fraunces em negrito.
// O painel (SaudacaoPainel) usa as mesmas três constantes: uma voz só para todas as frases.
export const fonteDaFrase = Fraunces({ subsets: ["latin"], weight: ["700"], variable: "--font-frase-secao" });
export const FAMILIA_DA_FRASE = '"GT Super Ds Trial", "GT Super Display", var(--font-frase-secao), Georgia, serif';
export const CLASSE_DA_FRASE = "text-[1.625rem] font-bold leading-[1.08] tracking-[-.02em] sm:text-[1.875rem]";
const fraunces = fonteDaFrase;
const FAMILIA = FAMILIA_DA_FRASE;
const FONTE_FRASE = CLASSE_DA_FRASE;

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
    <div className={`flex items-center gap-4 ${fraunces.variable}`}>
      <IlustracaoDaSecao arquivo={secao} />
      <div className="min-w-0">
        <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/30">{titulo}</p>
        <h1 className="mt-1.5 max-w-[42rem] text-[#282525]">
          <span className="sr-only">{titulo}. </span>
          {frase
            ? <span className={`saudacao-painel block text-balance ${FONTE_FRASE}`} style={{ fontFamily: FAMILIA }}>{frase.replace(/-/g, "-⁠")}</span>
            : <span className={`invisible block ${FONTE_FRASE}`} style={{ fontFamily: FAMILIA }} aria-hidden="true">{frase === "" ? titulo : "Carregando"}</span>}
        </h1>
      </div>
    </div>
  );
}

/** O tamanduá do dia (public/ilustracoes/tamandua, fundo transparente). Decorativa: sem texto alternativo. */
export function IlustracaoDaSecao({ arquivo }: { arquivo: SecaoComFrase | "painel" }) {
  // A data é a do navegador; escolher depois de montar evita diferença entre servidor e navegador.
  const [numero, setNumero] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNumero(ilustracaoDoDia(arquivo, new Date()));
  }, [arquivo]);
  const tamanho = "h-[4.25rem] w-[4.25rem] shrink-0 sm:h-[5rem] sm:w-[5rem]";
  if (numero === null) return <span aria-hidden="true" className={tamanho} />;
  return (
    <Image
      src={`/ilustracoes/tamandua/${String(numero).padStart(2, "0")}.png`}
      alt=""
      aria-hidden="true"
      width={160}
      height={160}
      className={`${tamanho} select-none`}
    />
  );
}
