"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Moldura } from "@/components/ticketeria/CompraView";

// A página do link "Sair da lista" do e-mail de divulgação: um botão que registra a saída (só o botão grava: os leitores de e-mail abrem links sozinhos).
// `loja` é o nome do organizador; sem nome, o texto fala "do organizador". Textos em messages/<idioma>/ticketeria.json ("sair.novidades.*" e "sair.*").

const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#282525] px-5 py-3 text-[0.9375rem] font-normal text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

export function SairDasNovidades({ token, loja }: { token: string; loja: string | null }) {
  const t = useTranslations("ticketeria.sair");
  const [estado, setEstado] = useState<"pergunta" | "saindo" | "saiu" | "erro">("pergunta");
  async function sair() {
    setEstado("saindo");
    try {
      const r = await fetch("/api/ticketeria/novidades/sair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const d = (await r.json().catch(() => ({}))) as { saiu?: boolean };
      setEstado(r.ok && d.saiu === true ? "saiu" : "erro");
    } catch {
      setEstado("erro");
    }
  }
  const titulo = loja ?? t("novidades.organizador");
  if (estado === "saiu") {
    return (
      <Moldura titulo={titulo} seletorDeIdioma>
        <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">{t("feito")}</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">{loja ? t("novidades.feitoExplicacao", { loja }) : t("novidades.feitoExplicacaoSemLoja")}</p>
      </Moldura>
    );
  }
  return (
    <Moldura titulo={titulo} seletorDeIdioma>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">{t("novidades.pergunta")}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">{loja ? t("novidades.explicacao", { loja }) : t("novidades.explicacaoSemLoja")}</p>
      {estado === "erro" && <p role="alert" className="mt-4 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{t("erro")}</p>}
      <button type="button" className={`${BOTAO} mt-6`} disabled={estado === "saindo"} onClick={() => void sair()}>{estado === "saindo" ? t("saindo") : t("botao")}</button>
    </Moldura>
  );
}
