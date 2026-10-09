"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { EVENTO_PERFIL_CONCLUIDO } from "@/lib/onboarding/primeiros-passos";

type Props = {
  user: User;
  organizationId: string | null;
  onComplete: (name: string) => void;
};

const inputClass = "w-full rounded border border-black/12 bg-white px-3.5 py-2.5 text-sm text-[#282525] transition focus:border-[#7259B5]/45 focus:outline-none focus:ring-2 focus:ring-[#7259B5]/10";
const dropdownClass = "w-full [&>button]:w-full [&>button]:py-2.5";

const ROLE_OPTIONS = [
  { value: "fundador_diretor", label: "Fundador(a) ou diretor(a)" },
  { value: "captacao", label: "Captação de recursos" },
  { value: "producao", label: "Produção ou gestão de projetos" },
  { value: "financeiro", label: "Financeiro ou prestação de contas" },
  { value: "comercial", label: "Comercial ou relacionamento" },
  { value: "outro", label: "Outra função" },
];

const ORGANIZATION_TYPE_OPTIONS = [
  { value: "produtora_cultural", label: "Produtora cultural" },
  { value: "organizacao_social", label: "Instituto ou organização social" },
  { value: "projeto_esportivo", label: "Projeto ou organização esportiva" },
  { value: "consultoria", label: "Consultoria ou agência" },
  { value: "empresa_patrocinadora", label: "Empresa patrocinadora" },
  { value: "profissional_independente", label: "Profissional independente" },
  { value: "outro", label: "Outro tipo" },
];

const TEAM_SIZE_OPTIONS = [
  { value: "1", label: "Só eu" },
  { value: "2_5", label: "2 a 5 pessoas" },
  { value: "6_15", label: "6 a 15 pessoas" },
  { value: "16_50", label: "16 a 50 pessoas" },
  { value: "51_mais", label: "Mais de 50 pessoas" },
];

const GOAL_OPTIONS = [
  { value: "captar_patrocinio", label: "Captar patrocínio" },
  { value: "encontrar_editais", label: "Encontrar e acompanhar editais" },
  { value: "organizar_pipeline", label: "Organizar negociações e contatos" },
  { value: "prestar_contas", label: "Gerir prestação de contas" },
  { value: "gerir_projetos", label: "Centralizar a gestão dos projetos" },
];

const SOURCE_OPTIONS = [
  { value: "indicacao", label: "Indicação de alguém" },
  { value: "google", label: "Busca no Google" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "evento", label: "Evento ou encontro" },
  { value: "outro", label: "Outro lugar" },
];

export function OnboardingModal({ user, organizationId, onComplete }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [goal, setGoal] = useState("");
  const [source, setSource] = useState("");
  const [askSource, setAskSource] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    const supabase = createClient();
    // A tipagem manual do Supabase ainda não expõe corretamente estas relações.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    Promise.all([
      db.from("profiles").select("full_name, onde_conheceu, onboarding_completed").eq("id", user.id).single(),
      db.from("organizations").select("nome").eq("id", organizationId).single(),
    ]).then(([profileResult, organizationResult]) => {
      const profile = profileResult.data as { full_name: string | null; onde_conheceu: string | null; onboarding_completed: boolean } | null;
      setName(profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "");
      setSource(profile?.onde_conheceu || "");
      setAskSource(!profile?.onde_conheceu);
      setOrganization(organizationResult.data?.nome || "");
      setVisible(profile?.onboarding_completed === false);
      setLoading(false);
    });
  }, [organizationId, user]);

  if (loading || !visible) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    if (!name.trim() || !organization.trim() || !role || !organizationType || !teamSize || !goal || !source) {
      setError("Preencha todos os campos para continuar.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    // A tipagem manual do Supabase ainda não expõe corretamente estas relações.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [profileResult, organizationResult, authResult] = await Promise.all([
      db.from("profiles").update({
        full_name: name.trim(),
        onde_conheceu: source,
        cargo_funcao: role,
        tipo_organizacao: organizationType,
        tamanho_equipe: teamSize,
        objetivo_principal: goal,
        onboarding_completed: true,
      }).eq("id", user.id),
      db.from("organizations").update({ nome: organization.trim() }).eq("id", organizationId),
      supabase.auth.updateUser({ data: { ...user.user_metadata, full_name: name.trim() } }),
    ]);

    const saveError = profileResult.error || organizationResult.error || authResult.error;
    if (saveError) {
      setError("Não foi possível salvar seus dados. Tente novamente.");
      setSaving(false);
      return;
    }

    setVisible(false);
    onComplete(name.trim());
    window.dispatchEvent(new Event(EVENTO_PERFIL_CONCLUIDO));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <section className="max-h-[96dvh] w-full overflow-y-auto rounded-t bg-white sm:max-w-xl sm:rounded">
        <header className="border-b border-black/8 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
          <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[.14em] text-[#7259B5]">Só mais um passo</p>
          <h2 id="onboarding-title" className="font-display text-2xl font-bold tracking-[-.02em] text-[#282525]">Vamos preparar o Jards para você</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-black/45">Essas respostas ajustam sua experiência e ajudam a gente a construir recursos mais úteis.</p>
        </header>

        <form onSubmit={save} className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Como podemos chamar você?">
              <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus className={inputClass} placeholder="Nome e sobrenome" />
            </Field>
            <Field label="Organização">
              <input value={organization} onChange={(event) => setOrganization(event.target.value)} required className={inputClass} placeholder="Empresa ou produtora" />
            </Field>
            <Field label="Sua função">
              <CustomDropdown value={role} onChange={setRole} options={ROLE_OPTIONS} placeholder="Selecione" emphasized={false} portalZIndex={70} className={dropdownClass} />
            </Field>
            <Field label="Tipo de organização">
              <CustomDropdown value={organizationType} onChange={setOrganizationType} options={ORGANIZATION_TYPE_OPTIONS} placeholder="Selecione" emphasized={false} portalZIndex={70} className={dropdownClass} />
            </Field>
            <Field label="Tamanho da equipe">
              <CustomDropdown value={teamSize} onChange={setTeamSize} options={TEAM_SIZE_OPTIONS} placeholder="Selecione" emphasized={false} portalZIndex={70} className={dropdownClass} />
            </Field>
            <Field label="Principal objetivo">
              <CustomDropdown value={goal} onChange={setGoal} options={GOAL_OPTIONS} placeholder="Selecione" emphasized={false} portalZIndex={70} className={dropdownClass} />
            </Field>
          </div>

          {askSource && (
            <Field label="Onde conheceu a gente?">
              <CustomDropdown value={source} onChange={setSource} options={SOURCE_OPTIONS} placeholder="Selecione uma opção" emphasized={false} portalZIndex={70} className={dropdownClass} />
            </Field>
          )}

          {error && <p role="alert" className="rounded border border-[#D94E4E]/25 px-3 py-2 text-xs text-[#D94E4E]">{error}</p>}

          <footer className="flex items-center justify-between gap-4 border-t border-black/8 pt-5">
            <button type="submit" disabled={saving} className="ml-auto inline-flex items-center gap-2 rounded border border-[#7259B5]/30 bg-white px-4 py-2.5 text-sm font-medium text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40">
              {saving ? "Salvando…" : <>Começar a usar <ArrowRight size={14} /></>}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[0.6875rem] font-medium text-black/45">{label}</span>{children}</label>;
}
