"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building, Search } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { MODULO_LABEL, MODULOS_COM_CONTRATO, papelPodeUsarModulo } from "@/lib/equipe-modulos";
import { MODULOS_EM_CONSTRUCAO, type ModuloId } from "@/lib/modulos";
import {
  CORTESIA_MAX_DIAS, NOME_NO_TEXTO, VAGAS_CORTESIA_MAX, contratoEmVigor, contratoPago, diasEntre, hojeEmBrasilia,
  limiteDeVagas, situacaoDoContrato, validarCortesia, type ContratoModulo,
} from "@/lib/modulos-contrato";

type Contrato = ContratoModulo & {
  cortesia_motivo: string | null;
  encerrado_em: string | null;
  updated_at: string;
};

/** O contrato de um módulo na organização e quantas pessoas o usam. */
type DoModulo = { contrato: Contrato | null; com_acesso: number };

type Organizacao = {
  id: string;
  nome: string;
  created_at: string;
  membros: number;
  /** Um item por módulo com contrato (prestação e produção). */
  modulos: Partial<Record<ModuloId, DoModulo>>;
};

const SEM_CONTRATO: DoModulo = { contrato: null, com_acesso: 0 };
const doModulo = (organizacao: Organizacao, modulo: ModuloId): DoModulo => organizacao.modulos[modulo] ?? SEM_CONTRATO;

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

/** `prefixo` nomeia o módulo quando a etiqueta aparece fora da coluna dele (no celular). */
function Etiqueta({ contrato, hoje, prefixo }: { contrato: Contrato | null; hoje: string; prefixo?: string }) {
  const cor = corDaSituacao(contrato, hoje);
  if (!cor) return <span className="text-[0.75rem] text-black/30">—</span>;
  return (
    <span className="whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {prefixo ? `${prefixo}: ` : ""}{situacaoDoContrato(contrato)}
    </span>
  );
}

/** "prestação e produção": os módulos pagos que a pessoa usa, para quem não tem a captação. */
function soOsPagos(modulosAcesso: readonly string[]): string {
  if (modulosAcesso.includes("captacao")) return "";
  const pagos = MODULOS_COM_CONTRATO.filter(modulo => modulosAcesso.includes(modulo));
  return pagos.length ? ` · só ${pagos.map(modulo => NOME_NO_TEXTO[modulo].curto).join(" e ")}` : "";
}

/** O módulo que o painel mostra primeiro: o que tem cortesia (é o que o painel gerencia), senão o primeiro com contrato que não foi encerrado. */
function moduloInicial(organizacao: Organizacao): ModuloId {
  const contrato = (modulo: ModuloId) => doModulo(organizacao, modulo).contrato;
  return MODULOS_COM_CONTRATO.find(modulo => contrato(modulo)?.status === "cortesia")
    ?? MODULOS_COM_CONTRATO.find(modulo => {
      const atual = contrato(modulo);
      return atual !== null && atual.status !== "cancelado";
    })
    ?? MODULOS_COM_CONTRATO[0];
}

export default function AdminOrganizacoesPage() {
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | ModuloId>("todas");
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
      (filtro === "todas" || doModulo(o, filtro).contrato !== null) && (!termo || o.nome.toLowerCase().includes(termo)));
  }, [organizacoes, busca, filtro]);

  /** Quantas organizações têm o módulo em vigor. */
  const comContrato = (modulo: ModuloId) => organizacoes.filter(o => {
    const contrato = doModulo(o, modulo).contrato;
    return contrato !== null && contratoEmVigor(contrato);
  }).length;
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
          <h1 className="text-xl font-bold text-[#282525]">Organizações</h1>
          <p className="mt-0.5 text-sm text-black/40">
            {organizacoes.length} organizações · {MODULOS_COM_CONTRATO.map(modulo => `${comContrato(modulo)} com a ${NOME_NO_TEXTO[modulo].completo}`).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded border border-black/[.10] bg-white p-0.5" role="group" aria-label="Filtrar">
            {[
              { v: "todas" as const, l: "Todas" },
              ...MODULOS_COM_CONTRATO.map(modulo => ({ v: modulo, l: `Com ${NOME_NO_TEXTO[modulo].curto}` })),
            ].map(opcao => (
              <button
                key={opcao.v}
                type="button"
                aria-pressed={filtro === opcao.v}
                onClick={() => setFiltro(opcao.v)}
                className={`h-8 rounded px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] ${filtro === opcao.v ? "bg-black/[.05] text-[#684DB0]" : "text-black/50 hover:text-black/75"}`}
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
        <div role="alert" className="mb-4 rounded border border-[#D94A4A]/20 bg-white px-4 py-2.5 text-[0.75rem] text-[#991B1B]">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-black/[.08] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] bg-[#FAFAFA]">
              <th className={TH}>Organização</th>
              <th className={`${TH} ${SO_TELA_MAIOR}`}>Membros</th>
              {MODULOS_COM_CONTRATO.map(modulo => (
                <th key={modulo} className={`${TH} ${SO_TELA_MAIOR}`}>{MODULO_LABEL[modulo]}</th>
              ))}
              <th className={`px-4 py-3 ${SO_TELA_MAIOR}`}><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(o => (
              <tr key={o.id} className="border-t border-black/[.05] first:border-t-0">
                <td className="w-full min-w-[11rem] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setAbertaId(o.id)}
                    className="rounded text-left text-[0.8125rem] font-medium text-[#282525] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                  >
                    {o.nome}
                  </button>
                  {MODULOS_COM_CONTRATO.map(modulo => {
                    const motivo = doModulo(o, modulo).contrato?.cortesia_motivo;
                    return motivo ? (
                      <p key={modulo} className="mt-0.5 line-clamp-1 text-[0.6875rem] text-black/40">{MODULO_LABEL[modulo]}: {motivo}</p>
                    ) : null;
                  })}
                  {/* As colunas dos módulos só cabem a partir de sm: no celular as situações vêm aqui, com o nome do módulo. */}
                  <div className="mt-1.5 flex flex-col items-start gap-1 sm:hidden">
                    {MODULOS_COM_CONTRATO.map(modulo => {
                      const contrato = doModulo(o, modulo).contrato;
                      return contrato ? <Etiqueta key={modulo} contrato={contrato} hoje={hoje} prefixo={MODULO_LABEL[modulo]} /> : null;
                    })}
                  </div>
                </td>
                <td className={`px-4 py-3 text-[0.8125rem] tabular-nums text-black/55 ${SO_TELA_MAIOR}`}>{o.membros}</td>
                {MODULOS_COM_CONTRATO.map(modulo => {
                  const { contrato, com_acesso: comAcesso } = doModulo(o, modulo);
                  return (
                    <td key={modulo} className={`px-4 py-3 ${SO_TELA_MAIOR}`}>
                      <Etiqueta contrato={contrato} hoje={hoje} />
                      {contrato && (
                        <span className="mt-1 block whitespace-nowrap text-[0.6875rem] tabular-nums text-black/45">
                          {comAcesso} de {limiteDeVagas(contrato)} vagas
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 text-right ${SO_TELA_MAIOR}`}>
                  <button
                    type="button"
                    onClick={() => setAbertaId(o.id)}
                    className="whitespace-nowrap rounded border border-black/[.10] bg-white px-3 py-1.5 text-[0.75rem] text-black/60 transition hover:border-black/25 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
                  >
                    {MODULOS_COM_CONTRATO.some(modulo => {
                      const contrato = doModulo(o, modulo).contrato;
                      return contrato !== null && contrato.status !== "cancelado";
                    }) ? "Gerenciar" : "Liberar cortesia"}
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
              {filtro !== "todas" ? `Nenhuma organização tem a ${NOME_NO_TEXTO[filtro].curto}. Use “Todas” para liberar uma cortesia.` : "Nenhuma organização encontrada."}
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

type Formulario = { ate: string; vagas: string; motivo: string };

/** O que o formulário da cortesia mostra ao abrir: a cortesia que existe ou uma nova, de 30 dias. */
function formularioInicial(organizacao: Organizacao, modulo: ModuloId, hoje: string): Formulario {
  const { contrato, com_acesso: comAcesso } = doModulo(organizacao, modulo);
  const emCortesia = contrato?.status === "cortesia";
  return {
    ate: emCortesia && contrato.cortesia_ate && contrato.cortesia_ate >= hoje ? contrato.cortesia_ate : somarDias(hoje, 30),
    vagas: String(emCortesia ? contrato.vagas_cortesia : Math.max(1, comAcesso)),
    motivo: emCortesia ? contrato.cortesia_motivo ?? "" : "",
  };
}

function PainelOrganizacao({ organizacao, hoje, onClose, onMudou }: {
  organizacao: Organizacao;
  hoje: string;
  onClose: () => void;
  onMudou: () => Promise<unknown>;
}) {
  const { confirmDelete } = useDeleteConfirm();
  // Um contrato por módulo pago: o painel mostra o do módulo escolhido.
  const [modulo, setModulo] = useState<ModuloId>(() => moduloInicial(organizacao));
  const textos = NOME_NO_TEXTO[modulo];
  const { contrato, com_acesso: comAcesso } = doModulo(organizacao, modulo);
  const pago = contratoPago(contrato);
  const emCortesia = contrato?.status === "cortesia";
  const emVigor = contrato !== null && contratoEmVigor(contrato);

  // Cada módulo guarda o que foi digitado: trocar de módulo não perde o outro formulário.
  const [formularios, setFormularios] = useState(() =>
    Object.fromEntries(MODULOS_COM_CONTRATO.map(m => [m, formularioInicial(organizacao, m, hoje)])) as Record<ModuloId, Formulario>);
  const { ate, vagas, motivo } = formularios[modulo];
  const mudar = (campo: keyof Formulario, valor: string) =>
    setFormularios(atual => ({ ...atual, [modulo]: { ...atual[modulo], [campo]: valor } }));
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

  function escolherModulo(novo: ModuloId) {
    setModulo(novo);
    setErroForm(null);
    setAviso(null);
  }

  async function enviar(corpo: Record<string, unknown>) {
    const res = await fetch("/api/admin/modulos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: organizacao.id, modulo, ...corpo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
    return data;
  }

  async function liberar() {
    const pedido = { ate, motivo, vagas: Number(vagas) };
    const invalido = validarCortesia(pedido, comAcesso, hoje, modulo);
    if (invalido) { setErroForm(invalido); return; }
    setSalvando(true);
    setErroForm(null);
    setAviso(null);
    try {
      await enviar({ acao: "liberar", ...pedido });
      await onMudou();
      setAviso(`Cortesia ${emCortesia ? "atualizada" : "liberada"} até ${ate.split("-").reverse().join("/")}. Agora escolha quem usa a ${textos.curto}.`);
    } catch (e) {
      setErroForm(mensagem(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  function encerrar() {
    confirmDelete({
      title: "Encerrar a cortesia?",
      description: `Os membros de ${organizacao.nome} deixam de abrir a ${textos.completo} agora. Os dados continuam guardados e voltam com uma nova cortesia ou assinatura.`,
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
              className="rounded acao-salvar px-4 py-2.5 text-[0.8125rem] text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-60"
            >
              {salvando ? "Salvando…" : emCortesia ? "Salvar cortesia" : "Liberar cortesia"}
            </button>
          )}
        </>
      )}
    >
      {MODULOS_COM_CONTRATO.length > 1 && (
        <div className="mb-5 flex rounded border border-black/[.10] bg-white p-0.5" role="group" aria-label="Módulo">
          {MODULOS_COM_CONTRATO.map(m => (
            <button
              key={m}
              type="button"
              aria-pressed={modulo === m}
              onClick={() => escolherModulo(m)}
              className={`h-8 flex-1 rounded px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] ${modulo === m ? "bg-black/[.05] text-[#684DB0]" : "text-black/50 hover:text-black/75"}`}
            >
              {MODULO_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      <section aria-labelledby="cortesia-titulo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 id="cortesia-titulo" className="text-[0.8125rem] font-semibold text-black/80">Cortesia da {textos.completo}</h4>
          <Etiqueta contrato={contrato} hoje={hoje} />
        </div>

        {MODULOS_EM_CONSTRUCAO.includes(modulo) && (
          <p className="mb-3 text-[0.6875rem] text-black/45">Módulo em construção: libere só para organizações piloto.</p>
        )}

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
                  onChange={e => mudar("ate", e.target.value)}
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
                  onChange={e => mudar("vagas", e.target.value)}
                  className="h-10 w-full rounded border border-black/[.12] px-3 text-[0.8125rem] tabular-nums outline-none focus:border-[#7259B5]"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] text-black/55">Motivo</span>
              <textarea
                value={motivo}
                onChange={e => mudar("motivo", e.target.value)}
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
          <h4 id="membros-titulo" className="text-[0.8125rem] font-semibold text-black/80">Quem usa a {textos.curto}</h4>
          {contrato && <span className="text-[0.6875rem] tabular-nums text-black/45">{comAcesso} de {limite} vagas</span>}
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
              const temAcesso = m.modulos_acesso.includes(modulo);
              const externo = !papelPodeUsarModulo(m.papel, modulo);
              const nome = m.nome ?? m.email ?? "Sem nome";
              const bloqueado = alterando !== null || externo || (!temAcesso && !emVigor);
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] text-[#282525]">{nome}</p>
                    <p className="truncate text-[0.6875rem] text-black/40">
                      {PAPEL_LABEL[m.papel] ?? m.papel}{m.email && m.nome ? ` · ${m.email}` : ""}
                      {soOsPagos(m.modulos_acesso)}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={temAcesso}
                    aria-label={`${temAcesso ? "Tirar" : "Dar"} acesso à ${textos.curto} para ${nome}`}
                    title={externo ? "Captadores e proponentes externos usam só a captação" : undefined}
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
