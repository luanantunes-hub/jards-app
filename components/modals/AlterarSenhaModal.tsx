"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function PasswordField({ label, value, onChange, show, onToggle, placeholder, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-black">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-10 w-full rounded border border-black/[.15] bg-white pl-3 pr-10 text-[13px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5] focus:ring-2 focus:ring-[#7259B5]/10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/55"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

export function AlterarSenhaModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const supabase = createClient();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSalvar() {
    setErro(null);
    if (!senhaAtual) { setErro("Informe sua senha atual."); return; }
    if (novaSenha.length < 8) { setErro("A nova senha deve ter no mínimo 8 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { setErro("As senhas não coincidem."); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setErro("Não foi possível identificar sua conta."); setSaving(false); return; }

    const { error: erroVerificacao } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAtual });
    if (erroVerificacao) { setErro("Senha atual incorreta."); setSaving(false); return; }

    const { error: erroAtualizar } = await supabase.auth.updateUser({ password: novaSenha });
    setSaving(false);
    if (erroAtualizar) { setErro(erroAtualizar.message); return; }

    setSucesso(true);
    onSaved?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-black/45" onClick={onClose}>
      <div
        className="flex max-h-[calc(100dvh-20px)] w-full max-w-[420px] flex-col overflow-hidden rounded-b border-x border-b border-black/[.07] bg-white shadow-[0_16px_45px_rgba(13,13,13,.15)]"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/[.08] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05]"><Lock size={16} className="text-black/50" /></div>
            <div>
              <h2 className="text-[15px] font-bold text-black">Alterar senha</h2>
              <p className="mt-0.5 text-[10px] text-black/35">Confirme sua senha atual pra definir uma nova</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        {sucesso ? (
          <main className="flex-1 space-y-4 px-5 py-8 text-center">
            <p className="text-[13px] font-semibold text-black">Senha alterada com sucesso.</p>
            <button type="button" onClick={onClose} className="text-[12px] font-semibold text-[#7259B5]">Fechar</button>
          </main>
        ) : (
          <>
            <main className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <PasswordField label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} show={showAtual} onToggle={() => setShowAtual(v => !v)} autoComplete="current-password" />
              <PasswordField label="Nova senha" value={novaSenha} onChange={setNovaSenha} show={showNova} onToggle={() => setShowNova(v => !v)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
              <PasswordField label="Confirmar nova senha" value={confirmarSenha} onChange={setConfirmarSenha} show={showNova} onToggle={() => setShowNova(v => !v)} autoComplete="new-password" />
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
                  <Save size={12} />{saving ? "Salvando…" : "Salvar nova senha"}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
