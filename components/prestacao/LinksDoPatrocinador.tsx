"use client";

// Relatório do patrocinador por link (P5.2), na visão geral da prestação:
// os links enviados, com visitas e aceite, e a criação de um novo. O banco
// guarda só o hash: o endereço aparece uma vez, para copiar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { CampoParaCopiar } from "@/components/prestacao/CampoParaCopiar";
import {
  diaEmBrasilia,
  enderecoDoRelatorio,
  erroDoLink,
  situacaoDoLink,
  textoDasVisitas,
  textoDoPeriodo,
  type LinkDoPatrocinador,
  type SituacaoDoLink,
} from "@/lib/prestacao/relatorio-patrocinador";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const SITUACAO: Record<SituacaoDoLink, { rotulo: string; cor: string }> = {
  aceito: { rotulo: "Aceito", cor: "#2E8932" },
  ativo: { rotulo: "Ativo", cor: "#2D72B0" },
  expirado: { rotulo: "Expirado", cor: "#6B6B6B" },
  revogado: { rotulo: "Revogado", cor: "#6B6B6B" },
};

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

type Empresa = { id: string; nome: string };

function NovoLinkModal({ prestacaoId, empresas, onClose, onCriado }: {
  prestacaoId: string;
  empresas: Empresa[];
  onClose: () => void;
  onCriado: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const hoje = hojeIso();
  const [empresaId, setEmpresaId] = useState(empresas.length === 1 ? empresas[0].id : "");
  const [patrocinador, setPatrocinador] = useState(empresas.length === 1 ? empresas[0].nome : "");
  const [expiraEm, setExpiraEm] = useState(somarDias(hoje, 90));
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [endereco, setEndereco] = useState<string | null>(null);

  async function criar() {
    const problema = erroDoLink({ patrocinador, expiraEm, periodoInicio, periodoFim, mensagem }, hoje);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { data, error } = await (supabase as any).rpc("fn_prestacao_criar_link_patrocinador", {
      p_prestacao_id: prestacaoId,
      p_patrocinador: patrocinador.trim(),
      p_empresa_crm_id: empresaId || null,
      p_expira_em: expiraEm,
      p_periodo_inicio: periodoInicio || null,
      p_periodo_fim: periodoFim || null,
      p_mensagem: mensagem.trim() || null,
    });
    setSalvando(false);
    if (error || !data?.token) { setErro(mensagemErroPrestacao(error, "Não foi possível criar o link")); return; }
    setEndereco(enderecoDoRelatorio(window.location.origin, data.token));
    onCriado();
  }

  const rodape = endereco ? (
    <>
      <span />
      <button type="button" onClick={onClose} className="rounded bg-[#0D0D0D] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D]">Concluir</button>
    </>
  ) : (
    <>
      <span />
      <div className="flex items-center gap-4">
        <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
        <button type="button" onClick={criar} disabled={salvando}
          className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
          {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
          Criar link
        </button>
      </div>
    </>
  );

  return (
    <ModalPrestacao titulo="Link do relatório para o patrocinador" subtitulo="Só leitura, sem login, com aceite que vai para o CRM" onClose={onClose} rodape={rodape} largura="max-w-[36rem]">
      {endereco ? (
        <div className="space-y-3 py-4">
          <CampoParaCopiar rotulo="Endereço do relatório" valor={endereco} />
          <p className="px-6 text-[0.6875rem] text-[#B07A14]">O endereço aparece só agora: copie e envie ao patrocinador. Se perder, revogue este link e crie outro.</p>
          <a href={endereco} target="_blank" rel="noopener noreferrer" className="mx-6 inline-flex items-center gap-1 rounded text-[0.75rem] text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Ver como o patrocinador vê <ExternalLink size={11} aria-hidden />
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          {empresas.length > 0 && (
            <div className="sm:col-span-2">
              <span className={ROTULO}>Empresa no CRM</span>
              <Dropdown value={empresaId} ariaLabel="Empresa no CRM" placeholder="Nenhuma"
                onChange={v => { setEmpresaId(v); const e = empresas.find(x => x.id === v); if (e && !patrocinador.trim()) setPatrocinador(e.nome); }}
                options={[{ value: "", label: "Nenhuma" }, ...empresas.map(e => ({ value: e.id, label: e.nome }))]} />
              <span className="mt-1 block text-[0.625rem] text-black/40">Com a empresa, o aceite entra no histórico de relacionamento dela.</span>
            </div>
          )}
          <label className="sm:col-span-2">
            <span className={ROTULO}>Patrocinador (como aparece no relatório)</span>
            <input value={patrocinador} onChange={e => setPatrocinador(e.target.value)} maxLength={200} className={CAMPO} autoFocus={empresas.length !== 1} />
          </label>
          <label>
            <span className={ROTULO}>Período: de</span>
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className={`${CAMPO} tabular-nums`} />
          </label>
          <label>
            <span className={ROTULO}>até</span>
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className={`${CAMPO} tabular-nums`} />
          </label>
          <label>
            <span className={ROTULO}>Link válido até</span>
            <input type="date" value={expiraEm} min={somarDias(hoje, 1)} max={somarDias(hoje, 366)} onChange={e => setExpiraEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
          </label>
          <label className="sm:col-span-2">
            <span className={ROTULO}>Mensagem (opcional)</span>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3} maxLength={2000}
              className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
          </label>
          {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
        </div>
      )}
    </ModalPrestacao>
  );
}

export function LinksDoPatrocinador({ prestacaoId, captacaoId, projetoId, podeEditar }: {
  prestacaoId: string;
  captacaoId: string | null;
  projetoId: string | null;
  podeEditar: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [links, setLinks] = useState<LinkDoPatrocinador[] | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [novo, setNovo] = useState(false);
  const [erro, setErro] = useState("");
  const hoje = hojeIso();

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const { data, error } = await (supabase as any).from("prestacao_links_patrocinador")
      .select("id, patrocinador, expira_em, revogado_em, visualizacoes, visto_em, aceite_em, aceite_nome, periodo_inicio, periodo_fim, created_at")
      .eq("prestacao_id", prestacaoId).order("created_at", { ascending: false });
    return { links: (data ?? []) as LinkDoPatrocinador[], erro: error ? mensagemErroPrestacao(error, "Não foi possível carregar os links") : "" };
  }, [prestacaoId, supabase]);

  const carregar = useCallback(async () => {
    const lido = await buscar();
    setLinks(lido.links);
    setErro(lido.erro);
  }, [buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(lido => { if (ativo) { setLinks(lido.links); setErro(lido.erro); } });
    return () => { ativo = false; };
  }, [buscar]);

  // Os patrocinadores do projeto: a empresa da negociação e as das outras negociações do mesmo projeto.
  useEffect(() => {
    if (!captacaoId && !projetoId) return;
    let ativo = true;
    const filtro = [captacaoId ? `id.eq.${captacaoId}` : null, projetoId ? `projeto_id.eq.${projetoId}` : null].filter(Boolean).join(",");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- seleção com a empresa embutida
    (supabase as any).from("captacoes").select("empresa:empresa_crm_id(id, nome)").or(filtro).not("empresa_crm_id", "is", null)
      .then(({ data }: { data: { empresa: Empresa | null }[] | null }) => {
        if (!ativo) return;
        const mapa = new Map<string, Empresa>();
        for (const c of data ?? []) if (c.empresa) mapa.set(c.empresa.id, c.empresa);
        setEmpresas([...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      });
    return () => { ativo = false; };
  }, [captacaoId, projetoId, supabase]);

  function revogar(l: LinkDoPatrocinador) {
    confirmDelete({
      title: "Revogar o link?",
      description: `${l.patrocinador} deixa de abrir o relatório por este link. O aceite já registrado continua no histórico.`,
      confirmLabel: "Revogar",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
        const { error } = await (supabase as any).rpc("fn_prestacao_revogar_link_patrocinador", { p_link_id: l.id });
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível revogar o link"));
        await carregar();
      },
    });
  }

  return (
    <div className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="text-[0.6875rem] font-semibold text-black/50">Relatório do patrocinador</p>
        {podeEditar && (
          <button type="button" onClick={() => setNovo(true)}
            className="inline-flex h-8 items-center gap-1 rounded border bg-white px-2.5 text-[0.6875rem] text-black/65 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.12)" }}>
            <Plus size={12} aria-hidden /> Novo link
          </button>
        )}
      </div>
      {erro && <p role="alert" className="px-4 pt-3 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      {links === null ? (
        <div className="m-4 h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
      ) : links.length === 0 ? (
        <p className="px-4 py-4 text-[0.6875rem] text-black/45">Envie ao patrocinador um link só de leitura com a execução, as metas, as contrapartidas e as fotos. O aceite dele entra no CRM.</p>
      ) : (
        <ul className="divide-y divide-black/[.05]" aria-label="Links do patrocinador">
          {links.map(l => {
            const s = SITUACAO[situacaoDoLink(l, hoje)];
            const periodo = textoDoPeriodo(l);
            return (
              <li key={l.id} className="space-y-0.5 px-4 py-3 text-[0.6875rem]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium text-black/80">{l.patrocinador}</p>
                  <span className="shrink-0 rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: s.cor + "47", color: s.cor }}>{s.rotulo}</span>
                </div>
                {periodo && <p className="text-black/45">{periodo}</p>}
                <p className="text-black/45">{l.revogado_em ? `Revogado em ${diaEmBrasilia(l.revogado_em)}` : `Válido até ${dataBr(l.expira_em)}`} · {textoDasVisitas(l)}</p>
                {l.aceite_em && <p className="text-[#2E8932]">Aceito por {l.aceite_nome} em {diaEmBrasilia(l.aceite_em)}</p>}
                {podeEditar && !l.revogado_em && (
                  <button type="button" onClick={() => revogar(l)} className="rounded text-[0.6875rem] text-black/45 underline decoration-black/20 underline-offset-2 transition hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    Revogar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {novo && <NovoLinkModal prestacaoId={prestacaoId} empresas={empresas} onClose={() => setNovo(false)} onCriado={() => void carregar()} />}
    </div>
  );
}
