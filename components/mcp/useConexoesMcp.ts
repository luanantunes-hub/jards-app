"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { statusDoAssistente, type Assistente, type ChaveMcp, type StatusConexao } from "@/lib/mcp/conexoes";
import type { Verificacao } from "@/components/mcp/PassosConexao";

/** Enquanto a pessoa configura o assistente em outra aba, a tela confere a conexão a cada 15 s, por até 5 minutos. */
const INTERVALO_MS = 15_000;
const JANELA_ESPERA_MS = 5 * 60_000;
/** Voltar para esta aba também confere, mas nunca mais de uma vez a cada 8 s (a rota aceita 10 pedidos por minuto). */
const INTERVALO_MINIMO_MS = 8_000;

const SEM_CONEXAO: StatusConexao = { conectado: false, ultimaAtividade: null, escrita: false };

/**
 * Carrega as conexões e chaves do Jards e mantém o status de cada assistente em dia: confere ao voltar
 * para a aba e, depois que a pessoa copia ou abre o assistente, de tempos em tempos até a conexão aparecer.
 */
export function useConexoesMcp(assistenteAtivo: Assistente) {
  const [chaves, setChaves] = useState<ChaveMcp[]>([]);
  const [status, setStatus] = useState<Record<Assistente, StatusConexao>>({ claude: SEM_CONEXAO, chatgpt: SEM_CONEXAO });
  const [verificacao, setVerificacao] = useState<Verificacao>("carregando");
  const [aguardando, setAguardando] = useState(false);
  const ultimaBusca = useRef(0);
  const emAndamento = useRef(false);
  const fimDaEspera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    ultimaBusca.current = Date.now();
    try {
      const res = await fetch("/api/mcp/keys", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setVerificacao((atual) => (atual === "ok" ? atual : "erro"));
        return;
      }
      const agora = Date.now();
      const lista = ((data.chaves ?? []) as ChaveMcp[]).map((c) => ({
        ...c,
        expirada: c.expires_at ? new Date(c.expires_at).getTime() <= agora : false,
      }));
      setChaves(lista);
      setStatus({ claude: statusDoAssistente(lista, "claude", agora), chatgpt: statusDoAssistente(lista, "chatgpt", agora) });
      setVerificacao("ok");
    } catch {
      setVerificacao((atual) => (atual === "ok" ? atual : "erro"));
    } finally {
      emAndamento.current = false;
    }
  }, []);

  const conferir = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - ultimaBusca.current < INTERVALO_MINIMO_MS) return;
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void carregar(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [carregar]);

  useEffect(() => {
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("focus", conferir);
    return () => {
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("focus", conferir);
    };
  }, [conferir]);

  const esperando = aguardando && !status[assistenteAtivo].conectado;
  useEffect(() => {
    if (!esperando) return;
    const id = setInterval(conferir, INTERVALO_MS);
    return () => clearInterval(id);
  }, [esperando, conferir]);

  useEffect(
    () => () => {
      if (fimDaEspera.current) clearTimeout(fimDaEspera.current);
    },
    []
  );

  /** A pessoa copiou ou abriu o assistente: a tela passa a esperar a conexão aparecer. */
  const aguardarConexao = useCallback(() => {
    setAguardando(true);
    if (fimDaEspera.current) clearTimeout(fimDaEspera.current);
    fimDaEspera.current = setTimeout(() => setAguardando(false), JANELA_ESPERA_MS);
  }, []);

  return { chaves, status, verificacao, carregar, aguardarConexao };
}
