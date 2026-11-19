"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Check, Mail, RefreshCw, UserPlus } from "lucide-react";
import { ListContent, ListEmptyState, ListPageHeader, ListSummary, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import type { RemetenteDaTriagem } from "@/app/api/email/triagem/route";

const VERDE = "#3DA86A";

function haQuantoTempo(iso: string | null): string {
  const quando = Date.parse(iso ?? "");
  if (Number.isNaN(quando)) return "";
  const dias = Math.floor((Date.now() - quando) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

const BOTAO_DO_PASSO = "flex h-8 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

export default function EmailsPage() {
  const [remetentes, setRemetentes] = useState<RemetenteDaTriagem[]>([]);
  const [conectado, setConectado] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tratando, setTratando] = useState<string | null>(null);
  const [novoContato, setNovoContato] = useState<RemetenteDaTriagem | null>(null);
  const [novaNegociacao, setNovaNegociacao] = useState<RemetenteDaTriagem | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/email/triagem", { cache: "no-store" });
      const json = (await resposta.json().catch(() => ({}))) as { conectado?: boolean; remetentes?: RemetenteDaTriagem[]; error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível carregar os e-mails.");
      setConectado(json.conectado !== false);
      setRemetentes(json.remetentes ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os e-mails.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function atualizar() {
    setSincronizando(true);
    try {
      await fetch("/api/email/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
    } finally {
      setSincronizando(false);
      await carregar();
    }
  }

  async function tratar(remetente: RemetenteDaTriagem, acao: "registrar" | "dispensar") {
    setTratando(`${acao}:${remetente.endereco}`);
    setErro(null);
    try {
      const resposta = await fetch(`/api/email/triagem/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: remetente.organizationId, endereco: remetente.endereco }),
      });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível concluir.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setTratando(null);
    }
  }

  return (
    <>
      {novoContato && (
        <NovoContatoModal
          initialNome={novoContato.nomeSugerido}
          initialEmail={novoContato.endereco}
          empresaPreId={novoContato.sugestaoDeEmpresa?.id}
          onClose={() => setNovoContato(null)}
          onSaved={() => { setNovoContato(null); void carregar(); }}
        />
      )}
      {novaNegociacao?.contato?.empresaId && (
        <NovaCaptacaoModal
          empresaPreId={novaNegociacao.contato.empresaId}
          onClose={() => setNovaNegociacao(null)}
          onSaved={() => { setNovaNegociacao(null); void carregar(); }}
        />
      )}

      <ListPageHeader
        eyebrow="Relacionamento"
        title="E-mails novos"
        description="Quem escreveu para você e ainda não está nos contatos. Só você vê estes e-mails até registrar a conversa."
        summary={!carregando && conectado && <ListSummary strong={remetentes.length}>{remetentes.length === 1 ? "pessoa para tratar" : "pessoas para tratar"}</ListSummary>}
        actions={conectado && <SecondaryListAction onClick={() => void atualizar()} disabled={sincronizando}><RefreshCw size={13} className={sincronizando ? "animate-spin" : undefined} aria-hidden="true" />{sincronizando ? "Atualizando…" : "Atualizar"}</SecondaryListAction>}
      />

      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded border border-[#D94A4A]/25 bg-white px-4 py-3 text-[0.8125rem] text-[#B23B3B]">{erro}</p>}

        {carregando ? (
          <p className="py-16 text-center text-[0.75rem] text-black/35">Carregando…</p>
        ) : !conectado ? (
          <ListEmptyState
            icon={Mail}
            title="Conecte seu e-mail"
            description="Depois de conectar, quem escreve para você e ainda não é contato aparece aqui, pronto para virar contato, histórico e negociação."
            action={<Link href="/configuracoes?section=ferramentas" className="flex h-9 items-center rounded px-3 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04]">Abrir Minhas ferramentas</Link>}
          />
        ) : remetentes.length === 0 ? (
          <ListEmptyState
            icon={Mail}
            title="Nenhum e-mail novo para tratar"
            description="Quando alguém que não está nos seus contatos escrever, aparece aqui. Newsletters e avisos automáticos ficam de fora."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {remetentes.map(remetente => {
              const contato = remetente.contato;
              const ocupado = tratando?.endsWith(`:${remetente.endereco}`) ?? false;
              return (
                <li key={`${remetente.organizationId}:${remetente.endereco}`} className="rounded border bg-white px-4 py-4 md:px-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[0.875rem] font-semibold text-[#282525]">{remetente.nome ?? remetente.nomeSugerido ?? remetente.endereco}</p>
                      <p className="truncate text-[0.75rem] text-black/45">{remetente.endereco}</p>
                      <p className="mt-2 max-w-2xl text-[0.75rem] leading-relaxed text-black/50">
                        <span className="tabular-nums">{remetente.total}</span> {remetente.total === 1 ? "e-mail" : "e-mails"}
                        {remetente.ultimoAssunto ? <> · {remetente.ultimaDirecao === "outbound" ? "você escreveu" : "último"}: <span className="text-[#282525]">{remetente.ultimoAssunto}</span></> : null}
                        {remetente.ultimoEm ? <> · {haQuantoTempo(remetente.ultimoEm)}</> : null}
                      </p>
                      {remetente.sugestaoDeEmpresa && !contato && (
                        <p className="mt-1 text-[0.75rem] text-black/40">Parece ser da {remetente.sugestaoDeEmpresa.nome}{remetente.sugestaoDeEmpresa.motivo === "site" ? ", pelo site da empresa" : ", pelos outros contatos dela"}.</p>
                      )}
                      {contato && (
                        <p className="mt-1 flex items-center gap-1.5 text-[0.75rem] font-medium" style={{ color: VERDE }}><Check size={12} aria-hidden="true" />Contato criado{contato.empresaNome ? ` em ${contato.empresaNome}` : " sem empresa"}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {!contato && (
                        <button type="button" onClick={() => setNovoContato(remetente)} disabled={ocupado} className={BOTAO_DO_PASSO}><UserPlus size={13} aria-hidden="true" />Criar contato</button>
                      )}
                      <button type="button" onClick={() => void tratar(remetente, "registrar")} disabled={!contato || ocupado} title={contato ? undefined : "Crie o contato primeiro"} className={BOTAO_DO_PASSO}><Mail size={13} aria-hidden="true" />{tratando === `registrar:${remetente.endereco}` ? "Registrando…" : "Registrar conversa"}</button>
                      <button type="button" onClick={() => setNovaNegociacao(remetente)} disabled={!contato?.empresaId || ocupado} title={contato?.empresaId ? undefined : "Crie o contato em uma empresa primeiro"} className={BOTAO_DO_PASSO}><BriefcaseBusiness size={13} aria-hidden="true" />Criar negociação</button>
                      <button type="button" onClick={() => void tratar(remetente, "dispensar")} disabled={ocupado} className="h-8 rounded px-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">{tratando === `dispensar:${remetente.endereco}` ? "Dispensando…" : "Dispensar"}</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ListContent>
    </>
  );
}
