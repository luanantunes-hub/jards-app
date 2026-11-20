"use client";

import { useEffect, useMemo, useState } from "react";
import { relogio, telaDoPalco } from "@/lib/producao/palco-ao-vivo";
import { diaEMes } from "@/lib/producao/agenda";
import { textoDoAtraso } from "@/lib/producao/ao-vivo";
import type { DadosDoPalco } from "@/lib/producao/palco-publico";

const INTERVALO_DA_LEITURA_MS = 10_000;
const AMBAR = "#E0A33A";
const CORAL = "#EE6A6A";

const horaLocal = (instante: Date, fuso: string) => instante.toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" });
const horaComSegundos = (instante: Date, fuso: string) => instante.toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", second: "2-digit" });

const ROTULO_DO_ESTADO = { pendente: "A seguir", em_andamento: "Agora", concluido: "Feito" } as const;

/**
 * A tela de palco (PD7.1): o bloco em andamento com o tempo que falta, o próximo com o tempo até começar (já com o atraso) e a lista do dia, para o
 * telão ou o celular de quem está no palco. Pergunta ao servidor a cada 10 segundos e refaz a conta a cada segundo com o relógio do servidor; sem
 * internet, continua contando com a última leitura e avisa.
 */
export function PalcoAoVivo({ token, inicial }: { token: string; inicial: DadosDoPalco }) {
  const [palco, setPalco] = useState<DadosDoPalco>(inicial);
  const [agoraMs, setAgoraMs] = useState(() => Date.parse(inicial.agora));
  const [deslocamentoMs, setDeslocamentoMs] = useState(() => Date.parse(inicial.agora) - Date.now());
  const [ultimaLeitura, setUltimaLeitura] = useState(() => Date.parse(inicial.agora));
  const [semConexao, setSemConexao] = useState(false);
  const [fim, setFim] = useState<"revogado" | "expirado" | "inexistente" | null>(null);

  useEffect(() => {
    const relogioDaTela = setInterval(() => setAgoraMs(Date.now() + deslocamentoMs), 1000);
    return () => clearInterval(relogioDaTela);
  }, [deslocamentoMs]);

  useEffect(() => {
    let ativo = true;
    async function ler() {
      try {
        const resposta = await fetch(`/api/palco/${token}`, { cache: "no-store" });
        if (!ativo) return;
        if (resposta.status === 404) { setFim("inexistente"); return; }
        if (resposta.status === 410) { setFim(((await resposta.json()) as { erro?: string }).erro === "revogado" ? "revogado" : "expirado"); return; }
        if (!resposta.ok) throw new Error("indisponivel");
        const { palco: novo } = (await resposta.json()) as { palco: DadosDoPalco };
        if (!ativo) return;
        setPalco(novo);
        setDeslocamentoMs(Date.parse(novo.agora) - Date.now());
        setUltimaLeitura(Date.parse(novo.agora));
        setSemConexao(false);
      } catch {
        if (ativo) setSemConexao(true);
      }
    }
    const repeticao = setInterval(() => void ler(), INTERVALO_DA_LEITURA_MS);
    return () => { ativo = false; clearInterval(repeticao); };
  }, [token]);

  const agora = useMemo(() => new Date(agoraMs), [agoraMs]);
  const tela = useMemo(() => telaDoPalco(palco.blocos, agora, palco.fuso), [palco, agora]);

  if (fim) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#282525] px-6 text-center text-white">
        <div>
          <h1 className="text-[1.5rem] font-semibold">{fim === "revogado" ? "Esta tela foi desativada" : fim === "expirado" ? "Este endereço venceu" : "Tela não encontrada"}</h1>
          <p className="mt-2 text-[1rem] text-white/60">Peça o endereço novo a quem enviou.</p>
        </div>
      </main>
    );
  }

  const { atual, proximo } = tela;
  const estourou = atual?.restanteMs !== null && atual?.restanteMs !== undefined && atual.restanteMs < 0;

  return (
    <main className="flex min-h-screen flex-col bg-[#282525] px-[clamp(1rem,4vw,3rem)] py-[clamp(1rem,3vw,2.5rem)] text-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[0.75rem] font-medium uppercase tracking-[.08em] text-white/60">
          {[palco.organizacao, palco.temporada, diaEMes(palco.dia)].filter(Boolean).join(" · ")}
        </p>
        <p className="text-[clamp(1.25rem,3vw,2rem)] font-semibold tabular-nums" aria-label="Hora de agora">{horaComSegundos(agora, palco.fuso)}</p>
      </header>

      {semConexao && (
        <p role="status" className="mt-3 rounded border px-3 py-2 text-[0.875rem]" style={{ borderColor: `${AMBAR}99`, color: AMBAR }}>
          Sem conexão. A tela segue contando com a última leitura, das {horaLocal(new Date(ultimaLeitura), palco.fuso)}.
        </p>
      )}

      <section className="mt-[clamp(1.5rem,5vw,3.5rem)]" aria-live="polite">
        {atual ? (
          <>
            <p className="text-[0.875rem] font-medium uppercase tracking-[.08em] text-white/60">Em andamento</p>
            <h1 className="mt-2 text-[clamp(2rem,7vw,5.5rem)] font-semibold leading-[1.05] tracking-[-.02em] [text-wrap:balance]">{atual.titulo}</h1>
            {atual.restanteMs !== null ? (
              <p className="mt-4 text-[clamp(3rem,13vw,10rem)] font-semibold leading-none tabular-nums" style={{ color: estourou ? CORAL : "#fff" }}>
                {estourou ? "−" : ""}{relogio(atual.restanteMs)}
              </p>
            ) : (
              <p className="mt-4 text-[clamp(1.5rem,5vw,3rem)] tabular-nums text-white/80">Começou às {horaLocal(new Date(atual.iniciadoEm), palco.fuso)}</p>
            )}
            <p className="mt-2 text-[1rem] text-white/60">
              {atual.restanteMs !== null
                ? (estourou ? "passou do tempo previsto" : "para acabar") + ` · começou às ${horaLocal(new Date(atual.iniciadoEm), palco.fuso)}${atual.fimPrevisto ? ` · previsto até ${horaLocal(new Date(atual.fimPrevisto), palco.fuso)}` : ""}`
                : "sem hora de fim marcada"}
            </p>
          </>
        ) : tela.encerrado ? (
          <h1 className="text-[clamp(2rem,7vw,5rem)] font-semibold leading-[1.05]">Dia encerrado</h1>
        ) : proximo ? (
          <>
            <p className="text-[0.875rem] font-medium uppercase tracking-[.08em] text-white/60">Ainda não começou</p>
            <h1 className="mt-2 text-[clamp(2rem,7vw,5.5rem)] font-semibold leading-[1.05] tracking-[-.02em] [text-wrap:balance]">{proximo.titulo}</h1>
          </>
        ) : (
          <h1 className="text-[clamp(1.5rem,5vw,3rem)] font-semibold text-white/80">Sem blocos com hora marcada</h1>
        )}
      </section>

      {proximo && (
        <section className="mt-[clamp(1.25rem,4vw,3rem)] rounded border border-white/20 px-[clamp(1rem,2.5vw,1.75rem)] py-[clamp(0.75rem,2vw,1.25rem)]" aria-label="A seguir">
          <p className="text-[0.75rem] font-medium uppercase tracking-[.08em] text-white/60">A seguir</p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-[clamp(1.25rem,3.5vw,2.25rem)] font-medium">{proximo.titulo}</p>
            <p className="text-[clamp(1.25rem,3.5vw,2.25rem)] tabular-nums">
              {proximo.faltaMs >= 0 ? `em ${relogio(proximo.faltaMs)}` : `era para ${horaLocal(new Date(proximo.comecaEm), palco.fuso)}`}
              <span className="ml-3 text-[0.875rem] text-white/60">às {horaLocal(new Date(proximo.comecaEm), palco.fuso)}</span>
            </p>
          </div>
          {proximo.atrasoMin > 0 && <p className="mt-1 text-[1rem]" style={{ color: AMBAR }}>Atraso de {proximo.atrasoMin} min já considerado na hora.</p>}
        </section>
      )}

      <section className="mt-[clamp(1.25rem,4vw,3rem)]" aria-label="O dia">
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {tela.lista.map(linha => (
            <li key={linha.id} className={`flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 ${linha.estado === "concluido" ? "text-white/40" : ""}`}>
              <span className="w-[clamp(7rem,16vw,10rem)] shrink-0 text-[1rem] tabular-nums">{linha.hora}</span>
              <span className="min-w-0 flex-1 basis-40 text-[clamp(1rem,2vw,1.375rem)]">{linha.titulo}</span>
              {linha.atrasoMin > 0 && linha.estado === "pendente" && <span className="text-[0.875rem] tabular-nums" style={{ color: AMBAR }}>{textoDoAtraso(linha.atrasoMin)}</span>}
              <span className="rounded border border-white/25 px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-[.08em] text-white/70">{ROTULO_DO_ESTADO[linha.estado]}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
