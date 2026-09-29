"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MagnifyingGlass, User, VideoCamera } from "@phosphor-icons/react";

type Reuniao = {
  id: string;
  titulo: string;
  plataforma: "google_meet" | "teams";
  url_reuniao: string;
  status: "agendada" | "bot_entrando" | "gravando" | "processando" | "concluida" | "falhou";
  erro: string | null;
  resumo_ia: string | null;
  created_at: string;
};

type Transcricao = { id: string; falante: string | null; texto: string; inicio_ms: number; fim_ms: number | null };
type Participante = { id: string; nome: string | null; email: string | null };
type Marcador = { id: string; tipo: "destaque" | "acao"; texto: string; timestamp_ms: number | null };

function formatarTimestamp(ms: number) {
  const totalSegundos = Math.floor(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

export default function ReuniaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [reuniao, setReuniao] = useState<Reuniao | null>(null);
  const [transcricoes, setTranscricoes] = useState<Transcricao[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setLoading(true);
      const res = await fetch(`/api/reunioes/${params.id}`);
      if (!res.ok || !ativo) { setLoading(false); return; }
      const data = await res.json();
      if (!ativo) return;
      setReuniao(data.reuniao);
      setTranscricoes(data.transcricoes ?? []);
      setParticipantes(data.participantes ?? []);
      setMarcadores(data.marcadores ?? []);
      setLoading(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [params.id]);

  const transcricoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return transcricoes;
    return transcricoes.filter(t => t.texto.toLowerCase().includes(termo));
  }, [transcricoes, busca]);

  if (loading) {
    return <div className="px-8 py-8"><div className="h-40 bg-black/[.015] rounded animate-pulse" /></div>;
  }

  if (!reuniao) {
    return (
      <div className="px-8 py-8 text-center text-black/40">
        Reunião não encontrada ou sem permissão pra visualizar.
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <button
        type="button"
        onClick={() => router.push("/reunioes")}
        className="mb-4 flex items-center gap-1.5 text-[12.5px] text-black/45 hover:text-black/70 transition"
      >
        <ArrowLeft size={13} />
        Reuniões
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-bold text-[#0D0D0D] text-[24px]">{reuniao.titulo}</h1>
          <p className="mt-1 text-[13px] text-black/45">
            {reuniao.plataforma === "google_meet" ? "Google Meet" : "Microsoft Teams"} ·{" "}
            {new Date(reuniao.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </div>
        {reuniao.status === "falhou" && reuniao.erro && (
          <span className="rounded border bg-white px-2.5 py-1.5 text-[11px] font-medium" style={{ borderColor: "#D94A4A47", color: "#D94A4A" }}>
            {reuniao.erro}
          </span>
        )}
      </div>

      {reuniao.status !== "concluida" && (
        <div className="mb-6 flex items-center gap-2 rounded border bg-white px-4 py-3 text-[13px] text-black/50" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <VideoCamera size={15} className="text-black/30" />
          {reuniao.status === "bot_entrando" && "O assistente está entrando na reunião…"}
          {reuniao.status === "gravando" && "Reunião em andamento — a transcrição fica disponível depois que terminar."}
          {reuniao.status === "processando" && "Reunião encerrada, processando a transcrição…"}
          {reuniao.status === "agendada" && "Reunião agendada."}
          {reuniao.status === "falhou" && "Não foi possível concluir esta reunião."}
        </div>
      )}

      {reuniao.resumo_ia && (
        <div className="mb-6 rounded border bg-white p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-black/35">Resumo</p>
          <p className="text-[13.5px] leading-relaxed text-black/70 whitespace-pre-wrap">{reuniao.resumo_ia}</p>
        </div>
      )}

      {marcadores.length > 0 && (
        <div className="mb-6 rounded border bg-white p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-black/35">Itens de ação</p>
          <ul className="space-y-2">
            {marcadores.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-[13px] text-black/70">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#684DB0]" />
                <span>
                  {m.texto}
                  {m.timestamp_ms !== null && <span className="ml-2 text-black/30 tabular-nums">{formatarTimestamp(m.timestamp_ms)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {participantes.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {participantes.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded border bg-white px-2.5 py-1.5 text-[12px] text-black/60" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <User size={12} className="text-black/30" />
              {p.nome ?? p.email ?? "Participante"}
            </span>
          ))}
        </div>
      )}

      <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <MagnifyingGlass size={13} className="text-black/30" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na transcrição…"
            className="w-full text-sm text-black placeholder-black/30 focus:outline-none"
          />
        </div>

        {transcricoes.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-black/35">
            {reuniao.status === "concluida" ? "Sem transcrição disponível." : "A transcrição aparece aqui depois que a reunião terminar."}
          </div>
        ) : transcricoesFiltradas.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-black/35">Nada encontrado pra &ldquo;{busca}&rdquo;.</div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(13,13,13,.05)" }}>
            {transcricoesFiltradas.map((t) => (
              <li key={t.id} className="flex gap-4 px-4 py-3">
                <span className="w-12 shrink-0 pt-0.5 text-[11px] tabular-nums text-black/30">{formatarTimestamp(t.inicio_ms)}</span>
                <div className="min-w-0">
                  {t.falante && <p className="mb-0.5 text-[11px] font-semibold text-[#684DB0]">{t.falante}</p>}
                  <p className="text-[13.5px] leading-relaxed text-black/75">{t.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
