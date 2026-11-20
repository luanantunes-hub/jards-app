"use client";

// Ajuda do app: um "?" redondo e discreto no canto da tela. Abre um painel onde a pessoa pergunta como usar o Jards (a IA
// responde com o guia do produto, na função suporte-assistente) e, quando a IA não resolve, fala com a equipe (mensagem por
// e-mail, guardada em suporte_mensagens). A IA não vê dado de cliente: só a pergunta e o caminho da tela.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check, SendHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { linkDoWhatsapp, PERGUNTAS_DE_EXEMPLO } from "@/lib/suporte/contato";

const MENSAGEM_DE_FALHA = "Não consegui responder agora. Tente de novo ou fale com a equipe.";
const BORDA = "rgba(13,13,13,.1)";

interface Troca {
  id: number;
  pergunta: string;
  resposta?: string;
  escalar?: boolean;
  carregando?: boolean;
}

type Tela = "conversa" | "equipe" | "enviada";

/** O texto de erro que a função devolveu (corpo JSON), ou o padrão quando não deu para ler. */
async function mensagemDoErro(erro: unknown): Promise<string> {
  try {
    const resposta = (erro as { context?: Response }).context;
    const corpo = resposta ? await resposta.json() : null;
    if (corpo && typeof corpo.error === "string" && corpo.error) return corpo.error;
  } catch {
    // corpo ilegível: vale o texto padrão
  }
  return MENSAGEM_DE_FALHA;
}

export function AjudaFlutuante() {
  const supabase = useMemo(() => createClient(), []);
  const caminho = usePathname();

  const [aberto, setAberto] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [tela, setTela] = useState<Tela>("conversa");
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [texto, setTexto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const contador = useRef(0);
  const botao = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const campoEquipe = useRef<HTMLTextAreaElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  const fechar = useCallback(() => {
    setVisivel(false);
    setAberto(false);
    botao.current?.focus();
  }, []);
  useModalDismiss(fechar, { enabled: aberto });

  // Entrada suave do painel, e o foco vai para o campo certo.
  useEffect(() => {
    if (!aberto) return;
    const quadro = requestAnimationFrame(() => requestAnimationFrame(() => setVisivel(true)));
    return () => cancelAnimationFrame(quadro);
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    (tela === "equipe" ? campoEquipe : campo).current?.focus();
  }, [aberto, tela]);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [trocas, tela]);

  const carregando = trocas.some((t) => t.carregando);

  async function perguntar(pergunta: string) {
    const limpa = pergunta.trim();
    if (limpa.length < 3 || carregando) return;
    const id = ++contador.current;
    const historico = trocas
      .filter((t) => t.resposta && !t.escalar)
      .slice(-3)
      .map((t) => ({ pergunta: t.pergunta, resposta: t.resposta as string }));
    setTrocas((atuais) => [...atuais, { id, pergunta: limpa, carregando: true }]);
    setTexto("");

    const { data, error } = await supabase.functions.invoke("suporte-assistente", {
      body: { pergunta: limpa, pagina: caminho, historico },
    });
    const resposta = error ? null : (data as { resposta?: unknown; escalar?: unknown } | null);
    const texto_ = typeof resposta?.resposta === "string" ? resposta.resposta : null;
    const nova: Partial<Troca> = texto_
      ? { resposta: texto_, escalar: resposta?.escalar === true, carregando: false }
      : { resposta: error ? await mensagemDoErro(error) : MENSAGEM_DE_FALHA, escalar: true, carregando: false };
    setTrocas((atuais) => atuais.map((t) => (t.id === id ? { ...t, ...nova } : t)));
  }

  function abrirEquipe() {
    // Começa com a última pergunta, que a pessoa pode editar: é o que ela estava tentando resolver.
    const ultima = [...trocas].reverse().find((t) => t.pergunta);
    setMensagem((atual) => atual || ultima?.pergunta || "");
    setErro(null);
    setTela("equipe");
  }

  async function enviarParaEquipe() {
    const limpa = mensagem.trim();
    if (!limpa || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const conversa = trocas.filter((t) => t.resposta && !t.escalar).slice(-3).map((t) => ({ pergunta: t.pergunta, resposta: t.resposta as string }));
      const resposta = await fetch("/api/suporte/mensagem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagem: limpa, pagina: caminho, conversa }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
        setErro(corpo.error ?? "Não foi possível enviar agora. Tente de novo em instantes.");
        return;
      }
      setMensagem("");
      setTela("enviada");
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const ultimaPergunta = [...trocas].reverse().find((t) => t.pergunta)?.pergunta;
  const textoDoWhatsapp = ultimaPergunta ? `Olá! Preciso de ajuda no Jards: ${ultimaPergunta}` : "Olá! Preciso de ajuda no Jards.";

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-label={aberto ? "Fechar a ajuda" : "Ajuda"}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="Ajuda"
        className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[1rem] font-semibold leading-none text-black/45 shadow-[0_2px_8px_rgba(13,13,13,.08)] transition hover:border-black/25 hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] motion-reduce:transition-none md:bottom-5 md:right-5"
        style={{ borderColor: "rgba(13,13,13,.14)" }}
      >
        {aberto ? <X size={16} aria-hidden="true" /> : "?"}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Ajuda"
          className="fixed bottom-[4.25rem] right-4 z-40 flex max-h-[min(34rem,calc(100dvh-6.5rem))] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded border bg-white transition duration-200 motion-reduce:transition-none max-sm:left-2 max-sm:right-2 max-sm:w-auto max-sm:max-w-none md:bottom-[4.75rem] md:right-5"
          style={{
            borderColor: BORDA,
            boxShadow: "0 8px 32px rgba(0,0,0,.14)",
            opacity: visivel ? 1 : 0,
            transform: visivel ? "none" : "translateY(8px)",
          }}
        >
          <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {tela !== "conversa" && (
              <button type="button" onClick={() => setTela("conversa")} aria-label="Voltar para a conversa"
                className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded text-black/40 transition hover:bg-black/[.06] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                <ArrowLeft size={15} aria-hidden="true" />
              </button>
            )}
            <p className="min-w-0 flex-1 text-[0.8125rem] font-bold text-[#282525]">{tela === "conversa" ? "Ajuda" : "Falar com a equipe"}</p>
            <button type="button" onClick={fechar} aria-label="Fechar"
              className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded text-black/40 transition hover:bg-black/[.06] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          {tela === "conversa" && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
                {trocas.length === 0 ? (
                  <div>
                    <p className="text-[0.875rem] font-semibold text-[#282525]">Como posso ajudar?</p>
                    <div className="mt-3 flex flex-col items-start gap-1.5">
                      {PERGUNTAS_DE_EXEMPLO.map((exemplo) => (
                        <button key={exemplo} type="button" onClick={() => perguntar(exemplo)}
                          className="rounded border bg-white px-2.5 py-1.5 text-left text-[0.75rem] text-black/60 transition hover:border-black/25 hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                          style={{ borderColor: BORDA }}>
                          {exemplo}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {trocas.map((troca) => (
                      <li key={troca.id} className="flex flex-col gap-2">
                        <p className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded bg-black/[.05] px-3 py-2 text-[0.8125rem] leading-snug text-[#282525]">{troca.pergunta}</p>
                        {troca.carregando ? (
                          <p className="text-[0.75rem] text-black/40">Procurando a resposta…</p>
                        ) : (
                          <div>
                            <p className="whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-[#282525]">{troca.resposta}</p>
                            {troca.escalar ? (
                              <button type="button" onClick={abrirEquipe}
                                className="mt-2 rounded border bg-white px-3 py-1.5 text-[0.75rem] font-semibold text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                                style={{ borderColor: "rgba(13,13,13,.18)" }}>
                                Falar com a equipe
                              </button>
                            ) : (
                              <button type="button" onClick={abrirEquipe}
                                className="mt-1.5 rounded text-[0.6875rem] text-black/40 underline decoration-black/20 underline-offset-2 transition hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                                Falar com a equipe
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div ref={fim} />
              </div>

              <form
                className="shrink-0 border-t px-3 pb-2 pt-3"
                style={{ borderColor: "rgba(13,13,13,.08)" }}
                onSubmit={(evento) => { evento.preventDefault(); void perguntar(texto); }}
              >
                <div className="flex items-end gap-2">
                  <textarea
                    ref={campo}
                    value={texto}
                    onChange={(evento) => setTexto(evento.target.value)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter" && !evento.shiftKey) { evento.preventDefault(); void perguntar(texto); }
                    }}
                    rows={1}
                    maxLength={800}
                    placeholder="Pergunte como usar o Jards"
                    aria-label="Sua pergunta"
                    className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/35 focus:border-black/35"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  />
                  <button type="submit" disabled={carregando || texto.trim().length < 3} aria-label="Perguntar"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#7259B5] text-white transition hover:bg-[#5D489D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40">
                    <SendHorizontal size={15} aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-2 text-[0.625rem] leading-snug text-black/35">Respostas de IA podem errar. As perguntas ficam guardadas para melhorarmos a ajuda.</p>
              </form>
            </>
          )}

          {tela === "equipe" && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <label htmlFor="mensagem-equipe" className="mb-1.5 block text-[0.75rem] font-semibold text-[#282525]">O que você precisa?</label>
                <textarea
                  id="mensagem-equipe"
                  ref={campoEquipe}
                  value={mensagem}
                  onChange={(evento) => setMensagem(evento.target.value)}
                  rows={6}
                  maxLength={4000}
                  placeholder="Conte o que aconteceu ou o que você quer fazer"
                  className="w-full resize-none rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/35 focus:border-black/35"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
                <p className="mt-2 text-[0.6875rem] leading-snug text-black/45">Respondemos por e-mail. A tela em que você está vai junto.</p>
                {erro && <p role="alert" className="mt-2 text-[0.75rem] font-medium text-[#D94E4E]">{erro}</p>}
              </div>
              <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <a href={linkDoWhatsapp(textoDoWhatsapp)} target="_blank" rel="noopener noreferrer"
                  className="rounded text-[0.6875rem] text-black/45 underline decoration-black/20 underline-offset-2 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Prefere o WhatsApp?
                </a>
                <button type="button" onClick={() => void enviarParaEquipe()} disabled={enviando || !mensagem.trim()}
                  className="flex items-center gap-1.5 rounded acao-salvar px-4 py-2 text-[0.75rem] font-bold text-white transition active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] disabled:cursor-not-allowed disabled:opacity-50">
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </footer>
            </>
          )}

          {tela === "enviada" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2E8932]/10 text-[#2E8932]"><Check size={18} aria-hidden="true" /></span>
              <p className="text-[0.875rem] font-semibold text-[#282525]">Mensagem enviada</p>
              <p className="text-[0.75rem] leading-snug text-black/50">Respondemos por e-mail.</p>
              <button type="button" onClick={() => setTela("conversa")}
                className="mt-2 rounded px-2 py-1 text-[0.75rem] font-semibold text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                Voltar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
