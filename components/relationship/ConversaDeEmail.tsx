"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TextoRecolhivel } from "@/components/ui/TextoRecolhivel";
import { EtiquetaDeSituacao, EtiquetaSoEuVejo } from "@/components/email/EtiquetaDeConversa";
import { NOME_DO_PROVEDOR, provedorDaMensagem, type Conversa, type EmailDeConversa } from "@/lib/email/conversas";
import { emPartes } from "@/lib/email/lotes";

type Pessoa = { id: string; nome: string };

type Props = {
  conversa: Conversa;
  /** Quem está com o Jards aberto: só o dono da caixa pode abrir no Gmail/Outlook e mudar quem vê. */
  meuId: string | null;
  contatos: Pessoa[];
  membros: Pessoa[];
  onClose: () => void;
  /** A visibilidade mudou: quem abriu a conversa recarrega a lista. */
  onMudou: () => void;
};

const BOTAO_SECUNDARIO =
  "inline-flex items-center gap-2 rounded border border-black/[.12] bg-white px-3.5 py-2.5 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40";

function dataEHora(valor: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ConversaDeEmail({ conversa, meuId, contatos, membros, onClose, onMudou }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [corpos, setCorpos] = useState<Record<string, string | null>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A lista traz só o trecho de cada mensagem; o texto completo (até 2.000 caracteres) vem ao abrir a conversa.
  useEffect(() => {
    let ativo = true;
    const ids = conversa.mensagens.map((mensagem) => mensagem.id);
    void Promise.all(
      emPartes(ids, 50).map((parte) => (supabase as any).from("emails").select("id, body_text").in("id", parte)),
    ).then((resultados) => {
      if (!ativo) return;
      const lidos: Record<string, string | null> = {};
      for (const { data } of resultados) for (const linha of (data ?? []) as Array<{ id: string; body_text: string | null }>) lidos[linha.id] = linha.body_text;
      setCorpos(lidos);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [conversa.mensagens, supabase]);

  const nomeDo = (lista: Pessoa[], id: string | null) => (id ? lista.find((pessoa) => pessoa.id === id)?.nome ?? null : null);
  const minhasMensagens = meuId ? conversa.mensagens.filter((mensagem) => mensagem.user_id === meuId) : [];
  const ehMinha = minhasMensagens.length > 0;
  const donoDaCaixa = conversa.donoIds[0] ? nomeDo(membros, conversa.donoIds[0]) : null;
  const nomesDosContatos = conversa.contatoIds.map((id) => nomeDo(contatos, id)).filter(Boolean).join(", ");
  const total = conversa.mensagens.length;
  const provedor = minhasMensagens.length > 0 ? provedorDaMensagem(minhasMensagens[minhasMensagens.length - 1].message_id) : null;

  function remetente(mensagem: EmailDeConversa) {
    if (mensagem.direction === "outbound" && mensagem.user_id === meuId) return "Você";
    return mensagem.from_name?.trim() || mensagem.from_email || nomeDo(membros, mensagem.user_id) || "Remetente desconhecido";
  }

  async function mudarVisibilidade() {
    setSalvando(true);
    setErro(null);
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
      setErro(falha instanceof Error ? falha.message : "Não foi possível mudar quem vê esta conversa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      titulo={conversa.assunto}
      subtitulo={[nomesDosContatos, `${total} ${total === 1 ? "mensagem" : "mensagens"}`].filter(Boolean).join(" · ")}
      onClose={onClose}
      footer={(close) => ehMinha && provedor ? (
        <>
          {/* Sem contato não há onde registrar: a conversa vira da equipe pela triagem (Pessoas novas), depois de criar o contato. */}
          {conversa.contatoIds.length > 0 && (
            <button type="button" onClick={() => void mudarVisibilidade()} disabled={salvando} className={BOTAO_SECUNDARIO}>
              {conversa.privada ? <Users size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
              {salvando ? "Salvando…" : conversa.privada ? "Mostrar à equipe" : "Só eu vejo"}
            </button>
          )}
          <a href={`/api/email/abrir?id=${minhasMensagens[minhasMensagens.length - 1].id}`} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
            <ExternalLink size={12} aria-hidden="true" />
            Abrir no {NOME_DO_PROVEDOR[provedor]}
          </a>
        </>
      ) : (
        <button type="button" onClick={close} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Fechar</button>
      )}
    >
      {(conversa.situacao || conversa.privada || (!ehMinha && donoDaCaixa)) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {conversa.situacao && <EtiquetaDeSituacao situacao={conversa.situacao} />}
          {conversa.privada && <EtiquetaSoEuVejo />}
          {!ehMinha && donoDaCaixa && <span className="text-[0.6875rem] text-black/40">Caixa de {donoDaCaixa}</span>}
        </div>
      )}
      {erro && <p role="alert" className="mb-4 rounded border border-[#D94E4E]/20 px-3 py-2 text-xs text-[#D94E4E]">{erro}</p>}
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
    </BottomSheet>
  );
}
