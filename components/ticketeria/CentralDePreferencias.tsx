"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Moldura } from "@/components/ticketeria/CompraView";
import { SairDasNovidades } from "@/components/ticketeria/SairDasNovidades";
import type { Dias, Frequencia } from "@/lib/ticketeria/envios-controle";

// A central de preferências (o link "Sair da lista" do e-mail de divulgação agora abre aqui): a pessoa escolhe quantos e-mails recebe e sobre o quê, e os dias que dão certo; "Não quero
// receber mais nada" leva à saída de sempre. Só o botão "Salvar" grava (os leitores de e-mail abrem links sozinhos). Textos em messages/<idioma>/ticketeria.json ("sair.preferencias.*").

const BOTAO = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2E8932] px-6 py-3 text-[0.9375rem] font-normal text-white transition hover:bg-[#277A2B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6450D2] disabled:opacity-50";
const OPCAO = "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6450D2]";

export function CentralDePreferencias({ token, loja, limite, inicial }: { token: string; loja: string | null; limite: number; inicial: { frequencia: Frequencia; dias: Dias } }) {
  const t = useTranslations("ticketeria.sair");
  const [frequencia, setFrequencia] = useState<Frequencia>(inicial.frequencia);
  const [dias, setDias] = useState<Dias>(inicial.dias);
  const [estado, setEstado] = useState<"escolhendo" | "salvando" | "salvo" | "erro" | "sair">("escolhendo");
  async function salvar() {
    setEstado("salvando");
    try {
      const r = await fetch("/api/ticketeria/novidades/preferencias", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, frequencia, dias }) });
      setEstado(r.ok ? "salvo" : "erro");
    } catch {
      setEstado("erro");
    }
  }
  if (estado === "sair") return <SairDasNovidades token={token} loja={loja} />;
  const titulo = loja ?? t("novidades.organizador");
  if (estado === "salvo") {
    return (
      <Moldura titulo={titulo} seletorDeIdioma>
        <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">{t("preferencias.salvo")}</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">{t("preferencias.salvoExplicacao")}</p>
      </Moldura>
    );
  }
  const opcoes: [Frequencia, string, string][] = [["tudo", t("preferencias.tudo"), t("preferencias.tudoDetalhe", { limite })], ["menos", t("preferencias.menos"), t("preferencias.menosDetalhe")], ["parecidos", t("preferencias.parecidos"), t("preferencias.parecidosDetalhe")]];
  const listaDeDias: [Dias, string][] = [["qualquer", t("preferencias.qualquer")], ["fim_de_semana", t("preferencias.fimDeSemana")], ["semana", t("preferencias.semana")]];
  return (
    <Moldura titulo={titulo} seletorDeIdioma>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">{loja ? t("preferencias.titulo", { loja }) : t("preferencias.tituloSemLoja")}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">{t("preferencias.explicacao")}</p>
      <div className="mt-5 space-y-2" role="radiogroup" aria-label={loja ? t("preferencias.titulo", { loja }) : t("preferencias.tituloSemLoja")}>
        {opcoes.map(([id, rotulo, detalhe]) => (
          <button key={id} type="button" role="radio" aria-checked={frequencia === id} onClick={() => setFrequencia(id)} className={`${OPCAO} ${frequencia === id ? "border-[#6450D2] bg-[#F5F2FB]" : "border-black/[.1] bg-white hover:bg-black/[.02]"}`}>
            <span aria-hidden="true" className={`mt-0.5 size-4 shrink-0 rounded-full ${frequencia === id ? "border-[5px] border-[#6450D2]" : "border-[1.5px] border-black/30"}`} />
            <span><span className="block text-[0.9375rem] text-[#282525]">{rotulo}</span><span className="mt-0.5 block text-[0.8125rem] text-black/55">{detalhe}</span></span>
          </button>
        ))}
      </div>
      <p className="mt-5 text-[0.75rem] uppercase tracking-[.08em] text-black/45">{t("preferencias.dias")}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("preferencias.dias")}>
        {listaDeDias.map(([id, rotulo]) => (
          <button key={id} type="button" role="radio" aria-checked={dias === id} onClick={() => setDias(id)} className={`rounded-xl border px-3.5 py-2 text-[0.875rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6450D2] ${dias === id ? "border-[#6450D2] bg-[#F5F2FB] text-[#1C0E33]" : "border-black/[.1] bg-white text-black/65 hover:bg-black/[.02]"}`}>{rotulo}</button>
        ))}
      </div>
      {estado === "erro" && <p role="alert" className="mt-4 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{t("preferencias.erro")}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={() => setEstado("sair")} className="text-[0.875rem] text-black/45 underline-offset-2 transition hover:text-black/65 hover:underline focus-visible:outline-2 focus-visible:outline-[#6450D2]">{t("preferencias.sairDeTudo")}</button>
        <button type="button" className={BOTAO} disabled={estado === "salvando"} onClick={() => void salvar()}>{estado === "salvando" ? t("preferencias.salvando") : t("preferencias.salvar")}</button>
      </div>
    </Moldura>
  );
}
