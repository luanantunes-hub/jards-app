"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas experimentais ainda não constam nos tipos gerados */

import { useId, useState } from "react";
import { Briefcase, Copy, Mail, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export type EscopoTipo = "empresas" | "negociacoes" | "inscricoes";
export type EscopoModo = "pedido" | "consulta";
export type EscopoConfig = { tipo: EscopoTipo; habilitado: boolean; modo: EscopoModo };

const MODO_OPCOES: { value: EscopoModo; label: string; descricao: string }[] = [
  { value: "pedido", label: "Com aprovação", descricao: "O captador propõe uma oportunidade. Você decide antes de atribuí-la." },
  { value: "consulta", label: "Consulta e avanço", descricao: "O captador verifica uma oportunidade. Se estiver livre, ela é atribuída automaticamente." },
];

function TooltipBotao({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[170px] -translate-x-1/2 rounded bg-[#0D0D0D] px-2 py-1.5 text-center text-[10px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100">
        {texto}
      </div>
    </div>
  );
}

export function CaptadorWorkspaceModal({
  captadorId,
  organizationId,
  captadorEmail,
  workspaceId,
  escoposIniciais,
  onClose,
  onSaved,
}: {
  captadorId: string;
  organizationId: string;
  captadorEmail: string | null;
  workspaceId: string | null;
  escoposIniciais: EscopoConfig[] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const isNovo = !workspaceId;
  const [email, setEmail] = useState(captadorEmail ?? "");
  const [habilitado, setHabilitado] = useState(escoposIniciais ? escoposIniciais.some(e => e.habilitado && e.tipo !== "empresas") : true);
  const [modo, setModo] = useState<EscopoModo>(escoposIniciais?.find(e => e.tipo === "negociacoes")?.modo ?? "pedido");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [contaExistente, setContaExistente] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  async function handleSalvar() {
    setErro(null);
    if (isNovo && !/^\S+@\S+\.\S+$/.test(email.trim())) { setErro("Informe um e-mail válido."); return; }
    setSaving(true);

    let finalWorkspaceId = workspaceId;
    // setState não atualiza o valor lido no mesmo ciclo — usa variáveis locais
    // pra decidir se fecha o modal ou mostra uma das telas de resultado.
    let novoInviteUrl: string | null = null;
    let novaContaExistente: string | null = null;

    if (isNovo) {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: organizationId, email: email.trim(), role: "captador", captador_id: captadorId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(body?.error ?? "Não foi possível convidar o captador."); setSaving(false); return; }
      if (body?.manual && body?.invite_url) { novoInviteUrl = body.invite_url as string; setInviteUrl(novoInviteUrl); }
      if (body?.status === "accepted") { novaContaExistente = email.trim(); setContaExistente(novaContaExistente); }

      const { data: novoWorkspace, error: erroWorkspace } = await (supabase as any)
        .from("captador_workspaces")
        .insert({ captador_id: captadorId, organization_id: organizationId })
        .select("id")
        .single();
      if (erroWorkspace) { setErro(erroWorkspace.message); setSaving(false); return; }
      finalWorkspaceId = novoWorkspace.id;
    }

    const { error: erroEscopos } = await (supabase as any)
      .from("captador_workspace_escopos")
      .upsert((["empresas", "negociacoes", "inscricoes"] as const).map(tipo => ({
        workspace_id: finalWorkspaceId, tipo, habilitado: tipo !== "empresas" && habilitado, modo,
      })), { onConflict: "workspace_id,tipo" });

    setSaving(false);
    if (erroEscopos) { setErro(erroEscopos.message); return; }

    onSaved();
    if (!novoInviteUrl && !novaContaExistente) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-black/45" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-20px)] w-full max-w-[560px] flex-col overflow-hidden rounded-b border-x border-b border-black/[.07] bg-white shadow-[0_16px_45px_rgba(13,13,13,.15)]"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/[.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05]"><Briefcase size={16} className="text-black/50" /></div>
            <div>
              <h2 id={titleId} className="text-[15px] font-bold text-black">{isNovo ? "Criar workspace" : "Configurar workspace"}</h2>
              <p className="mt-0.5 text-[10px] text-black/35">Escolha como novas oportunidades entram no trabalho conjunto</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]"><X size={15} className="text-black/40" /></button>
        </header>

        {contaExistente ? (
          <main className="flex-1 space-y-4 px-5 py-6">
            <p className="text-[13px] font-semibold text-black">Workspace configurado.</p>
            <p className="text-[12px] text-black/50">
              <strong className="font-semibold text-black/70">{contaExistente}</strong> já tinha uma conta no Jards, então não enviamos convite por e-mail — o acesso ao workspace já está liberado.
              Se a pessoa não lembrar a senha, é só usar &quot;Esqueci minha senha&quot; na tela de login.
            </p>
            <button type="button" onClick={onClose} className="text-[12px] font-semibold text-[#7259B5]">Concluir</button>
          </main>
        ) : inviteUrl ? (
          <main className="flex-1 space-y-4 px-5 py-6">
            <p className="text-[13px] font-semibold text-black">Workspace configurado.</p>
            <p className="text-[12px] text-black/50">Esse captador já tinha um convite pendente — em vez de mandar outro e-mail, copie e envie esse link diretamente pra ele:</p>
            <div className="flex items-center gap-2 rounded border border-black/[.12] bg-black/[.02] px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-black/60">{inviteUrl}</span>
              <button
                type="button"
                onClick={async () => { await navigator.clipboard.writeText(inviteUrl); setCopiado(true); }}
                className="flex shrink-0 items-center gap-1 rounded border border-black/10 px-2.5 py-1.5 text-[11px] font-semibold text-black/60 transition hover:bg-black/[.04]"
              >
                <Copy size={12} />{copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <button type="button" onClick={onClose} className="text-[12px] font-semibold text-[#7259B5]">Concluir</button>
          </main>
        ) : (
          <>
            <main className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {isNovo && (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-black"><Mail size={12} className="text-black/35" />E-mail do captador</label>
                  <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="captador@agencia.com"
                    className="h-10 w-full rounded border border-black/[.15] bg-white px-3 text-[13px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
                  />
                  <p className="mt-1.5 text-[11px] text-black/35">Ele recebe um convite por e-mail pra criar uma senha e entrar no workspace.</p>
                </div>
              )}

              <div className="space-y-4 border-t border-black/[.07] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[13px] font-semibold text-black">Oportunidades</p><p className="mt-0.5 text-[11px] text-black/45">Negociações e editais no mesmo espaço.</p></div>
                  <button type="button" role="switch" aria-checked={habilitado} aria-label={habilitado ? "Desativar oportunidades" : "Ativar oportunidades"} onClick={() => setHabilitado(v => !v)}
                    className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${habilitado ? "bg-[#2E8932]" : "bg-black/15"}`}>
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${habilitado ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {habilitado && <div>
                  <p className="mb-2 text-[11px] font-semibold text-black/55">Como novas oportunidades entram</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MODO_OPCOES.map(opcao => <TooltipBotao key={opcao.value} texto={opcao.descricao}>
                      <button type="button" onClick={() => setModo(opcao.value)} aria-pressed={modo === opcao.value}
                        className={`w-full rounded border px-2.5 py-2 text-left text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8] ${modo === opcao.value ? "border-[#171717] bg-[#171717] text-white" : "border-black/[.14] bg-white text-black/60 hover:border-black/30"}`}>
                        {opcao.label}
                      </button>
                    </TooltipBotao>)}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-black/45">{MODO_OPCOES.find(opcao => opcao.value === modo)?.descricao}</p>
                </div>}
              </div>
            </main>
            <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-black/[.08] px-5 py-3.5">
              {erro ? <p role="alert" className="min-w-0 text-[11px] font-medium text-[#D94E4E]">{erro}</p> : <div />}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] font-semibold text-black/35 transition hover:text-black/55">Cancelar</button>
                <button
                  type="button"
                  onClick={() => void handleSalvar()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={12} />{saving ? "Salvando…" : isNovo ? "Criar workspace" : "Salvar"}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
