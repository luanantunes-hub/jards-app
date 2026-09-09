"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Pencil, Shield, UserCheck, Building2, Check, FileStack } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CAPTADOR_ICON_OPTIONS, type IdentityType } from "@/components/ui/ProjectIdentity";
import { IdentityPickerPopup } from "@/components/ui/IdentityPickerPopup";
import AdicionarCaptadorModal from "@/components/modals/AdicionarCaptadorModal";
import { NegotiationsTable, type CaptacaoRow } from "@/components/company/NegotiationsTable";
import { InscricoesTable, type EditalRow } from "@/components/company/InscricoesTable";
import { DetailHeaderAction, DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CaptadorOverview, type CaptadorOverviewData } from "@/components/captadores/CaptadorOverview";
import { CaptadorRelationshipScorecard } from "@/components/relationship/DecisionScorecard";

type CaptadorDetalhe = {
  id: string;
  organization_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  agencia: string | null;
  prioridade: "alta" | "media" | "baixa";
  user_id: string | null;
  logo_url: string | null;
  identidade_tipo: IdentityType | null;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  created_at: string;
};

type AtribuicaoRow = {
  id: string;
  tipo: string;
  status: string;
  dias_sem_avanco: number | null;
  empresa_crm: { id: string; nome: string; domain_key: string | null; site: string | null } | null;
  projeto: { id: string; nome: string } | null;
};

const EXC_LABEL: Record<string, string> = { exclusividade_empresa: "Exclusiva", compartilhada: "Compartilhada" };
const STATUS_ATRIB: Record<string, { label: string; color: string }> = {
  ativa: { label: "Ativa", color: "#1A8B7A" },
  suspensa: { label: "Suspensa", color: "#B07A14" },
  expirada: { label: "Expirada", color: "#D94E4E" },
  transferida: { label: "Transferida", color: "#2D72B0" },
  cancelada: { label: "Cancelada", color: "rgba(13,13,13,.40)" },
};

type PageTab = "overview" | "negociacoes" | "inscricoes" | "atribuicoes";

export default function CaptadorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [captador, setCaptador] = useState<CaptadorDetalhe | null>(null);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoRow[]>([]);
  const [negociacoes, setNegociacoes] = useState<CaptacaoRow[]>([]);
  const [inscricoes, setInscricoes] = useState<EditalRow[]>([]);
  const [overview, setOverview] = useState<CaptadorOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: row, error } = await (supabase as any).from("captadores").select("*").eq("id", id).single();
    if (error || !row) {
      setCaptador(null);
      setLoading(false);
      return;
    }
    const captadorData = row as CaptadorDetalhe;
    setCaptador(captadorData);

    const negociacoesSelect = "id,titulo,status,valor_solicitado,potencial_fechamento,proxima_prospeccao,data_previsao,created_at,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)";
    const inscricoesSelect = "id,titulo,status,created_at,valor,data_fechamento,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)";
    const inscricoesFiltro = captadorData.user_id
      ? `and(responsavel_tipo.eq.agencia,responsavel_id.eq.${id}),and(responsavel_tipo.eq.membro,responsavel_id.eq.${captadorData.user_id})`
      : `and(responsavel_tipo.eq.agencia,responsavel_id.eq.${id})`;

    const [atribRes, negExtRes, negIntRes, inscRes, overviewRes] = await Promise.all([
      (supabase as any)
        .from("atribuicoes")
        .select("id,tipo,status,dias_sem_avanco,empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site),projeto:projetos_crm!projeto_id(id,nome)")
        .eq("captador_user_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("captacoes")
        .select(negociacoesSelect)
        .eq("captador_externo_id", id)
        .order("updated_at", { ascending: false }),
      captadorData.user_id
        ? (supabase as any)
            .from("captacoes")
            .select(negociacoesSelect)
            .eq("captador_id", captadorData.user_id)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      (supabase as any)
        .from("editais_user")
        .select(inscricoesSelect)
        .or(inscricoesFiltro)
        .order("updated_at", { ascending: false }),
      (supabase as any).rpc("fn_captador_overview", { p_captador_id: id }),
    ]);

    setAtribuicoes((atribRes.data ?? []) as AtribuicaoRow[]);
    setNegociacoes([...(negExtRes.data ?? []), ...(negIntRes.data ?? [])] as CaptacaoRow[]);
    setInscricoes((inscRes.data ?? []) as EditalRow[]);
    setOverview(overviewRes.error ? null : overviewRes.data as CaptadorOverviewData);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function saveIdentity(tipo: IdentityType, valor: string | null, logoUrl: string | null = null, cor: string | null = null) {
    setIdentitySaving(true);
    // Campos de identidade ainda não constam no tipo gerado do Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("captadores")
      .update({
        identidade_tipo: tipo,
        identidade_valor: valor,
        identidade_logo_url: logoUrl,
        identidade_cor: cor,
      })
      .eq("id", id);

    if (!error) {
      setCaptador(current => current ? {
        ...current,
        identidade_tipo: tipo,
        identidade_valor: valor,
        identidade_logo_url: logoUrl,
        identidade_cor: cor,
      } : current);
    } else {
      console.error("Erro ao salvar identidade do captador:", error.message);
    }
    setIdentitySaving(false);
  }

  function handleIdentityLogo(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const cropSize = Math.min(image.width, image.height);
      const sourceX = (image.width - cropSize) / 2;
      const sourceY = (image.height - cropSize) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      canvas.getContext("2d")?.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);
      await saveIdentity("logo", null, canvas.toDataURL("image/webp", .88));
    };
    image.onerror = () => URL.revokeObjectURL(objectUrl);
    image.src = objectUrl;
  }

  if (loading) return <CaptadorSkeleton />;
  if (!captador) return <CaptadorNotFound />;

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <Link href="/captadores" className="mb-7 inline-flex items-center gap-2 text-[12px] font-medium text-black/40 transition hover:text-black/65">
            <ArrowLeft size={14} /> Captadores
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <IdentityPickerPopup
                nome={captador.nome}
                tipo={captador.identidade_tipo ?? (captador.logo_url ? "logo" : "padrao")}
                valor={captador.identidade_valor}
                logoUrl={captador.identidade_logo_url ?? captador.logo_url}
                cor={captador.identidade_cor}
                iconOptions={CAPTADOR_ICON_OPTIONS}
                saving={identitySaving}
                title="Identidade do captador"
                onSave={saveIdentity}
                onLogoFile={handleIdentityLogo}
                triggerLabel="Alterar identidade do captador"
              />
              <div className="min-w-0">
                {captador.user_id && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: "#2E8932" }}>
                      <Check size={9} /> Workspace
                    </span>
                  </div>
                )}
                <h1 className="max-w-4xl text-[32px] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[38px]">{captador.nome}</h1>
                <p className="mt-2 text-sm text-black/50">{captador.agencia || "Agência independente"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {captador.email && (
                <DetailHeaderAction label="Enviar e-mail" icon={Mail} href={`mailto:${captador.email}`} />
              )}
              <DetailHeaderAction label="Editar" icon={Pencil} onClick={() => setShowEditModal(true)} />
            </div>
          </div>
        </div>
      </header>

      <DetailTabs
        ariaLabel="Seções do captador"
        activeTab={pageTab}
        onChange={value => setPageTab(value as PageTab)}
        tabs={[
          { id: "overview", label: "Visão geral", icon: UserCheck },
          { id: "negociacoes", label: "Negociações", icon: Building2, count: negociacoes.length },
          { id: "inscricoes", label: "Inscrições", icon: FileStack, count: inscricoes.length },
          { id: "atribuicoes", label: "Atribuições", icon: Shield, count: atribuicoes.length },
        ]}
      />

      <DetailPageContent>
        {pageTab === "negociacoes" ? (
          <NegotiationsTable rows={negociacoes} hideNegotiationColumn />
        ) : pageTab === "inscricoes" ? (
          <InscricoesTable rows={inscricoes} />
        ) : pageTab === "atribuicoes" ? (
          <AtribuicoesList rows={atribuicoes} />
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="w-full shrink-0 lg:w-[320px]">
              <CaptadorRelationshipScorecard captadorId={captador.id} organizationId={captador.organization_id} />
            </div>
            <div className="min-w-0 flex-1">
              <CaptadorOverview data={overview} />
            </div>
          </div>
        )}
      </DetailPageContent>

      {showEditModal && (
        <AdicionarCaptadorModal
          open
          editData={{
            id: captador.id,
            nome: captador.nome,
            prioridade: captador.prioridade,
            logo_url: captador.logo_url,
            identidade_tipo: captador.identidade_tipo,
            identidade_valor: captador.identidade_valor,
            identidade_logo_url: captador.identidade_logo_url,
            identidade_cor: captador.identidade_cor,
            email: captador.email,
            agencia: captador.agencia,
          }}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); void fetchData(); }}
        />
      )}
    </div>
  );
}

function AtribuicoesList({ rows }: { rows: AtribuicaoRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded border bg-white px-5 py-12 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <Shield size={22} className="mx-auto text-black/15" />
        <p className="mt-3 text-sm font-medium text-black/35">Nenhuma atribuição registrada</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      {rows.map(a => {
        const st = STATUS_ATRIB[a.status] ?? { label: a.status, color: "rgba(13,13,13,.4)" };
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              <CompanyLogo
                nome={a.empresa_crm?.nome ?? "Empresa"}
                domain={a.empresa_crm?.domain_key}
                site={a.empresa_crm?.site}
                size={32}
                className="flex-shrink-0"
              />
              <div className="min-w-0">
                {a.empresa_crm ? (
                  <span className="block truncate text-[13px] font-semibold text-[#0D0D0D]">
                    {a.empresa_crm.nome}
                  </span>
                ) : (
                  <span className="text-[13px] font-semibold text-black/40">—</span>
                )}
                <p className="truncate text-[11px] text-black/35">{a.projeto?.nome ?? "Todos os projetos"} · {EXC_LABEL[a.tipo] ?? a.tipo}</p>
              </div>
            </div>
            <span className="shrink-0 rounded border bg-white px-2 py-1 text-[10px] font-medium" style={{ borderColor: st.color + "47", color: st.color }}>
              {st.label}
            </span>
          </>
        );

        return a.empresa_crm ? (
          <Link
            key={a.id}
            href={`/empresas-crm/${a.empresa_crm.id}`}
            aria-label={`Abrir empresa ${a.empresa_crm.nome}`}
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5 text-inherit transition last:border-b-0 hover:bg-black/[.018] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15"
            style={{ borderColor: "rgba(13,13,13,.06)" }}
          >
            {content}
          </Link>
        ) : (
          <div key={a.id} className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function CaptadorSkeleton() {
  return (
    <div className="animate-pulse px-4 py-6 md:px-8">
      <div className="h-4 w-24 rounded bg-black/8" />
      <div className="mt-6 h-16 w-full max-w-2xl rounded bg-black/8" />
      <div className="mt-8 h-12 rounded bg-black/8" />
      <div className="mt-5 h-96 rounded bg-black/8" />
    </div>
  );
}

function CaptadorNotFound() {
  return (
    <div className="px-4 py-8 text-center md:px-8">
      <UserCheck size={30} className="mx-auto text-black/15" />
      <p className="mt-4 text-sm font-medium text-black/35">Captador não encontrado</p>
      <Link href="/captadores" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#7259B5]">
        <ArrowLeft size={12} /> Voltar para captadores
      </Link>
    </div>
  );
}
