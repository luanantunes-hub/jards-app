"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Video } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";

type Proxima = { provider: "google" | "microsoft"; eventoId: string; titulo: string; inicio: string; plataforma: string | null; entra: boolean; motivo: string; ignorada: boolean };
type Estado = { ativo: boolean; contas: Array<{ provider: string; email: string | null }>; ultimaLeitura: string | null; erroDaLeitura: string | null; proximas: Proxima[]; errosDaAgenda: string[] };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Cartão de Configurações: o robô de Reuniões entra sozinho nas reuniões da agenda que têm convidado de fora da instituição. Começa desligado.
export function ReunioesPeloCalendario() {
  const organizationId = useOrganizationId();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao(atual => atual + 1), []);

  useEffect(() => {
    if (!organizationId) return;
    let vivo = true;
    fetch(`/api/reunioes/calendario?organization_id=${organizationId}`, { cache: "no-store" })
      .then(resposta => (resposta.ok ? resposta.json() as Promise<Estado> : null))
      .then(dados => { if (vivo && dados) setEstado(dados); })
      .catch(() => { /* a tela segue sem o cartão se a leitura falhar */ });
    return () => { vivo = false; };
  }, [organizationId, versao]);

  if (!organizationId || !estado) return null;

  const alternar = async () => {
    setSalvando(true); setErro(null);
    try {
      const resposta = await fetch("/api/reunioes/calendario", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: organizationId, ativo: !estado.ativo }) });
      const corpo = await resposta.json().catch(() => ({})) as { error?: string };
      if (!resposta.ok) throw new Error(corpo.error || "Não foi possível salvar.");
      await carregar();
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Não foi possível salvar."); }
    finally { setSalvando(false); }
  };

  const marcar = async (item: Proxima, voltar: boolean) => {
    setErro(null);
    const resposta = await fetch("/api/reunioes/calendario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: organizationId, provider: item.provider, eventoId: item.eventoId, inicio: item.inicio, titulo: item.titulo, voltar }) });
    if (!resposta.ok) setErro("Não foi possível salvar.");
    await carregar();
  };

  const semConta = estado.contas.length === 0;
  const cobertas = estado.proximas.filter(item => item.entra);
  const demais = estado.proximas.filter(item => !item.entra);

  return (
    <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-black/40" aria-hidden />
            <h3 className="text-[0.8125rem] font-semibold text-[#282525]">Robô nas reuniões da agenda</h3>
          </div>
          <p className="mt-1 max-w-[38rem] text-[0.75rem] leading-relaxed text-black/55">
            Quando uma reunião do Meet ou do Teams tem pelo menos um convidado de fora da sua instituição, o robô entra sozinho na hora, grava e transcreve. Reunião só com gente de dentro fica de fora, para não gastar horas à toa.
          </p>
          {semConta && <p className="mt-2 text-[0.75rem] text-black/55">Conecte o Google Agenda ou o Outlook acima para liberar.</p>}
        </div>
        <button
          type="button" role="switch" aria-checked={estado.ativo} aria-label="Ligar o robô nas reuniões da agenda"
          disabled={salvando || (semConta && !estado.ativo)} onClick={() => void alternar()}
          className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#684DB0] disabled:cursor-not-allowed disabled:opacity-40 ${estado.ativo ? "bg-[#1C0E33]" : "bg-black/20"}`}
        >
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${estado.ativo ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {erro && <p className="mx-6 mb-3 rounded border bg-white px-3 py-2 text-[0.75rem]" style={{ borderColor: "#D94A4A59", color: "#D94A4A" }}>{erro}</p>}
      {estado.ativo && estado.erroDaLeitura && <p className="mx-6 mb-3 text-[0.75rem] text-black/55">Última leitura da agenda: {estado.erroDaLeitura}</p>}

      {!semConta && (
        <div className="border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Próximos 7 dias</p>
          {estado.errosDaAgenda.length > 0 && <p className="mt-2 text-[0.75rem] text-black/55">{estado.errosDaAgenda.join(" · ")}</p>}
          {estado.proximas.length === 0 && estado.errosDaAgenda.length === 0 && <p className="mt-2 text-[0.75rem] text-black/45">Nenhuma reunião com link do Meet ou do Teams nos próximos dias.</p>}
          <ul className="mt-2 divide-y divide-black/[.06]">
            {[...cobertas, ...demais].map(item => (
              <li key={`${item.provider}-${item.eventoId}-${item.inicio}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={`truncate text-[0.8125rem] ${item.entra && !item.ignorada ? "font-medium text-[#282525]" : "text-black/45"}`}>
                    <Video size={12} className="mr-1.5 inline text-black/40" aria-hidden />{item.titulo}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-black/45">{quando(item.inicio)} · {item.ignorada ? "você pediu para o robô não entrar" : item.entra ? `robô entra: ${item.motivo}` : `robô não entra: ${item.motivo}`}</p>
                </div>
                {item.entra && (
                  <button type="button" onClick={() => void marcar(item, item.ignorada)} className="flex-shrink-0 rounded px-2 py-1.5 text-[0.6875rem] text-black/45 transition-colors hover:bg-black/[.04] hover:text-[#282525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#684DB0]">
                    {item.ignorada ? "Voltar a cobrir" : "Não entrar nesta"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
