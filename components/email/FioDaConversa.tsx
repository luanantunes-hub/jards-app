"use client";

import { useEffect, useMemo, useState } from "react";
import { CornerUpLeft, ExternalLink, Lock, Users } from "lucide-react";
import { TextoRecolhivel } from "@/components/ui/TextoRecolhivel";
import { EscreverEmail } from "@/components/email/EscreverEmail";
import { assuntoDeResposta } from "@/lib/email/envio";
import { NOME_DO_PROVEDOR, provedorDaMensagem, type Conversa, type EmailDeConversa } from "@/lib/email/conversas";
import { emPartes } from "@/lib/email/lotes";
import { createClient } from "@/lib/supabase/client";

export type Pessoa = { id: string; nome: string };

export const BOTAO_DA_CONVERSA =
  "inline-flex items-center gap-2 rounded border border-black/[.12] bg-white px-3.5 py-2.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

function dataEHora(valor: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function nomeDe(lista: readonly Pessoa[], id: string | null): string | null {
  return id ? lista.find((pessoa) => pessoa.id === id)?.nome ?? null : null;
}

/** A lista traz só o trecho de cada mensagem; o texto completo (até 2.000 caracteres) vem ao abrir a conversa. */
export function useCorposDaConversa(mensagens: readonly EmailDeConversa[]) {
  const supabase = useMemo(() => createClient(), []);
  // O que foi lido vem carimbado com as mensagens de que veio: trocar de conversa já mostra "Carregando…",
  // sem precisar de um segundo estado nem de mexer no estado dentro do efeito.
  const chave = useMemo(() => mensagens.map((mensagem) => mensagem.id).join(","), [mensagens]);
  const [lido, setLido] = useState<{ chave: string; corpos: Record<string, string | null> } | null>(null);

  useEffect(() => {
    let ativo = true;
    const ids = mensagens.map((mensagem) => mensagem.id);
    void Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emPartes(ids, 50).map((parte) => (supabase as any).from("emails").select("id, body_text").in("id", parte)),
    ).then((resultados) => {
      if (!ativo) return;
      const corpos: Record<string, string | null> = {};
      for (const { data } of resultados) for (const linha of (data ?? []) as Array<{ id: string; body_text: string | null }>) corpos[linha.id] = linha.body_text;
      setLido({ chave, corpos });
    });
    return () => { ativo = false; };
  }, [chave, mensagens, supabase]);

  const atual = lido?.chave === chave ? lido.corpos : null;
  return { corpos: atual ?? {}, carregando: atual === null };
}

/** As mensagens da conversa, da mais antiga para a mais nova. Sem casca: serve na folha e na leitura ao lado da lista. */
export function FioDaConversa({ conversa, meuId, membros }: { conversa: Conversa; meuId: string | null; membros: readonly Pessoa[] }) {
  const { corpos, carregando } = useCorposDaConversa(conversa.mensagens);

  function remetente(mensagem: EmailDeConversa) {
    if (mensagem.direction === "outbound" && mensagem.user_id === meuId) return "Você";
    return mensagem.from_name?.trim() || mensagem.from_email || nomeDe(membros, mensagem.user_id) || "Remetente desconhecido";
  }

  return (
    <div className="divide-y divide-black/[.06]">
      {conversa.mensagens.map((mensagem) => {
        const destinatarios = (mensagem.to_emails ?? []).join(", ");
        const texto = corpos[mensagem.id] || mensagem.snippet || (carregando ? "Carregando…" : "Sem texto.");
        return (
          <article key={mensagem.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[0.8125rem] font-semibold text-[#282525]">
                {remetente(mensagem)}
                <span className="ml-2 text-[0.625rem] font-medium text-black/35">{mensagem.direction === "inbound" ? "Recebido" : "Enviado"}</span>
              </p>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/30">{dataEHora(mensagem.sent_at)}</span>
            </div>
            {destinatarios && <p className="mt-0.5 truncate text-[0.6875rem] text-black/35">Para {destinatarios}</p>}
            <TextoRecolhivel texto={texto} linhas={6} className="mt-2 text-[0.8125rem] leading-relaxed text-black/70" />
          </article>
        );
      })}
    </div>
  );
}

/**
 * Responder, mudar quem vê e abrir no provedor. Só aparecem na caixa de quem está com o Jards aberto.
 * "Só eu vejo" some quando a conversa não tem contato: aí não há empresa onde registrar (isso se faz na triagem).
 */
export function AcoesDaConversa({ conversa, meuId, onMudou, onErro }: { conversa: Conversa; meuId: string | null; onMudou: () => void; onErro: (mensagem: string | null) => void }) {
  const [salvando, setSalvando] = useState(false);
  const [respondendo, setRespondendo] = useState(false);

  const minhasMensagens = meuId ? conversa.mensagens.filter((mensagem) => mensagem.user_id === meuId) : [];
  const ultimaMinha = minhasMensagens[minhasMensagens.length - 1];
  if (!ultimaMinha) return null;
  const provedor = provedorDaMensagem(ultimaMinha.message_id);
  const respostaPara = ultimaMinha.direction === "outbound" ? ultimaMinha.to_emails ?? [] : ultimaMinha.from_email ? [ultimaMinha.from_email] : [];

  async function mudarVisibilidade() {
    setSalvando(true);
    onErro(null);
    try {
      const resposta = await fetch("/api/email/visibilidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: minhasMensagens.map((mensagem) => mensagem.id), visibilidade: conversa.privada ? "organization" : "private" }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
        throw new Error(corpo?.error ?? "Não foi possível mudar quem vê esta conversa.");
      }
      onMudou();
    } catch (falha) {
      onErro(falha instanceof Error ? falha.message : "Não foi possível mudar quem vê esta conversa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setRespondendo(true)} className={BOTAO_DA_CONVERSA}>
        <CornerUpLeft size={12} aria-hidden="true" />
        Responder
      </button>
      {conversa.contatoIds.length > 0 && (
        <button type="button" onClick={() => void mudarVisibilidade()} disabled={salvando} className={BOTAO_DA_CONVERSA}>
          {conversa.privada ? <Users size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
          {salvando ? "Salvando…" : conversa.privada ? "Mostrar à equipe" : "Só eu vejo"}
        </button>
      )}
      <a href={`/api/email/abrir?id=${ultimaMinha.id}`} target="_blank" rel="noopener noreferrer" className={BOTAO_DA_CONVERSA}>
        <ExternalLink size={12} aria-hidden="true" />
        Abrir no {NOME_DO_PROVEDOR[provedor]}
      </a>
      {respondendo && (
        <EscreverEmail
          inicio={{ para: respostaPara, assunto: assuntoDeResposta(conversa.assunto), responderAEmailId: ultimaMinha.id }}
          onClose={() => setRespondendo(false)}
          onEnviado={() => { setRespondendo(false); onMudou(); }}
        />
      )}
    </>
  );
}
