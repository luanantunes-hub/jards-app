"use client";

import { useState } from "react";
import { Briefcase, Copy, Mail, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type EscopoTipo = "empresas" | "negociacoes" | "inscricoes";
export type EscopoModo = "pedido" | "consulta" | "ver_tudo";
export type EscopoConfig = { tipo: EscopoTipo; habilitado: boolean; modo: EscopoModo };

const TIPO_LABEL: Record<EscopoTipo, string> = {
  empresas: "Empresas",
  negociacoes: "Negociações",
  inscricoes: "Inscrições",
};

const MODO_OPCOES: { value: EscopoModo; label: string; descricao: string }[] = [
  { value: "pedido", label: "Solicitação", descricao: "Pede acesso e espera aprovação de um admin." },
  { value: "consulta", label: "Consulta", descricao: "Checa um item específico; se estiver livre, libera na hora, mas só mostra esse item." },
  { value: "ver_tudo", label: "Ver tudo", descricao: "Lista completa, sem precisar perguntar item por item." },
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

const ESCOPO_PADRAO: EscopoConfig[] = [
  { tipo: "empresas", habilitado: false, modo: "consulta" },
  { tipo: "negociacoes", habilitado: false, modo: "consulta" },
  { tipo: "inscricoes", habilitado: false, modo: "consulta" },
];

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
  const [escopos, setEscopos] = useState<EscopoConfig[]>(escoposIniciais ?? ESCOPO_PADRAO);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function setEscopo(tipo: EscopoTipo, patch: Partial<EscopoConfig>) {
    setEscopos(current => current.map(e => e.tipo === tipo ? { ...e, ...patch } : e));
  }

  async function handleSalvar() {
    setErro(null);
    if (isNovo && !/^\S+@\S+\.\S+$/.test(email.trim())) { setErro("Informe um e-mail válido."); return; }
    setSaving(true);

    let finalWorkspaceId = workspaceId;

    if (isNovo) {
      const res = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: organizationId, email: email.trim(), role: "captador", captador_id: captadorId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(body?.error ?? "Não foi possível convidar o captador."); setSaving(false); return; }
      if (body?.manual && body?.invite_url) setInviteUrl(body.invite_url as string);

      const { data: novoWorkspace, error: erroWorkspace } = await (supabase as any)
        .from("captador_workspaces")
        .insert({ captador_id: captadorId, organization_id: organizationId })
        .select("id")
        .single();
      if (erroWorkspace) { setErro(erroWorkspace.message); setSaving(false); return; }
      finalWorkspaceId = novoWorkspace.id;
    }

    await (supabase as any).from("captador_workspace_escopos").delete().eq("workspace_id", finalWorkspaceId);
    const { error: erroEscopos } = await (supabase as any)
      .from("captador_workspace_escopos")
      .insert(escopos.map(e => ({ workspace_id: finalWorkspaceId, tipo: e.tipo, habilitado: e.habilitado, modo: e.modo })));

    setSaving(false);
    if (erroEscopos) { setErro(erroEscopos.message); return; }

    if (!inviteUrl) { onSaved(); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-black/45" onClick={onClose}>
      <div
        className="flex max-h-[calc(100dvh-20px)] w-full max-w-[560px] flex-col overflow-hidden rounded-b border-x border-b border-black/[.07] bg-white shadow-[0_16px_45px_rgba(13,13,13,.15)]"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/[.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05]"><Briefcase size={16} className="text-black/50" /></div>
            <div>
              <h2 className="text-[15px] font-bold text-black">{isNovo ? "Criar workspace" : "Configurar workspace"}</h2>
              <p className="mt-0.5 text-[10px] text-black/35">O que esse captador pode ver e como ele consulta</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]"><X size={15} className="text-black/40" /></button>
        </header>

        {inviteUrl ? (
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
            <button type="button" onClick={() => { onSaved(); onClose(); }} className="text-[12px] font-semibold text-[#7259B5]">Concluir</button>
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
                <p className="text-[9px] font-bold uppercase tracking-widest text-black/30">O que ele pode acessar</p>
                {escopos.map(escopo => (
                  <div key={escopo.tipo} className="rounded border border-black/[.10] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-black">{TIPO_LABEL[escopo.tipo]}</span>
                      <button
                        type="button"
                        onClick={() => setEscopo(escopo.tipo, { habilitado: !escopo.habilitado })}
                        role="switch"
                        aria-checked={escopo.habilitado}
                        aria-label={`${escopo.habilitado ? "Desativar" : "Ativar"} ${TIPO_LABEL[escopo.tipo]}`}
                        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${escopo.habilitado ? "bg-[#2E8932]" : "bg-black/15"}`}
                      >
                        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${escopo.habilitado ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                    {escopo.habilitado && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {MODO_OPCOES.map(opcao => {
                          const selecionado = escopo.modo === opcao.value;
                          return (
                            <TooltipBotao key={opcao.value} texto={opcao.descricao}>
                              <button
                                type="button"
                                onClick={() => setEscopo(escopo.tipo, { modo: opcao.value })}
                                className={`w-full rounded border px-2.5 py-2 text-left text-[11px] font-semibold transition ${selecionado ? "border-[#7259B5] bg-[#7259B5] text-white" : "border-[#7259B5] bg-white text-[#7259B5] hover:bg-[#7259B5]/5"}`}
                              >
                                {opcao.label}
                              </button>
                            </TooltipBotao>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
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
                  className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#27752B] active:translate-y-px disabled:opacity-50"
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
