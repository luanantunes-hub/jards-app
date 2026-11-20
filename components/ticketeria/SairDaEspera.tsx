"use client";

import { useState } from "react";
import { Moldura } from "@/components/ticketeria/CompraView";

// A página do link "sair da lista" do e-mail de aviso: um botão que apaga a pessoa da lista (só o botão apaga: os leitores de e-mail abrem links sozinhos).

const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#282525] px-5 py-3 text-[0.9375rem] font-normal text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] disabled:cursor-not-allowed disabled:bg-black/20";

export function SairDaEspera({ token }: { token: string }) {
  const [estado, setEstado] = useState<"pergunta" | "saindo" | "saiu" | "erro">("pergunta");
  async function sair() {
    setEstado("saindo");
    try {
      const r = await fetch("/api/ticketeria/compra/espera/sair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      setEstado(r.ok ? "saiu" : "erro");
    } catch {
      setEstado("erro");
    }
  }
  if (estado === "saiu") {
    return (
      <Moldura titulo="Lista de espera">
        <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Pronto, você saiu da lista</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">Não vamos mais avisar você sobre esse ingresso.</p>
      </Moldura>
    );
  }
  return (
    <Moldura titulo="Lista de espera">
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Sair da lista de espera?</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">Você deixa de receber o aviso quando voltarem ingressos. Se mudar de ideia, é só entrar na lista de novo.</p>
      {estado === "erro" && <p role="alert" className="mt-4 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>Não foi possível sair agora. Tente de novo em instantes.</p>}
      <button type="button" className={`${BOTAO} mt-6`} disabled={estado === "saindo"} onClick={() => void sair()}>{estado === "saindo" ? "Saindo…" : "Sair da lista"}</button>
    </Moldura>
  );
}
