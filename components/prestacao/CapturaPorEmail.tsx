"use client";

// Captura por e-mail (P5.5), na visão geral: o endereço da prestação, quem
// pode enviar e o que chegou. Os anexos viram despesas em análise. O card só
// aparece quando o domínio de recebimento está configurado.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { acrescentarRemetente, enderecoDeCaptura, textoDaSituacao, type SituacaoDoEmail } from "@/lib/prestacao/captura-email";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const DOMINIO = process.env.NEXT_PUBLIC_PRESTACAO_EMAIL_DOMINIO ?? "";
const BOTAO = "inline-flex h-8 items-center gap-1 rounded border bg-white px-2.5 text-[0.6875rem] text-black/65 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const LINK = "rounded text-[0.6875rem] text-black/45 underline decoration-black/20 underline-offset-2 transition focus-visible:outline-2 focus-visible:outline-[#7259B5]";

type EmailRecebido = { id: string; remetente: string; assunto: string | null; recebido_em: string; situacao: SituacaoDoEmail; anexos: number; despesas: number; detalhe: string | null };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function CapturaPorEmail({ prestacaoId, podeEditar }: { prestacaoId: string; podeEditar: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [remetentes, setRemetentes] = useState<string[]>([]);
  const [emails, setEmails] = useState<EmailRecebido[]>([]);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(async () => {
    const [p, e] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas novas, ainda fora do tipo Database
      (supabase as any).from("prestacoes_contas").select("email_captura_token, email_captura_remetentes").eq("id", prestacaoId).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
      (supabase as any).from("prestacao_emails_recebidos").select("id, remetente, assunto, recebido_em, situacao, anexos, despesas, detalhe")
        .eq("prestacao_id", prestacaoId).order("recebido_em", { ascending: false }).limit(5),
    ]);
    return {
      token: (p.data?.email_captura_token ?? null) as string | null,
      remetentes: (p.data?.email_captura_remetentes ?? []) as string[],
      emails: (e.data ?? []) as EmailRecebido[],
    };
  }, [prestacaoId, supabase]);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof buscar>>) => {
    setToken(r.token);
    setRemetentes(r.remetentes);
    setEmails(r.emails);
  }, []);

  useEffect(() => {
    if (!DOMINIO) return;
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  if (!DOMINIO) return null;
  const endereco = token ? enderecoDeCaptura(token, DOMINIO) : null;

  async function ligar() {
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { data, error } = await (supabase as any).rpc("fn_prestacao_ligar_captura_email", { p_prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível criar o endereço")); return; }
    setToken(data as string);
  }

  function trocar() {
    confirmDelete({
      title: "Trocar o endereço?",
      description: "O endereço atual deixa de receber. Avise quem manda documentos para ele.",
      confirmLabel: "Trocar",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
        const { data, error } = await (supabase as any).rpc("fn_prestacao_ligar_captura_email", { p_prestacao_id: prestacaoId });
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível trocar o endereço"));
        setToken(data as string);
      },
    });
  }

  function desligar() {
    confirmDelete({
      title: "Desligar o recebimento por e-mail?",
      description: "O endereço deixa de receber. As despesas que já chegaram continuam na prestação.",
      confirmLabel: "Desligar",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
        const { error } = await (supabase as any).rpc("fn_prestacao_desligar_captura_email", { p_prestacao_id: prestacaoId });
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível desligar"));
        setToken(null);
      },
    });
  }

  async function salvarRemetentes(lista: string[]) {
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { data, error } = await (supabase as any).rpc("fn_prestacao_remetentes_captura", { p_prestacao_id: prestacaoId, p_remetentes: lista });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar os remetentes")); return false; }
    setRemetentes((data ?? lista) as string[]);
    return true;
  }

  async function acrescentar(email: string) {
    const r = acrescentarRemetente(remetentes, email);
    if (r.erro) { setErro(r.erro); return; }
    if (await salvarRemetentes(r.lista)) setNovo("");
  }

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* o endereço continua selecionável */ }
  }

  return (
    <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-black/50"><Mail size={13} aria-hidden /> Receber por e-mail</p>
        {podeEditar && token === null && (
          <button type="button" onClick={ligar} disabled={salvando} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.12)" }}>Criar endereço</button>
        )}
      </div>
      <div className="space-y-3 px-4 py-3 text-[0.6875rem]">
        {token === undefined ? (
          <div className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
        ) : !endereco ? (
          <p className="text-black/45">Notas e recibos mandados para um endereço da prestação viram despesas em análise. O XML da nota já preenche valor, data e número.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded border bg-white px-2.5 py-2" style={{ borderColor: "rgba(13,13,13,.12)" }}>
              <span className="min-w-0 flex-1 select-all break-all text-[0.75rem] text-black/85">{endereco}</span>
              <button type="button" onClick={copiar} aria-label={copiado ? "Endereço copiado" : "Copiar o endereço"}
                className="shrink-0 rounded p-1.5 text-black/40 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                {copiado ? <Check size={13} className="text-[#2E8932]" aria-hidden /> : <Copy size={13} aria-hidden />}
              </button>
            </div>
            <div>
              <p className="text-black/55">Podem mandar: a equipe com a prestação, o proponente{remetentes.length ? " e" : "."}</p>
              {remetentes.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Remetentes autorizados">
                  {remetentes.map(r => (
                    <li key={r} className="inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-black/70" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                      {r}
                      {podeEditar && (
                        <button type="button" onClick={() => void salvarRemetentes(remetentes.filter(x => x !== r))} aria-label={`Tirar ${r}`}
                          className="rounded text-black/35 hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                          <X size={11} aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {podeEditar && (
                <form className="mt-2 flex gap-1.5" onSubmit={e => { e.preventDefault(); void acrescentar(novo); }}>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">E-mail para autorizar</span>
                    <input value={novo} onChange={e => setNovo(e.target.value)} type="email" placeholder="contador@escritorio.com.br"
                      className="h-8 w-full rounded border border-black/[.12] bg-white px-2 text-[0.6875rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
                  </label>
                  <button type="submit" disabled={salvando || !novo.trim()} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.12)" }}>Autorizar</button>
                </form>
              )}
            </div>
            {podeEditar && (
              <div className="flex gap-3">
                <button type="button" onClick={trocar} className={`${LINK} hover:text-black/75`}>Trocar endereço</button>
                <button type="button" onClick={desligar} className={`${LINK} hover:text-[#B23B3B]`}>Desligar</button>
              </div>
            )}
          </>
        )}
        {erro && <p role="alert" className="text-[#B23B3B]">{erro}</p>}
        {emails.length > 0 && (
          <div className="border-t pt-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <p className="mb-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Recebidos</p>
            <ul className="space-y-2" aria-label="E-mails recebidos">
              {emails.map(e => {
                const s = textoDaSituacao(e);
                const naoAutorizado = e.situacao === "remetente_nao_autorizado";
                return (
                  <li key={e.id} className="leading-snug">
                    <p className="truncate text-black/75" title={e.assunto ?? undefined}>{e.assunto || "Sem assunto"}</p>
                    <p className="text-black/45">{e.remetente} · {quando(e.recebido_em)} · <span style={{ color: s.cor }}>{s.texto}</span></p>
                    {e.detalhe && e.situacao !== "remetente_nao_autorizado" && <p className="text-black/40">{e.detalhe}</p>}
                    {naoAutorizado && podeEditar && token && !remetentes.includes(e.remetente) && (
                      <button type="button" onClick={() => void acrescentar(e.remetente)} className={`${LINK} hover:text-black/75`}>
                        Autorizar {e.remetente} (peça para reenviar)
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
