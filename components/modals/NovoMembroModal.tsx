"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Copy, CreditCard, Eye, Handshake, Mail, Minus, Plus, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BoasVindasEquipeModal } from "@/components/modals/BoasVindasEquipeModal";

interface NovoMembroModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

type SeatSummary = {
  included: number;
  purchased: number;
  total: number;
  occupied: number;
  pending: number;
  available: number;
  unit_price: number;
};

type Role = "admin" | "colaborador" | "leitor";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  leitor: "Leitor",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Acesso completo, equipe, configurações e cobrança.",
  colaborador: "Cria e edita projetos, atividades, inscrições e negociações.",
  leitor: "Apenas consulta as informações da organização.",
};

const ROLE_CAPACITY: Record<Role, string> = {
  admin: "Usa 1 vaga",
  colaborador: "Usa 1 vaga",
  leitor: "Usa 1 vaga",
};

function RoleIcon({ role }: { role: Role }) {
  if (role === "admin") return <ShieldCheck size={15} />;
  if (role === "colaborador") return <Handshake size={15} />;
  return <Eye size={15} />;
}

const money = (value: number) => value.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function NovoMembroModal({ open, onClose, onSaved }: NovoMembroModalProps) {
  const [mode, setMode] = useState<"invite" | "buy">("invite");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SeatSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualInviteUrl, setManualInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [quantity, setQuantity] = useState(3);
  const [celebrationQuantity, setCelebrationQuantity] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("colaborador");

  const loadSummary = useCallback(async (orgId: string) => {
    setLoading(true);
    const response = await fetch(`/api/members/seats?organization_id=${encodeURIComponent(orgId)}`);
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível consultar os usuários extras");
      return;
    }
    setSummary(body as SeatSummary);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function initialize() {
      setError(null);
      setSuccess(null);
      setManualInviteUrl(null);
      setCopied(false);
      setCelebrationQuantity(null);
      const supabase = createClient();
      const { data } = await supabase.rpc("auth_org_ids");
      const orgId = (data as unknown as string[] | null)?.[0] ?? null;
      if (!active) return;
      if (!orgId) {
        setError("Organização não encontrada");
        return;
      }
      setOrganizationId(orgId);
      await loadSummary(orgId);
    }
    initialize();
    return () => { active = false; };
  }, [open, loadSummary]);

  async function buySeats() {
    if (!organizationId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setManualInviteUrl(null);
    const response = await fetch("/api/members/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: organizationId,
        quantity,
        request_id: crypto.randomUUID(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível comprar os usuários extras");
      return;
    }
    setSummary(body as SeatSummary);
    setCelebrationQuantity(quantity);
    await onSaved();
  }

  async function sendInvite() {
    if (!organizationId || !email.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setManualInviteUrl(null);
    const response = await fetch("/api/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, email, role }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível enviar o convite");
      if (response.status === 409 && body.code === "NO_SEATS") setMode("buy");
      return;
    }
    if (body.invite_url) {
      setManualInviteUrl(body.invite_url);
      setSuccess("Link manual do convite gerado. Copie e envie diretamente para a pessoa.");
    } else {
      setEmail("");
      setSuccess(body.status === "accepted"
      ? "Usuário adicionado à equipe."
      : `Convite enviado para ${body.email}.`);
    }
    await loadSummary(organizationId);
    await onSaved();
  }

  function close() {
    if (saving) return;
    setMode("invite");
    setEmail("");
    setQuantity(3);
    setError(null);
    setSuccess(null);
    setManualInviteUrl(null);
    setCopied(false);
    setCelebrationQuantity(null);
    onClose();
  }

  if (!open) return null;

  if (celebrationQuantity !== null) {
    return (
      <BoasVindasEquipeModal
        quantity={celebrationQuantity}
        onClose={close}
        onInvite={() => {
          setCelebrationQuantity(null);
          setMode("invite");
          setSuccess(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={close}>
      <div className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 pb-4 pt-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#7259B5]/[.08]">
              <Users size={16} className="text-[#7259B5]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-black">Equipe e usuários extras</h2>
              <p className="text-[11px] text-black/40">Compre a capacidade e depois envie os convites.</p>
            </div>
          </div>
          <button onClick={close} className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/5" aria-label="Fechar">
            <X size={15} className="text-black/40" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="mb-5 grid grid-cols-3 overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.09)" }}>
            {[
              [summary?.total ?? "—", "Contratados"],
              [summary?.occupied ?? "—", "Ocupados"],
              [summary?.available ?? "—", "Disponíveis"],
            ].map(([value, label], index) => (
              <div key={label} className={`px-3 py-3 text-center ${index > 0 ? "border-l" : ""}`} style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[18px] font-bold text-black/80">{loading ? "…" : value}</p>
                <p className="text-[10px] font-medium text-black/35">{label}</p>
              </div>
            ))}
          </div>
          {!!summary?.pending && (
            <p className="-mt-3 mb-5 text-center text-[10px] text-black/35">
              {summary.pending} vaga{summary.pending > 1 ? "s" : ""} reservada{summary.pending > 1 ? "s" : ""} por convite{summary.pending > 1 ? "s" : ""} pendente{summary.pending > 1 ? "s" : ""}.
            </p>
          )}

          <div className="mb-5 flex rounded bg-black/[.035] p-1">
            <button onClick={() => { setMode("invite"); setError(null); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-[11px] font-semibold transition ${mode === "invite" ? "bg-white text-black" : "text-black/40 hover:text-black/60"}`}>
              <UserPlus size={12} /> Convidar pessoa
            </button>
            <button onClick={() => { setMode("buy"); setError(null); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-[11px] font-semibold transition ${mode === "buy" ? "bg-white text-black" : "text-black/40 hover:text-black/60"}`}>
              <CreditCard size={12} /> Comprar usuários extras
            </button>
          </div>

          {error && <div className="mb-4 rounded bg-[#D94E4E]/[.08] px-3 py-2.5 text-[12px] font-medium text-[#D94E4E]">{error}</div>}
          {success && <div className="mb-4 rounded bg-[#2E8932]/[.08] px-3 py-2.5 text-[12px] font-medium text-[#2E8932]"><div className="flex items-center gap-2"><CheckCircle2 size={14} />{success}</div>{manualInviteUrl && <button onClick={async () => { await navigator.clipboard.writeText(manualInviteUrl); setCopied(true); }} className="mt-2 flex items-center gap-1.5 rounded border border-[#2E8932]/30 bg-white px-3 py-2 text-[11px] font-semibold text-[#2E8932] transition hover:bg-black/[.04]"><Copy size={12} />{copied ? "Link copiado" : "Copiar link do convite"}</button>}</div>}

          {mode === "invite" ? (
            <div className="space-y-4">
              {(summary?.available ?? 0) === 0 && !loading && (
                <div className="rounded border border-[#B07A14]/25 bg-[#B07A14]/[.04] px-4 py-3">
                  <p className="text-[12px] font-semibold text-black/70">Não há vagas disponíveis</p>
                  <p className="mt-1 text-[11px] leading-5 text-black/45">Adicione um ou mais usuários extras antes de enviar o próximo convite.</p>
                  <button onClick={() => setMode("buy")} className="mt-2 text-[11px] font-semibold text-[#B07A14] hover:underline">Comprar usuários extras</button>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-black/30">E-mail</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
                  <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="pessoa@empresa.com" className="w-full rounded border bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.12)" }} />
                </div>
              </div>
              <div>
                <p className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-black/30">Papel do usuário</p>
                <div className="space-y-2" role="radiogroup" aria-label="Papel do usuário">
                  {(Object.keys(ROLE_LABELS) as Role[]).map(value => {
                    const selected = role === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setRole(value)}
                        className={`flex w-full items-start gap-3 rounded border px-3.5 py-3 text-left transition ${selected ? "border-[#7259B5] bg-[#7259B5]/[.035]" : "border-black/10 bg-white hover:bg-black/[.025]"}`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded ${selected ? "bg-[#7259B5] text-white" : "bg-black/[.045] text-black/35"}`}>
                          <RoleIcon role={value} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <strong className={`text-[12px] ${selected ? "text-[#7259B5]" : "text-black/75"}`}>{ROLE_LABELS[value]}</strong>
                            <span className="whitespace-nowrap text-[10px] font-semibold text-black/35">{ROLE_CAPACITY[value]}</span>
                          </span>
                          <span className="mt-0.5 block text-[10.5px] leading-4 text-black/40">{ROLE_DESCRIPTIONS[value]}</span>
                        </span>
                        {selected && <Check size={13} className="mt-1 flex-shrink-0 text-[#7259B5]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] leading-5 text-black/35">Se a pessoa ainda não tiver conta, receberá um convite por e-mail.</p>
              {!!summary?.pending && <p className="text-[11px] leading-5 text-[#B07A14]">O e-mail não chegou? Informe novamente o mesmo endereço e clique em “Enviar convite” para gerar um link manual.</p>}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-semibold text-black/70">Quantos usuários extras deseja adicionar?</p>
                <p className="mt-1 text-[11px] leading-5 text-black/40">Cada usuário extra custa {money(summary?.unit_price ?? 19.9)}/mês. A compra é adicionada à assinatura atual em uma única cobrança.</p>
              </div>
              <div className="flex items-center justify-between rounded border px-4 py-3" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                <button onClick={() => setQuantity(current => Math.max(1, current - 1))} className="flex h-8 w-8 items-center justify-center rounded border border-black/10 bg-white text-black/45 transition hover:bg-black/[.04]" aria-label="Diminuir quantidade"><Minus size={13} /></button>
                <div className="text-center"><p className="text-[24px] font-bold text-black">{quantity}</p><p className="text-[10px] text-black/35">usuários extras</p></div>
                <button onClick={() => setQuantity(current => Math.min(100, current + 1))} className="flex h-8 w-8 items-center justify-center rounded border border-black/10 bg-white text-black/45 transition hover:bg-black/[.04]" aria-label="Aumentar quantidade"><Plus size={13} /></button>
              </div>
              <div className="flex gap-2">{[1, 3, 5, 10].map(value => <button key={value} onClick={() => setQuantity(value)} className={`flex-1 rounded border px-2 py-2 text-[11px] font-semibold transition ${quantity === value ? "border-[#7259B5] text-[#7259B5]" : "border-black/10 text-black/40 hover:bg-black/[.04]"}`}>+{value}</button>)}</div>
              <div className="flex items-center justify-between rounded bg-black/[.035] px-4 py-3"><span className="text-[12px] text-black/50">Novo valor mensal</span><strong className="text-[14px] text-black">+{money(quantity * (summary?.unit_price ?? 19.9))}/mês</strong></div>
              <p className="text-[10px] leading-4 text-black/30">O Stripe calcula o valor proporcional do período atual e atualiza a quantidade de usuários extras da assinatura.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button onClick={close} className="px-4 py-2 text-[12px] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
          {mode === "invite" ? (
            <button onClick={sendInvite} disabled={saving || loading || !email.trim() || (summary?.available ?? 0) < 1} className="rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#26772A] disabled:opacity-40">{saving ? "Enviando…" : "Enviar convite"}</button>
          ) : (
            <button onClick={buySeats} disabled={saving || loading} className="rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#26772A] disabled:opacity-40">{saving ? "Processando…" : `Comprar ${quantity} usuário${quantity > 1 ? "s" : ""} extra${quantity > 1 ? "s" : ""}`}</button>
          )}
        </div>
      </div>
    </div>
  );
}
