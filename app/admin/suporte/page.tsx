"use client";
// Suporte (super admin): as mensagens que as pessoas mandaram pelo "?" do app e o que perguntaram à IA da ajuda.
// A leitura passa pelas políticas de suporte_mensagens e suporte_perguntas (só o super admin lê).
import { useEffect, useMemo, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LIMITES_DO_SUPORTE } from "@/supabase/functions/_shared/suporte-regras";

type Mensagem = {
  id: string;
  nome: string | null;
  email: string | null;
  organizacao: string | null;
  mensagem: string;
  pagina: string | null;
  conversa: { pergunta: string; resposta: string }[] | null;
  email_enviado: boolean;
  created_at: string;
};

type Pergunta = {
  id: string;
  pergunta: string;
  resposta: string | null;
  escalou: boolean;
  pagina: string | null;
  custo_usd: number | null;
  sucesso: boolean;
  erro: string | null;
  created_at: string;
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const BORDA = { borderColor: "rgba(13,13,13,.08)" };

export default function AdminSuportePage() {
  const supabase = useMemo(() => createClient(), []);
  const [aba, setAba] = useState<"mensagens" | "perguntas">("mensagens");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  /** Perguntas à IA nas últimas 24 horas, de todo mundo: o que já foi usado do teto geral do dia. */
  const [ultimas24h, setUltimas24h] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas novas, ainda fora do tipo Database
      const banco = supabase as any;
      const [m, p, dia] = await Promise.all([
        banco.from("suporte_mensagens")
          .select("id, nome, email, organizacao, mensagem, pagina, conversa, email_enviado, created_at")
          .order("created_at", { ascending: false }).limit(100),
        banco.from("suporte_perguntas")
          .select("id, pergunta, resposta, escalou, pagina, custo_usd, sucesso, erro, created_at")
          .order("created_at", { ascending: false }).limit(100),
        banco.from("suporte_perguntas")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
      ]);
      if (!ativo) return;
      if (m.error || p.error) setErro((m.error ?? p.error).message);
      setMensagens((m.data ?? []) as Mensagem[]);
      setPerguntas((p.data ?? []) as Pergunta[]);
      setUltimas24h(dia.error ? null : (dia.count ?? 0));
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [supabase]);

  const custoTotal = perguntas.reduce((soma, p) => soma + (p.custo_usd ?? 0), 0);
  // Sem o preço do modelo configurado (GOOGLE_AI_PRECOS), nenhuma linha traz custo: mostrar 0 enganaria.
  const temCusto = perguntas.some((p) => p.custo_usd !== null);
  const semResposta = perguntas.filter((p) => p.escalou || !p.sucesso).length;

  return (
    <div className="mx-auto max-w-[64rem] px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <LifeBuoy size={18} className="text-black/40" aria-hidden="true" />
        <h1 className="text-[1.125rem] font-bold text-[#282525]">Suporte</h1>
      </div>

      <div className="mb-4 flex items-center gap-1">
        {([["mensagens", `Mensagens (${mensagens.length})`], ["perguntas", `Perguntas à IA (${perguntas.length})`]] as const).map(([chave, rotulo]) => (
          <button key={chave} type="button" onClick={() => setAba(chave)} aria-pressed={aba === chave}
            className={`rounded px-3 py-1.5 text-[0.75rem] font-semibold transition ${aba === chave ? "bg-[#1C0E33] text-white" : "text-black/50 hover:bg-black/[.05]"}`}>
            {rotulo}
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="mb-4 text-[0.75rem] font-medium text-[#D94E4E]">{erro}</p>}
      {carregando && <p className="text-[0.8125rem] text-black/40">Carregando…</p>}

      {!carregando && aba === "mensagens" && (
        mensagens.length === 0 ? (
          <p className="rounded border bg-white px-4 py-10 text-center text-[0.8125rem] text-black/40" style={BORDA}>Nenhuma mensagem ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mensagens.map((m) => (
              <li key={m.id} className="rounded border bg-white px-4 py-3" style={BORDA}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[0.8125rem] font-semibold text-[#282525]">
                    {m.nome || m.email || "Sem nome"}
                    {m.nome && m.email && <span className="ml-2 font-normal text-black/45">{m.email}</span>}
                  </p>
                  <p className="text-[0.6875rem] tabular-nums text-black/40">{quando(m.created_at)}</p>
                </div>
                <p className="mt-0.5 text-[0.6875rem] text-black/40">
                  {[m.organizacao, m.pagina].filter(Boolean).join(" · ") || "—"}
                  {!m.email_enviado && <span className="ml-2 font-semibold text-[#D94E4E]">aviso por e-mail não saiu</span>}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-[#282525]">{m.mensagem}</p>
                {m.conversa && m.conversa.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[0.6875rem] text-black/45">O que a IA respondeu antes</summary>
                    <div className="mt-1.5 flex flex-col gap-2 border-l-2 pl-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
                      {m.conversa.map((t, i) => (
                        <p key={i} className="whitespace-pre-wrap break-words text-[0.75rem] text-black/60"><b className="font-semibold">{t.pergunta}</b><br />{t.resposta}</p>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {!carregando && aba === "perguntas" && (
        <>
          <p className="mb-3 text-[0.75rem] text-black/45">
            {perguntas.length} perguntas · {semResposta} sem resposta ou com erro · {temCusto ? `custo estimado US$ ${custoTotal.toFixed(4)}` : "custo ainda não calculado"}
            {ultimas24h !== null && ` · últimas 24 h: ${ultimas24h} de ${LIMITES_DO_SUPORTE.geralPorDia} do teto geral`}
          </p>
          {perguntas.length === 0 ? (
            <p className="rounded border bg-white px-4 py-10 text-center text-[0.8125rem] text-black/40" style={BORDA}>Nenhuma pergunta ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {perguntas.map((p) => (
                <li key={p.id} className="rounded border bg-white px-4 py-3" style={BORDA}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[0.8125rem] font-semibold text-[#282525]">{p.pergunta}</p>
                    <p className="text-[0.6875rem] tabular-nums text-black/40">{quando(p.created_at)}{p.pagina ? ` · ${p.pagina}` : ""}</p>
                  </div>
                  {p.sucesso ? (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[0.75rem] leading-relaxed text-black/60">{p.resposta}</p>
                  ) : (
                    <p className="mt-1.5 text-[0.75rem] font-medium text-[#D94E4E]">Falhou: {p.erro ?? "sem detalhe"}</p>
                  )}
                  {p.escalou && <p className="mt-1 text-[0.6875rem] font-semibold text-[#B07A14]">A IA mandou falar com a equipe: vale entrar no guia.</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
