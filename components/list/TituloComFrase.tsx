"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationName } from "@/contexts/OrganizationContext";
import { escolherFrase } from "@/lib/saudacao";
import { FRASES_DAS_SECOES, ilustracaoDoDia, type SecaoComFrase } from "@/lib/frases-das-secoes";
import { PACOTE_ATIVO, caminhoDaIlustracao } from "@/lib/pacotes-de-ilustracoes";

// A voz das frases editoriais do CRM (painel e seções): Cabinet Grotesk ExtraBold,
// hospedada no próprio projeto. O arquivo contém o peso 800 real, sem síntese do navegador.
const cabinetGrotesk = localFont({
  src: "../../public/assets/fontes/cabinet-grotesk-800.woff2",
  weight: "800",
  style: "normal",
  variable: "--font-frase",
  display: "swap",
});
export const VARIAVEIS_DA_FRASE = cabinetGrotesk.variable;
export const FAMILIA_DA_FRASE = "var(--font-frase), var(--font-google-sans), system-ui, sans-serif";
export const CLASSE_DA_FRASE = "text-[1.625rem] font-extrabold leading-[1.08] tracking-[-.025em] sm:text-[1.875rem]";
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
    <div className={`flex items-center gap-4 ${VARIAVEIS_DA_FRASE}`}>
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

/** A ilustração do dia, do pacote ativo (lib/pacotes-de-ilustracoes.ts, fundo transparente). Decorativa: sem texto alternativo. */
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
      src={caminhoDaIlustracao(PACOTE_ATIVO, numero)}
      alt=""
      aria-hidden="true"
      width={160}
      height={160}
      className={`${tamanho} select-none`}
    />
  );
}
