"use client";

import { useId, useState } from "react";
import { Copy, FolderOpen, Mail, Save, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export function ProponenteWorkspaceModal({
  proponenteId,
  organizationId,
  proponenteEmail,
  jaTemAcesso,
  onClose,
  onSaved,
}: {
  proponenteId: string;
  organizationId: string;
  proponenteEmail: string | null;
  jaTemAcesso: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(proponenteEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [contaExistente, setContaExistente] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  async function handleConvidar() {
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErro("Informe um e-mail válido."); return; }
    setSaving(true);

    const res = await fetch("/api/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, email: email.trim(), role: "proponente", proponente_id: proponenteId }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErro(body?.error ?? "Não foi possível convidar o proponente."); return; }

    if (body?.manual && body?.invite_url) { setInviteUrl(body.invite_url as string); }
    else if (body?.status === "accepted") { setContaExistente(email.trim()); }
    else { onSaved(); onClose(); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center veu" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-20px)] w-full max-w-[32.5rem] flex-col overflow-hidden rounded-b bg-white border-x border-b elevacao-2"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/[.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05]"><FolderOpen size={16} className="text-black/50" /></div>
            <div>
              <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Dar acesso ao proponente</h2>
              <p className="mt-0.5 text-[0.625rem] text-black/35">Ele passa a ver os próprios projetos e o status de negociações e inscrições</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]"><X size={15} className="text-black/40" /></button>
        </header>

        {contaExistente ? (
          <main className="flex-1 space-y-4 px-5 py-6">
            <p className="text-[0.8125rem] font-semibold text-[#282525]">Acesso liberado.</p>
            <p className="text-[0.75rem] text-black/50">
              <strong className="font-semibold text-black/70">{contaExistente}</strong> já tinha uma conta no Jards, então não enviamos convite por e-mail — o acesso ao workspace já está liberado.
              Se a pessoa não lembrar a senha, é só usar &quot;Esqueci minha senha&quot; na tela de login.
            </p>
            <button type="button" onClick={onClose} className="text-[0.75rem] font-semibold text-[#7259B5]">Concluir</button>
          </main>
        ) : inviteUrl ? (
          <main className="flex-1 space-y-4 px-5 py-6">
            <p className="text-[0.8125rem] font-semibold text-[#282525]">Acesso liberado.</p>
            <p className="text-[0.75rem] text-black/50">Esse proponente já tinha um convite pendente — em vez de mandar outro e-mail, copie e envie esse link diretamente pra ele:</p>
            <div className="flex items-center gap-2 rounded border border-black/[.12] bg-black/[.02] px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-black/60">{inviteUrl}</span>
              <button
                type="button"
                onClick={async () => { await navigator.clipboard.writeText(inviteUrl); setCopiado(true); }}
                className="flex shrink-0 items-center gap-1 rounded border border-black/10 px-2.5 py-1.5 text-[0.6875rem] font-semibold text-black/60 transition hover:bg-black/[.04]"
              >
                <Copy size={12} />{copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <button type="button" onClick={onClose} className="text-[0.75rem] font-semibold text-[#7259B5]">Concluir</button>
          </main>
        ) : (
          <>
            <main className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {jaTemAcesso && (
                <p className="rounded border border-black/[.08] bg-black/[.02] px-3 py-2.5 text-[0.6875rem] text-black/50">
                  Este proponente já tem acesso ao workspace. Convidar de novo reenvia o link para um e-mail diferente, se precisar trocar.
                </p>
              )}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#282525]"><Mail size={12} className="text-black/35" />E-mail do proponente</label>
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="contato@instituicao.org"
                  className="h-10 w-full rounded border border-black/[.15] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
                />
                <p className="mt-1.5 text-[0.6875rem] text-black/35">Ele recebe um convite por e-mail pra criar uma senha e ver os próprios projetos.</p>
              </div>
            </main>
            <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-black/[.08] px-5 py-3.5">
              {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
                <button
                  type="button"
                  onClick={() => void handleConvidar()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={12} />{saving ? "Enviando…" : "Convidar"}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
