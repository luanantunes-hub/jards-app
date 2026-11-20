"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Mail, Phone, Users, Calendar, MoreHorizontal,
  Clock, CheckCircle2, Circle, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TIPO_ICONS: Record<string, React.ElementType> = {
  email: Mail, telefone: Phone, linkedin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  reuniao: Users, evento: Calendar, outro: MoreHorizontal,
  mudanca: () => <CheckCircle2 size={13} />,
  nota: () => <AlertCircle size={13} />,
  inscricao: () => <CheckCircle2 size={13} />,
};

const STATUS_LABEL: Record<string, string> = {
  prospeccao: "Prospecção", primeiro_contato: "1º Contato",
  proposta_enviada: "Proposta enviada", em_negociacao: "Em negociação",
  aprovado: "Aprovado", recusado: "Recusado", renovacao: "Renovação",
};

const EDITAL_STATUS_LABEL: Record<string, string> = {
  interesse: "Interesse", inscrito: "Inscrito", em_analise: "Em análise",
  aprovado: "Aprovado", reprovado: "Reprovado", cancelado: "Cancelado",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRelative(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD < 7) return `${diffD}d atrás`;
  return formatDate(dateStr);
}

type TimelineEvent = {
  tipo: "atividade" | "nota" | "mudanca" | "inscricao" | "interacao";
  atividade_tipo: string;
  titulo: string;
  descricao: string | null;
  data: string;
  usuario: string | null;
  created_at: string;
  captacao_titulo?: string | null;
};

function EventIcon({ tipo }: { tipo: string }) {
  const Icon = TIPO_ICONS[tipo] || MoreHorizontal;
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-black/[.08] bg-white text-black/45">
      <Icon size={13} />
    </div>
  );
}

export function CompanyTimeline({
  empresaCrmId,
  sources = ["atividades", "notas", "historico_captações", "inscricoes", "interacoes"],
  showHeader = true,
  embedded = false,
}: {
  empresaCrmId: string;
  sources?: string[];
  showHeader?: boolean;
  embedded?: boolean;
}) {
  const supabase = createClient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises: Promise<{ data: any }>[] = [];

    if (sources.includes("atividades")) {
      promises.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase
          .from("atividades")
          .select("id, nome, tipo, data_realizada, nota, created_at, responsavel:profiles!responsavel_id(full_name), contato:contatos!contato_id(nome), captacao:captacoes!captacao_id(titulo)")
          .eq("empresa_crm_id", empresaCrmId)
          .order("created_at", { ascending: false })
          .limit(50) as any
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (sources.includes("notas")) {
      promises.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase
          .from("notas")
          .select("id, titulo, conteudo, created_at, account_id")
          .eq("empresa_crm_id", empresaCrmId)
          .order("created_at", { ascending: false })
          .limit(30) as any
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (sources.includes("historico_captações")) {
      // historico_captações doesn't have empresa_crm_id — fetch via captacao IDs
      const { data: caps } = await supabase
        .from("captacoes")
        .select("id")
        .eq("empresa_crm_id", empresaCrmId);
      const capIds = (caps ?? []).map((c: { id: string }) => c.id);
      if (capIds.length > 0) {
        promises.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase
            .from("historico_captações" as any)
            .select("id, campo, valor_anterior, valor_novo, created_at, captacao:captacoes!captacao_id(titulo)")
            .in("captacao_id", capIds)
            .order("created_at", { ascending: false })
            .limit(30) as any
        );
      } else {
        promises.push(Promise.resolve({ data: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (sources.includes("inscricoes")) {
      promises.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase
          .from("editais_user")
          .select("id, status, created_at, account_id, projeto:projetos_crm!projeto_id(nome)")
          .eq("empresa_crm_id", empresaCrmId)
          .order("created_at", { ascending: false })
          .limit(30) as any
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (sources.includes("interacoes")) {
      promises.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("crm_interacoes")
          .select("id, tipo, assunto, resumo, ocorreu_em, created_by, account_id, contato:contatos(nome)")
          .eq("empresa_crm_id", empresaCrmId)
          .order("ocorreu_em", { ascending: false })
          .limit(30) as any
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    const [atvRes, notRes, histRes, inscRes, interRes] = await Promise.all(promises);

    // Quem escreveu as notas, as inscrições e as interações: perfis de quem é da mesma organização.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoresDiretos = [...((notRes.data ?? []) as any[]), ...((inscRes.data ?? []) as any[])].map(item => item.account_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoresDasInteracoes = ((interRes.data ?? []) as any[]).map(item => item.created_by ?? item.account_id);
    const autoresIds = [...new Set([...autoresDiretos, ...autoresDasInteracoes])].filter(Boolean) as string[];
    const nomes = new Map<string, string>();
    if (autoresIds.length > 0) {
      const { data: perfis } = await supabase.from("profiles").select("id, full_name").in("id", autoresIds);
      for (const perfil of (perfis ?? []) as { id: string; full_name: string | null }[]) if (perfil.full_name?.trim()) nomes.set(perfil.id, perfil.full_name.trim());
    }
    const porAutor = (id: string | null | undefined) => (id ? nomes.get(id) ?? null : null);

    const atividades = ((atvRes.data ?? []) as any[]).map(a => ({
      tipo: "atividade" as const,
      atividade_tipo: a.tipo || "outro",
      titulo: a.nome,
      descricao: a.nota || (a.contato?.nome ? `Contato: ${a.contato.nome}` : null),
      data: a.data_realizada || a.created_at,
      usuario: a.responsavel?.full_name ?? null,
      created_at: a.created_at,
      captacao_titulo: a.captacao?.titulo,
    }));

    const notas = ((notRes.data ?? []) as any[]).map(n => ({
      tipo: "nota" as const,
      atividade_tipo: "nota",
      titulo: n.titulo || (n.conteudo.length > 80 ? n.conteudo.slice(0, 80) + "…" : n.conteudo),
      descricao: n.titulo ? (n.conteudo || null) : null,
      data: n.created_at,
      usuario: porAutor(n.account_id),
      created_at: n.created_at,
    }));

    const historico = ((histRes.data ?? []) as any[]).map(h => ({
      tipo: "mudanca" as const,
      atividade_tipo: "mudanca",
      titulo: `${STATUS_LABEL[h.campo] || h.campo} alterado`,
      descricao: h.valor_anterior && h.valor_novo
        ? `${STATUS_LABEL[h.valor_anterior] || h.valor_anterior} → ${STATUS_LABEL[h.valor_novo] || h.valor_novo}`
        : h.valor_novo || "—",
      data: h.created_at,
      usuario: null,
      created_at: h.created_at,
      captacao_titulo: h.captacao?.titulo,
    }));

    const inscricoes = ((inscRes.data ?? []) as any[]).map(e => ({
      tipo: "inscricao" as const,
      atividade_tipo: "inscricao",
      titulo: e.projeto?.nome ? `Inscrição: ${e.projeto.nome}` : "Inscrição",
      descricao: `Status: ${EDITAL_STATUS_LABEL[e.status] || e.status}`,
      data: e.created_at,
      usuario: porAutor(e.account_id),
      created_at: e.created_at,
    }));

    const interacoes = ((interRes.data ?? []) as any[]).map(i => ({
      tipo: "interacao" as const,
      atividade_tipo: i.tipo || "outro",
      titulo: i.assunto || "Interação",
      descricao: [i.contato?.nome, i.resumo].filter(Boolean).join(" · ") || null,
      data: i.ocorreu_em,
      usuario: porAutor(i.created_by ?? i.account_id),
      created_at: i.ocorreu_em,
    }));

    const all = [...atividades, ...notas, ...historico, ...inscricoes, ...interacoes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setEvents(all);
    setLoading(false);
  }, [empresaCrmId, sources, supabase]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded border p-4 animate-pulse" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-black/8" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 bg-black/8 rounded" />
                <div className="h-4 w-3/4 bg-black/8 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">Histórico</h2>
          <span className="text-[0.6875rem] text-black/25 font-medium">{events.length} eventos</span>
        </div>
      )}

      {events.length === 0 ? (
        <div className={embedded ? "py-12 text-center" : "bg-white rounded border p-8 text-center"} style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <Clock size={24} className="mx-auto text-black/15 mb-3" />
          <p className="text-sm text-black/35">Nenhum evento registrado</p>
          <p className="text-xs text-black/20 mt-1">Atividades e notas aparecerão aqui</p>
        </div>
      ) : (
        <div className={embedded ? "" : "bg-white rounded border p-5"} style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {events.map((evt, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <EventIcon tipo={evt.atividade_tipo} />
                {i < events.length - 1 && <div className="w-px flex-1 bg-black/8 my-1" />}
              </div>
              <div className="flex-1 pb-5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[0.6875rem] font-semibold text-black/50">{formatDate(evt.data)}</span>
                  <span className="text-[0.625rem] text-black/25">{formatRelative(evt.data)}</span>
                </div>
                <p className="text-[0.8125rem] font-medium text-[#282525]">{evt.titulo}</p>
                {evt.descricao && <p className="text-xs text-black/40 mt-0.5">{evt.descricao}</p>}
                {evt.captacao_titulo && (
                  <p className="text-[0.625rem] text-[#7259B5] mt-1">↗ {evt.captacao_titulo}</p>
                )}
                {evt.usuario && <p className="text-[0.625rem] text-black/45 mt-1">por {evt.usuario}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
