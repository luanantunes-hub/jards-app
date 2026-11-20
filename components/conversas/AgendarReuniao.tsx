"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { TopSheet } from "@/components/ui/TopSheet";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { DURACOES, DURACAO_PADRAO, type PlataformaDaReuniao } from "@/lib/reunioes/agendar";
import { createClient } from "@/lib/supabase/client";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** Uma data no formato do campo datetime-local, na hora local de quem está usando. */
function paraOCampo(quando: Date): string {
  return new Date(quando.getTime() - quando.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** A sugestão de horário: daqui a `minutos`, arredondada para a meia hora seguinte. */
function proximaMeiaHora(minutos: number): string {
  const quando = new Date(Date.now() + minutos * 60_000);
  quando.setSeconds(0, 0);
  quando.setMinutes(quando.getMinutes() > 30 ? 60 : 30);
  return paraOCampo(quando);
}

/**
 * Marca uma reunião: o Jards cria o evento no calendário de quem está marcando e a sala junto — Meet pela agenda
 * do Google, Teams pela do Outlook — e convida os participantes.
 */
export function AgendarReuniao({ onClose, onAgendada }: { onClose: () => void; onAgendada: (titulo: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();
  const [titulo, setTitulo] = useState("");
  const [plataforma, setPlataforma] = useState<PlataformaDaReuniao>("google_meet");
  const [quando, setQuando] = useState(() => proximaMeiaHora(60));
  const [duracao, setDuracao] = useState(String(DURACAO_PADRAO));
  const [participantes, setParticipantes] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string }>>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaConectar, setPrecisaConectar] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any).from("empresas_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(200)
      .then(({ data }: { data: Array<{ id: string; nome: string }> | null }) => setEmpresas(data ?? []));
  }, [organizationId, supabase]);

  async function agendar(fechar: () => void) {
    setSalvando(true);
    setErro(null);
    setPrecisaConectar(false);
    try {
      const resposta = await fetch("/api/reunioes/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          titulo,
          plataforma,
          comeca: new Date(quando).toISOString(),
          duracaoMin: Number(duracao),
          participantes: participantes.split(/[\s,;]+/).map((parte) => parte.trim()).filter(Boolean),
          empresaCrmId: empresaId || null,
        }),
      });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string; conectar?: string };
      if (!resposta.ok) {
        setPrecisaConectar(Boolean(json.conectar));
        throw new Error(json.error || "Não foi possível marcar a reunião.");
      }
      onAgendada(titulo);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível marcar a reunião.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TopSheet
      titulo="Agendar reunião"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void agendar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Marcando…" : "Agendar"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && (
          <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>
            {erro}
            {precisaConectar && <> <Link href="/configuracoes?section=ferramentas" className="font-medium underline underline-offset-2">Abrir Minhas ferramentas</Link></>}
          </p>
        )}
        <div>
          <label className={ROTULO} htmlFor="reuniao-titulo">Nome da reunião</label>
          <input id="reuniao-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Alinhamento de cotas" disabled={salvando} />
        </div>
        <div>
          <span className={ROTULO}>Onde</span>
          <SegmentedControl<PlataformaDaReuniao>
            ariaLabel="Plataforma da reunião"
            value={plataforma}
            onChange={setPlataforma}
            options={[{ value: "google_meet", label: "Google Meet" }, { value: "teams", label: "Microsoft Teams" }]}
          />
          <p className="mt-1.5 text-[0.6875rem] text-black/35">A sala é criada junto com o evento, na sua {plataforma === "google_meet" ? "Google Agenda" : "agenda do Outlook"}.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_8.5rem]">
          <div>
            <label className={ROTULO} htmlFor="reuniao-quando">Quando</label>
            <input id="reuniao-quando" type="datetime-local" className={CAMPO} value={quando} min={paraOCampo(new Date())} onChange={event => setQuando(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <span className={ROTULO}>Duração</span>
            <CustomDropdown value={duracao} onChange={setDuracao} options={DURACOES.map(min => ({ value: String(min), label: min >= 60 ? `${min / 60} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min` }))} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full" />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="reuniao-participantes">Convidados</label>
          <input id="reuniao-participantes" className={CAMPO} value={participantes} onChange={event => setParticipantes(event.target.value)} placeholder="nome@empresa.com.br" disabled={salvando} />
          <p className="mt-1.5 text-[0.6875rem] text-black/35">Cada pessoa recebe o convite do seu calendário, com o link da sala.</p>
        </div>
        <div>
          <span className={ROTULO}>Empresa</span>
          <CustomDropdown value={empresaId} onChange={setEmpresaId} options={[{ value: "", label: "Sem empresa" }, ...empresas.map(empresa => ({ value: empresa.id, label: empresa.nome }))]} placeholder="Sem empresa" compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full" />
        </div>
      </div>
    </TopSheet>
  );
}
