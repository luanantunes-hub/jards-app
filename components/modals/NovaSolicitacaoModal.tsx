"use client";

import { useEffect, useState } from "react";
import { X, ArrowRightLeft, Building2, User, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

interface AtribuicaoParaTransferencia {
  id: string;
  empresa_nome: string;
  captador_nome: string;
  tipo_exclusividade: string;
  data_inicio: string;
}

interface Membro {
  user_id: string;
  nome: string;
}

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

const TIPO_EXCLUSAO_LABELS: Record<string, string> = {
  exclusividade_empresa: "Exclusividade por Empresa",
  exclusividade_projeto: "Exclusividade por Projeto",
  time_lock: "Time Lock",
  relacao_pessoal: "Relação Pessoal",
  compartilhada: "Compartilhada",
  livre: "Livre",
};

/* -------------------------------------------------------------------------- */
/*                                MODAL                                       */
/* -------------------------------------------------------------------------- */

interface NovaSolicitacaoModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function NovaSolicitacaoModal({ open, onClose, onSaved }: NovaSolicitacaoModalProps) {
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoParaTransferencia[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [atribuicaoId, setAtribuicaoId] = useState<string | null>(null);
  const [destinatarioId, setDestinatarioId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open) return;
    setAtribuicaoId(null);
    setDestinatarioId(null);
    setMotivo("");
    setErro(null);
    loadData();
  }, [open]);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orgIds } = await supabase.rpc("auth_org_ids");
    const orgId = orgIds?.[0];

    // captador_user_id referencia captadores(id), não auth.users(id) — resolve
    // o captador vinculado a este usuário antes de filtrar as atribuições.
    let captadorQuery = (supabase as any).from("captadores").select("id").eq("user_id", user.id);
    if (orgId) captadorQuery = captadorQuery.eq("organization_id", orgId);
    const { data: captador } = await captadorQuery.maybeSingle();
    if (!captador) { setAtribuicoes([]); return; }

    // Load my attributions (ativa status)
    let query = supabase
      .from("atribuicoes")
      .select("id, empresa_crm_id, tipo, data_inicio, captador_user_id, empresas:empresa_crm_id(nome)")
      .eq("captador_user_id", captador.id)
      .eq("status", "ativa");

    if (orgId) query = query.eq("organization_id", orgId);

    const { data: attrs } = await query;
    if (attrs) {
      setAtribuicoes(
        attrs.map((a: any) => ({
          id: a.id,
          empresa_nome: a.empresas?.nome ?? "Empresa",
          captador_nome: "", // current user
          tipo_exclusividade: a.tipo,
          data_inicio: a.data_inicio,
        }))
      );
    }

    // Load org members
    if (orgId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgMembers } = await (supabase as any)
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId);

      if (orgMembers && orgMembers.length > 0) {
        const userIds = orgMembers.map((m: any) => m.user_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (profiles) {
          setMembros(
            profiles
              .filter((p: any) => p.id !== user.id)
              .map((p: any) => ({
                user_id: p.id,
                nome: p.full_name ?? "Membro",
              }))
          );
        }
      }
    }
  }

  async function handleSalvar() {
    if (!atribuicaoId) {
      setErro("Selecione uma empresa");
      return;
    }
    if (!destinatarioId) {
      setErro("Selecione o captador de destino");
      return;
    }
    if (!motivo.trim()) {
      setErro("Informe o motivo da transferência");
      return;
    }

    setSaving(true);
    setErro(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    const { data: orgIds } = await supabase.rpc("auth_org_ids");
    const orgId = orgIds?.[0];
    if (!orgId) { setErro("Organização não encontrada"); setSaving(false); return; }

    const { error } = await (supabase as any).from("solicitacoes_transferencia").insert({
      account_id: user.id,
      organization_id: orgId,
      atribuicao_id: atribuicaoId,
      solicitante_id: user.id,
      destinatario_id: destinatarioId,
      tipo: "pendente",
      motivo: motivo.trim(),
    });

    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded shadow-2xl w-full overflow-hidden flex flex-col"
        style={{ maxWidth: 520, maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: "rgba(114,89,181,0.08)" }}>
              <ArrowRightLeft size={16} style={{ color: "#7259B5" }} />
            </div>
            <h2 className="text-[15px] font-bold text-black">Solicitar Transferência</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/5 transition">
            <X size={15} className="text-black/40" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Erro */}
          {erro && (
            <div className="px-3 py-2 rounded text-[12px] font-medium" style={{ background: "#D94E4E14", color: "#D94E4E" }}>
              {erro}
            </div>
          )}

          {/* Empresa */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Empresa</label>
            <Select
              value={atribuicaoId ?? ""}
              onChange={(e) => setAtribuicaoId(e.target.value || null)}
              className="w-full px-3 py-2 text-[13px] border rounded bg-white outline-none"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              <option value="">Selecione...</option>
              {atribuicoes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.empresa_nome} — {TIPO_EXCLUSAO_LABELS[a.tipo_exclusividade] ?? a.tipo_exclusividade}
                </option>
              ))}
            </Select>
          </div>

          {/* Destinatário */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Transferir para</label>
            {membros.length === 0 ? (
              <p className="text-[12px] text-black/30">Nenhum outro captador na organização</p>
            ) : (
              <div className="space-y-1">
                {membros.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => setDestinatarioId(m.user_id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition text-[12px]"
                    style={
                      destinatarioId === m.user_id
                        ? { background: "rgba(13,13,13,.08)", color: "#0D0D0D", fontWeight: 600 }
                        : { color: "rgba(13,13,13,.40)" }
                    }
                  >
                    <div className="w-6 h-6 rounded bg-black/5 flex items-center justify-center">
                      <User size={11} className="text-black/40" />
                    </div>
                    {m.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Motivo</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique o motivo da transferência..."
              rows={3}
              className="w-full px-3 py-2 text-[13px] border rounded bg-white outline-none resize-none"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium text-black/35 hover:text-black/55 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving || !atribuicaoId || !destinatarioId || !motivo.trim()}
            className="px-5 py-2 text-[12px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
          >
            {saving ? "Enviando..." : "Enviar Solicitação"}
          </button>
        </div>
      </div>
    </div>
  );
}
