"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortaView, type ResultadoDaConferencia } from "@/components/ticketeria/PortaView";
import type { IngressoAchado } from "@/components/ticketeria/PortaExtrasView";
import { useLeitorDeQr } from "@/components/ticketeria/useLeitorDeQr";
import { normalizarCodigo, resultadoDaBusca, type ResumoDaEquipe } from "@/lib/ticketeria/porta";

// A porta da equipe, pelo link (sem login): ler o QR Code, digitar o código e buscar pelo nome, só na sessão do link. Não vê relatório nem vendas e não desfaz entrada.

type Estado = { tipo: "carregando" } | { tipo: "invalido" } | { tipo: "falha" } | { tipo: "pronto"; dados: ResumoDaEquipe };

export function PortaDaEquipe({ token }: { token: string }) {
  const base = `/api/ticketeria/porta-equipe/${token}`;
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<ResultadoDaConferencia | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<IngressoAchado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const conferindoAgora = useRef(false);

  const atualizar = useCallback(async () => {
    try {
      const r = await fetch(base, { cache: "no-store" });
      if (r.status === 404) { setEstado({ tipo: "invalido" }); return; }
      if (!r.ok) { setEstado(atual => (atual.tipo === "pronto" ? atual : { tipo: "falha" })); return; }
      setEstado({ tipo: "pronto", dados: (await r.json()) as ResumoDaEquipe });
    } catch {
      setEstado(atual => (atual.tipo === "pronto" ? atual : { tipo: "falha" }));
    }
  }, [base]);
  useEffect(() => { queueMicrotask(() => void atualizar()); }, [atualizar]);

  const buscar = useCallback(async (texto: string) => {
    if (texto.trim().length < 2) { setAchados(null); setBuscando(false); return; }
    try {
      const r = await fetch(`${base}/buscar?q=${encodeURIComponent(texto.trim())}`, { cache: "no-store" });
      if (r.status === 404) { setEstado({ tipo: "invalido" }); return; }
      const achado = r.ok ? resultadoDaBusca(await r.json().catch(() => null)) : null;
      setAchados(achado ? achado.achados : null);
      if (!achado) setErro("Não foi possível buscar agora. Tente de novo.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setBuscando(false);
    }
  }, [base]);

  useEffect(() => {
    if (termo.trim().length < 2) { queueMicrotask(() => { setAchados(null); setBuscando(false); }); return; }
    queueMicrotask(() => setBuscando(true));
    const espera = setTimeout(() => void buscar(termo), 350);
    return () => clearTimeout(espera);
  }, [termo, buscar]);

  const conferir = useCallback(async (bruto: string) => {
    const limpo = normalizarCodigo(bruto);
    if (limpo === "" || conferindoAgora.current) return;
    conferindoAgora.current = true;
    setConferindo(true);
    setErro(null);
    try {
      const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo: limpo }) });
      if (r.status === 404) { setEstado({ tipo: "invalido" }); return; }
      const d = (await r.json().catch(() => ({}))) as ResultadoDaConferencia & { error?: string };
      if (!r.ok || !("tipo" in d)) { setErro("Não foi possível conferir agora. Tente de novo."); return; }
      setResultado(d);
      setCodigo("");
      try { navigator.vibrate?.(d.tipo === "pode_entrar" ? 80 : [120, 60, 120]); } catch { /* sem vibração */ }
      void atualizar();
      if (termo.trim().length >= 2) void buscar(termo);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      conferindoAgora.current = false;
      setConferindo(false);
    }
  }, [base, atualizar, buscar, termo]);

  const { video, lendo, semCamera, erro: erroDoLeitor, alternar } = useLeitorDeQr(useCallback((valor: string) => { setResultado(null); void conferir(valor); }, [conferir]));

  if (estado.tipo === "carregando") return <p role="status" className="px-4 py-10 text-center text-[0.9375rem] text-black/55">Abrindo a porta…</p>;
  if (estado.tipo === "invalido") {
    return (
      <div className="mx-auto max-w-[34rem] px-4 py-12 text-center">
        <h1 className="text-[1.5rem] font-medium tracking-[-.025em] text-[#282525]">Este link não vale mais</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">Ele foi desligado, venceu ou a sessão foi cancelada. Peça um novo link a quem organiza o evento.</p>
      </div>
    );
  }
  if (estado.tipo === "falha") {
    return (
      <div className="mx-auto max-w-[34rem] px-4 py-12 text-center">
        <h1 className="text-[1.5rem] font-medium tracking-[-.025em] text-[#282525]">Não foi possível abrir a porta</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">Confira a internet e tente de novo.</p>
        <button type="button" onClick={() => { setEstado({ tipo: "carregando" }); void atualizar(); }} className="mt-5 h-11 rounded-xl border border-black/15 bg-white px-5 text-[0.875rem] text-[#282525] hover:bg-black/[.04]">Tentar de novo</button>
      </div>
    );
  }
  const { dados } = estado;
  const rotulo = [dados.evento, dados.quando].filter(Boolean).join(" · ");
  return (
    <div className="px-4 py-5">
      <p className="mx-auto mb-4 max-w-[34rem] text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-[#684DB0]">Porta{dados.link ? ` · ${dados.link}` : ""}</p>
      {(erro || erroDoLeitor) && <p role="alert" className="mx-auto mb-4 max-w-[34rem] rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro ?? erroDoLeitor}</p>}
      <PortaView
        sessoes={[{ id: "sessao", rotulo }]} sessaoId="sessao"
        entraram={dados.resumo.entraram} lugares={dados.resumo.validos} recentes={dados.resumo.recentes}
        codigo={codigo} onCodigo={setCodigo} onConferir={() => void conferir(codigo)} onLerQr={() => { setResultado(null); void alternar(); }} lendo={lendo} conferindo={conferindo} semCamera={semCamera}
        resultado={resultado} onProximo={() => setResultado(null)}
        busca={{ termo, resultados: achados, buscando }} onBusca={setTermo} onDarEntrada={c => void conferir(c)}
        previa={lendo ? <video ref={video} muted playsInline className="mb-3 aspect-video w-full rounded-xl border border-black/10 bg-[#1C0E33] object-cover" aria-label="Câmera lendo o QR Code" /> : undefined}
      />
    </div>
  );
}
