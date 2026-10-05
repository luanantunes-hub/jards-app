"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building, Search } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import {
  CORTESIA_MAX_DIAS, VAGAS_CORTESIA_MAX, contratoEmVigor, contratoPago, diasEntre, hojeEmBrasilia,
  limiteDeVagas, situacaoDoContrato, validarCortesia, type ContratoModulo,
} from "@/lib/modulos-contrato";

type Contrato = ContratoModulo & {
  cortesia_motivo: string | null;
  encerrado_em: string | null;
  updated_at: string;
};

type Organizacao = {
  id: string;
  nome: string;
  created_at: string;
  membros: number;
  com_prestacao: number;
  contrato: Contrato | null;
};

type Membro = {
  user_id: string;
  papel: string;
  modulos_acesso: string[];
  nome: string | null;
  email: string | null;
};

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  leitor: "Leitor",
  captador: "Captador externo",
  visualizador: "Colaborador",
  proponente: "Proponente",
};

const TH = "whitespace-nowrap px-4 py-3 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
/** No celular ficam a organização (que abre o painel) e a situação. */
const SO_TELA_MAIOR = "hidden sm:table-cell";

async function lerJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar");
  return data as T;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Cor da etiqueta: teal em vigor, âmbar quando pede atenção, neutro quando encerrada. */
function corDaSituacao(contrato: Contrato | null, hoje: string) {
  if (!contrato) return null;
  if (!contratoEmVigor(contrato)) return "#6B6B6B";
  if (contrato.status === "atraso") return "#B07A14";
  if (contrato.status === "cortesia") {
    if (!contrato.cortesia_ate || diasEntre(hoje, contrato.cortesia_ate) <= 7) return "#B07A14";
    return "#1A8B7A";
  }
  return "#2D72B0";
}

function Etiqueta({ contrato, hoje }: { contrato: Contrato | null; hoje: string }) {
  const cor = corDaSituacao(contrato, hoje);
  if (!cor) return <span className="text-[0.75rem] text-black/30">—</span>;
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {situacaoDoContrato(contrato)}
    </span>
  );
}

export default function AdminOrganizacoesPage() {
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [soPrestacao, setSoPrestacao] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const hoje = hojeEmBrasilia();

  const carregar = useCallback(() =>
    lerJson<{ organizacoes: Organizacao[] }>("/api/admin/modulos")
      .then(data => { setOrganizacoes(data.organizacoes); setErro(null); })
      .catch(e => setErro(mensagem(e, "Erro ao carregar as organizações")))
      .finally(() => setCarregando(false)), []);

  useEffect(() => { void carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return organizacoes.filter(o =>
      (!soPrestacao || o.contrato !== null) && (!termo || o.nome.toLowerCase().includes(termo)));
  }, [organizacoes, busca, soPrestacao]);

  const comContrato = organizacoes.filter(o => o.contrato && contratoEmVigor(o.contrato)).length;
  const aberta = organizacoes.find(o => o.id === abertaId) ?? null;

  if (carregando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#7259B5] border-t-transparent motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-pagina px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0D0D0D]">Organizações</h1>
          <p className="mt-0.5 text-sm text-black/40">
            {organizacoes.length} organizações · {comContrato} com a prestação de contas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded border border-black/[.10] bg-white p-0.5" role="group" aria-label="Filtrar">
            {[{ v: false, l: "Todas" }, { v: true, l: "Com prestação" }].map(opcao => (
              <button
                key={opcao.l}
                type="button"
                aria-pressed={soPrestacao === opcao.v}
                onClick={() => setSoPrestacao(opcao.v)}
                className={`h-8 rounded px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] ${soPrestacao === opcao.v ? "bg-[#7259B5]/[.10] text-[#684DB0]" : "text-black/50 hover:text-black/75"}`}
              >
                {opcao.l}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Buscar organização</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <input
              className="h-9 w-[15rem] rounded border border-black/[.10] bg-white pl-8 pr-3 text-[0.8125rem] outline-none focus:border-[#7259B5]"
              placeholder="Buscar organização…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </label>
        </div>
      </div>

      {erro && (
        <div role="alert" className="mb-4 rounded border border-[#D94A4A]/20 bg-[#D94A4A]/[.04] px-4 py-2.5 text-[0.75rem] text-[#991B1B]">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-black/[.08] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] bg-[#FAFAFA]">
              <th className={TH}>Organização</th>
              <th className={`${TH} ${SO_TELA_MAIOR}`}>Membros</th>
              <th className={TH}>Prestação de contas</th>
              <th className={`${TH} ${SO_TELA_MAIOR}`}>Vagas em uso</th>
              <th className={`px-4 py-3 ${SO_TELA_MAIOR}`}><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(o => (
              <tr key={o.id} className="border-t border-black/[.05] first:border-t-0">
                <td className="w-full px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setAbertaId(o.id)}
                    className="rounded text-left text-[0.8125rem] font-medium text-[#0D0D0D] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                  >
                    {o.nome}
                  </button>
                  {o.contrato?.cortesia_motivo && (
                    <p className="mt-0.5 line-clamp-1 text-[0.6875rem] text-black/40">{o.contrato.cortesia_motivo}</p>
                  )}
                </td>
                <td className={`px-4 py-3 text-[0.8125rem] tabular-nums text-black/55 ${SO_TELA_MAIOR}`}>{o.membros}</td>
                <td className="px-4 py-3"><Etiqueta contrato={o.contrato} hoje={hoje} /></td>
                <td className={`whitespace-nowrap px-4 py-3 text-[0.8125rem] tabular-nums text-black/55 ${SO_TELA_MAIOR}`}>
                  {o.contrato ? `${o.com_prestacao} de ${limiteDeVagas(o.contrato)}` : "—"}
                </td>
                <td className={`px-4 py-3 text-right ${SO_TELA_MAIOR}`}>
                  <button
                    type="button"
                    onClick={() => setAbertaId(o.id)}
                    className="whitespace-nowrap rounded border border-black/[.10] bg-white px-3 py-1.5 text-[0.75rem] text-black/60 transition hover:border-black/25 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
                  >
                    {o.contrato && o.contrato.status !== "cancelado" ? "Gerenciar" : "Liberar cortesia"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && (
          <div className="py-16 text-center">
            <Building size={28} className="mx-auto mb-2 text-black/20" />
            <p className="text-sm text-black/40">
              {soPrestacao ? "Nenhuma organização tem a prestação. Use “Todas” para liberar uma cortesia." : "Nenhuma organização encontrada."}
            </p>
          </div>
        )}
      </div>

      {aberta && (
        <PainelOrganizacao
          key={aberta.id}
          organizacao={aberta}
          hoje={hoje}
          onClose={() => setAbertaId(null)}
          onMudou={carregar}
        />
      )}
    </div>
  );
}

function PainelOrganizacao({ organizacao, hoje, onClose, onMudou }: {
  organizacao: Organizacao;
  hoje: string;
  onClose: () => void;
  onMudou: () => Promise<unknown>;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const contrato = organizacao.contrato;
  const pago = contratoPago(contrato);
  const emCortesia = contrato?.status === "cortesia";
  const emVigor = contrato !== null && contratoEmVigor(contrato);

  const [ate, setAte] = useState(() =>
    emCortesia && contrato?.cortesia_ate && contrato.cortesia_ate >= hoje ? contrato.cortesia_ate : somarDias(hoje, 30));
  const [vagas, setVagas] = useState(() =>
    String(emCortesia && contrato ? contrato.vagas_cortesia : Math.max(1, organizacao.com_prestacao)));
  const [motivo, setMotivo] = useState(() => (emCortesia ? contrato?.cortesia_motivo ?? "" : ""));
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [erroMembros, setErroMembros] = useState<string | null>(null);
  const [alterando, setAlterando] = useState<string | null>(null);

  useEffect(() => {
    lerJson<{ membros: Membro[] }>(`/api/admin/modulos?organizacao=${organizacao.id}`)
      .then(data => setMembros(data.membros))
      .catch(e => setErroMembros(mensagem(e, "Erro ao carregar os membros")));
  }, [organizacao.id]);

  async function enviar(corpo: Record<string, unknown>) {
    const res = await fetch("/api/admin/modulos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: organizacao.id, ...corpo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
    return data;
  }

  async function liberar() {
    const pedido = { ate, motivo, vagas: Number(vagas) };
    const invalido = validarCortesia(pedido, organizacao.com_prestacao, hoje);
    if (invalido) { setErroForm(invalido); return; }
    setSalvando(true);
    setErroForm(null);
    setAviso(null);
    try {
      await enviar({ acao: "liberar", ...pedido });
      await onMudou();
      setAviso(`Cortesia ${emCortesia ? "atualizada" : "liberada"} até ${ate.split("-").reverse().join("/")}. Agora escolha quem usa a prestação.`);
    } catch (e) {
      setErroForm(mensagem(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  function encerrar() {
    confirmDelete({
      title: "Encerrar a cortesia?",
      description: `Os membros de ${organizacao.nome} deixam de abrir a prestação de contas agora. Os dados continuam guardados e voltam com uma nova cortesia ou assinatura.`,
      confirmLabel: "Encerrar cortesia",
      pendingLabel: "Encerrando…",
      illustration: false,
      onConfirm: async () => {
        await enviar({ acao: "encerrar" });
        await onMudou();
        setAviso("Cortesia encerrada.");
      },
    });
  }

  async function alternarAcesso(membro: Membro, ativo: boolean) {
    setAlterando(membro.user_id);
    setErroMembros(null);
    try {
      const data = await enviar({ acao: "acesso", userId: membro.user_id, ativo });
      setMembros(atual => atual?.map(m => m.user_id === membro.user_id ? { ...m, modulos_acesso: data.modulos_acesso } : m) ?? null);
      await onMudou();
    } catch (e) {
      setErroMembros(mensagem(e, "Não foi possível alterar o acesso."));
    } finally {
      setAlterando(null);
    }
  }

  const limite = contrato ? limiteDeVagas(contrato) : 0;

  return (
    <TopSheet
      titulo={organizacao.nome}
      onClose={onClose}
      footer={close => (
        <>
          <button type="button" onClick={close} className="rounded px-3 py-2 text-[0.8125rem] text-black/50 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            Fechar
          </button>
          {!pago && (
            <button
              type="button"
              onClick={() => void liberar()}
              disabled={salvando}
              className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.8125rem] text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-60"
            >
              {salvando ? "Salvando…" : emCortesia ? "Salvar cortesia" : "Liberar cortesia"}
            </button>
          )}
        </>
      )}
    >
      <section aria-labelledby="cortesia-titulo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 id="cortesia-titulo" className="text-[0.8125rem] font-semibold text-black/80">Cortesia da prestação de contas</h4>
          <Etiqueta contrato={contrato} hoje={hoje} />
        </div>

        {pago ? (
          <p className="text-[0.75rem] text-black/50">
            A organização assina o módulo. Prazo e vagas vêm da assinatura; a cortesia não se aplica.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] text-black/55">Último dia</span>
                <input
                  type="date"
                  value={ate}
                  min={hoje}
                  max={somarDias(hoje, CORTESIA_MAX_DIAS)}
                  onChange={e => setAte(e.target.value)}
                  className="h-10 w-full rounded border border-black/[.12] px-3 text-[0.8125rem] outline-none focus:border-[#7259B5]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] text-black/55">Vagas</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={VAGAS_CORTESIA_MAX}
                  value={vagas}
                  onChange={e => setVagas(e.target.value)}
                  className="h-10 w-full rounded border border-black/[.12] px-3 text-[0.8125rem] tabular-nums outline-none focus:border-[#7259B5]"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] text-black/55">Motivo</span>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Ex.: piloto com a produtora, até a assinatura ficar pronta"
                className="w-full resize-none rounded border border-black/[.12] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#7259B5]"
              />
            </label>
            <p className="text-[0.6875rem] text-black/40">
              Os administradores da organização recebem um aviso 7 dias antes do fim. No dia seguinte ao último, o acesso é encerrado sozinho.
            </p>
            {erroForm && <p role="alert" className="text-[0.75rem] text-[#B23A3A]">{erroForm}</p>}
            {aviso && <p role="status" className="text-[0.75rem] text-[#2E8932]">{aviso}</p>}
            {emCortesia && (
              <button
                type="button"
                onClick={encerrar}
                className="rounded px-0 py-1 text-[0.75rem] text-[#B23A3A] transition hover:text-[#8F2E2E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94A4A]"
              >
                Encerrar cortesia agora
              </button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="membros-titulo" className="mt-6 border-t border-black/[.07] pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 id="membros-titulo" className="text-[0.8125rem] font-semibold text-black/80">Quem usa a prestação</h4>
          {contrato && <span className="text-[0.6875rem] tabular-nums text-black/45">{organizacao.com_prestacao} de {limite} vagas</span>}
        </div>
        {!emVigor && (
          <p className="mb-3 text-[0.6875rem] text-black/45">Libere a cortesia para dar acesso aos membros.</p>
        )}
        {erroMembros && <p role="alert" className="mb-3 text-[0.75rem] text-[#B23A3A]">{erroMembros}</p>}
        {membros === null ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1].map(i => <div key={i} className="h-11 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}
          </div>
        ) : membros.length === 0 ? (
          <p className="text-[0.75rem] text-black/40">A organização ainda não tem membros.</p>
        ) : (
          <ul className="divide-y divide-black/[.05]">
            {membros.map(m => {
              const temAcesso = m.modulos_acesso.includes("prestacao");
              const captador = m.papel === "captador";
              const nome = m.nome ?? m.email ?? "Sem nome";
              const bloqueado = alterando !== null || captador || (!temAcesso && !emVigor);
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] text-[#0D0D0D]">{nome}</p>
                    <p className="truncate text-[0.6875rem] text-black/40">
                      {PAPEL_LABEL[m.papel] ?? m.papel}{m.email && m.nome ? ` · ${m.email}` : ""}
                      {temAcesso && !m.modulos_acesso.includes("captacao") ? " · só prestação" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={temAcesso}
                    aria-label={`${temAcesso ? "Tirar" : "Dar"} acesso à prestação para ${nome}`}
                    title={captador ? "Captadores externos usam só a captação" : undefined}
                    disabled={bloqueado}
                    onClick={() => void alternarAcesso(m, !temAcesso)}
                    className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-50 ${temAcesso ? "bg-[#2E8932]" : "bg-black/15"}`}
                  >
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${temAcesso ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </TopSheet>
  );
}
