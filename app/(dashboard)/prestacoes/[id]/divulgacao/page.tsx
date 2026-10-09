"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Ban, Clock, ExternalLink, FileText, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { PecaModal } from "@/components/prestacao/divulgacao/PecaModal";
import type { Achado } from "@/lib/prestacao/checagens";
import { checarPecas } from "@/lib/prestacao/checagens/checar-pecas";
import {
  defesosDaPeca,
  divulgacaoDoRegime,
  marcasEsperadas,
  marcasFaltando,
  periodoDaVeiculacao,
  rotuloDoTipoPeca,
  situacaoDaAprovacao,
  type DefesoEleitoral,
} from "@/lib/prestacao/pecas";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import type { PrestacaoPeca } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "inline-flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const ALERTA = <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />;
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const hoje = () => new Date().toISOString().slice(0, 10);

function Avisos({ achados }: { achados: readonly Achado[] }) {
  if (achados.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {achados.map(a => {
        const bloqueio = a.severidade === "bloqueio" && !a.justificativa;
        const Icone = bloqueio ? Ban : AlertTriangle;
        return (
          <li key={a.chave} className={`flex items-start gap-1 text-[0.6875rem] ${a.justificativa ? "text-black/45" : "text-black/60"}`}>
            <Icone size={12} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${a.justificativa ? "text-black/40" : bloqueio ? "text-[#D94A4A]" : "text-[#B07A14]"}`} aria-hidden />
            <span>{a.mensagem}{a.justificativa ? ` Justificativa: ${a.justificativa}` : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Marcas({ p, regime, defesos }: { p: PrestacaoPeca; regime: RegimeNormativo | null; defesos: readonly DefesoEleitoral[] }) {
  const esperadas = marcasEsperadas(regime, defesosDaPeca(p, defesos).length > 0);
  if (esperadas.length === 0) return <span className="text-black/60">{p.marcas.length ? p.marcas.length : "—"}</span>;
  const faltam = marcasFaltando(p, esperadas).length;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-black/60">
      {faltam > 0 && <AlertTriangle size={12} strokeWidth={1.75} role="img" aria-label="Faltam marcas" className="shrink-0 text-[#B07A14]" />}
      {esperadas.length - faltam} de {esperadas.length}
    </span>
  );
}

function Amostra({ p, onAbrir }: { p: PrestacaoPeca; onAbrir: (p: PrestacaoPeca) => void }) {
  if (!p.storage_path && !p.url) return <span className="text-black/30">—</span>;
  const Icone = p.storage_path ? FileText : ExternalLink;
  return (
    <button type="button" onClick={() => onAbrir(p)} aria-label={`Abrir a amostra de ${p.titulo}`} className="inline-flex items-center gap-1 rounded text-black/60 underline decoration-black/20 underline-offset-2 transition hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
      <Icone size={11} aria-hidden /> {p.storage_path ? "Arquivo" : "Link"}
    </button>
  );
}

export default function DivulgacaoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const podeEditar = permissoes.editar;
  const { confirmDelete } = useDeleteConfirm();
  const regimes = useRegimesPublicados();
  const organizationId = usePrestacaoOrganizacao(id);

  const [pecas, setPecas] = useState<PrestacaoPeca[]>([]);
  const [defesos, setDefesos] = useState<DefesoEleitoral[]>([]);
  const [regimeId, setRegimeId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<PrestacaoPeca | "nova" | null>(null);
  const abriuDoLink = useRef(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [p, c, r] = await Promise.all([
      db.from("prestacao_pecas").select("*").eq("prestacao_id", id).order("ordem").order("created_at"),
      db.from("calendario_regulatorio").select("inicio, fim, descricao").eq("tipo", "defeso_eleitoral").order("inicio"),
      db.from("prestacoes_contas").select("regime_id").eq("id", id).maybeSingle(),
    ]);
    const falha = p.error ?? c.error ?? r.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar as peças") : "",
      pecas: (p.data ?? []) as PrestacaoPeca[],
      defesos: (c.data ?? []) as DefesoEleitoral[],
      regimeId: (r.data?.regime_id ?? null) as string | null,
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setPecas(dados.pecas);
    setDefesos(dados.defesos);
    setRegimeId(dados.regimeId);
    setCarregando(false);
    // Link das verificações: ?peca=<id> abre a peça, só na primeira leitura.
    if (!abriuDoLink.current) {
      abriuDoLink.current = true;
      const peca = dados.pecas.find(x => x.id === new URLSearchParams(window.location.search).get("peca"));
      if (peca) setEditando(peca);
    }
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const regime = useMemo(() => regimes.find(r => r.id === regimeId)?.regime ?? null, [regimes, regimeId]);
  const divulgacao = useMemo(() => divulgacaoDoRegime(regime), [regime]);

  // A conferência do motor, para mostrar em cada peça.
  const achadosPorPeca = useMemo(() => {
    const achados = checarPecas({
      regime, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
      pecas, defesos,
    });
    const mapa = new Map<string, Achado[]>();
    for (const a of achados) if (a.entidade.id) mapa.set(a.entidade.id, [...(mapa.get(a.entidade.id) ?? []), a]);
    return mapa;
  }, [regime, pecas, defesos]);

  const placar = useMemo(() => {
    const dia = hoje();
    const circularam = pecas.filter(p => p.veiculacao_inicio && p.veiculacao_inicio <= dia);
    return {
      circularam: circularam.length,
      semAprovacao: pecas.filter(p => achadosPorPeca.get(p.id)?.some(a => a.codigo === "PECA_SEM_APROVACAO")).length,
      comMarcaFaltando: pecas.filter(p => achadosPorPeca.get(p.id)?.some(a => a.codigo === "PECA_MARCA_FALTANDO" || a.codigo === "PECA_MARCA_NO_DEFESO")).length,
      semAmostra: circularam.filter(p => !p.storage_path && !p.url).length,
    };
  }, [pecas, achadosPorPeca]);

  const defesoAtual = divulgacao?.defeso ? defesos[defesos.length - 1] ?? null : null;

  async function abrirAmostra(p: PrestacaoPeca) {
    if (p.url && !p.storage_path) { window.open(p.url, "_blank", "noopener,noreferrer"); return; }
    if (!p.storage_path) return;
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(p.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  function salvou() {
    setEditando(null);
    carregar();
    pedirVerificacao(id);
  }

  function excluir(p: PrestacaoPeca) {
    confirmDelete({
      title: "Excluir peça?",
      description: `"${p.titulo}" sai da divulgação${p.storage_path ? ", com a amostra anexada" : ""}.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_pecas ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_pecas").delete().eq("id", p.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a peça"));
        if (p.storage_path) await supabase.storage.from("documentos").remove([p.storage_path]);
        await carregar();
        pedirVerificacao(id);
      },
    });
  }

  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Divulgação</h2>
          <p className="text-[0.6875rem] text-black/45">Peças de divulgação com as marcas, a aprovação prévia e a amostra para o relatório final.</p>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando("nova")}
            className="flex h-9 items-center gap-1.5 rounded bg-[#282525] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]"
          >
            <Plus size={13} aria-hidden /> Nova peça
          </button>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={BORDA}>{erro}</p>}

      {/* O que o regime pede */}
      {divulgacao && (
        <div className="space-y-1.5 rounded border bg-white px-5 py-3 text-[0.6875rem]" style={BORDA}>
          <p><span className="text-black/40">Marcas do regime: </span><span className="text-black/75">{divulgacao.marcas.join(" · ")}</span></p>
          <p><span className="text-black/40">Aprovação prévia: </span><span className="text-black/75">{divulgacao.aprovacaoPrevia.exigida ? divulgacao.aprovacaoPrevia.descricao : "o regime não pede."}</span></p>
          {defesoAtual && divulgacao.defeso && (
            <p className="flex items-start gap-1 text-black/60">
              <Clock size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />
              <span>Defeso eleitoral de {dataBr(defesoAtual.inicio)} a {dataBr(defesoAtual.fim)}: {divulgacao.defeso.descricao}</span>
            </p>
          )}
        </div>
      )}

      {!carregando && pecas.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded border bg-white px-5 py-3 text-[0.6875rem]" style={BORDA}>
          <div className="flex items-center gap-1.5"><dt className={ROTULO}>Peças</dt><dd className="font-semibold tabular-nums text-[#282525]">{pecas.length}</dd></div>
          <div className="flex items-center gap-1.5"><dt className={ROTULO}>Já circularam</dt><dd className={`font-semibold tabular-nums ${placar.circularam ? "text-[#282525]" : "text-black/30"}`}>{placar.circularam}</dd></div>
          {placar.semAprovacao > 0 && <div className="flex items-center gap-1.5"><dt className={ROTULO}>{ALERTA}Circularam sem aprovação</dt><dd className="font-semibold tabular-nums text-[#282525]">{placar.semAprovacao}</dd></div>}
          {placar.comMarcaFaltando > 0 && <div className="flex items-center gap-1.5"><dt className={ROTULO}>{ALERTA}Com marca a corrigir</dt><dd className="font-semibold tabular-nums text-[#282525]">{placar.comMarcaFaltando}</dd></div>}
          {placar.semAmostra > 0 && <div className="flex items-center gap-1.5"><dt className={ROTULO}>{ALERTA}Sem amostra</dt><dd className="font-semibold tabular-nums text-[#282525]">{placar.semAmostra}</dd></div>}
        </dl>
      )}

      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="pecas-titulo">
        <div className="border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="pecas-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Peças <span className="font-normal tabular-nums text-black/35">({pecas.length})</span></h3>
        </div>
        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : pecas.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Megaphone size={22} className="mx-auto text-black/20" aria-hidden />
            <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma peça cadastrada.</p>
            <p className="mx-auto max-w-[30rem] text-[0.6875rem] text-black/35">
              {podeEditar
                ? "Cadastre cartazes, posts, vídeos e placas com as marcas que aparecem, a aprovação prévia e a amostra, que entra no relatório final."
                : "Quem edita a prestação cadastra as peças."}
            </p>
          </div>
        ) : (
          <>
            {/* Computador: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <th className={`${CABECALHO} w-full`}>Peça</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Veiculação</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Marcas</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Aprovação</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Amostra</th>
                    {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {pecas.map(p => {
                    const defeso = defesosDaPeca(p, defesos).length > 0 && Boolean(divulgacao?.defeso);
                    return (
                      <tr key={p.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="px-4 py-3">
                          <p className="text-black/80">{p.titulo}</p>
                          <p className="text-[0.625rem] text-black/40">{rotuloDoTipoPeca(p.tipo)}{p.meio ? ` · ${p.meio}` : ""}</p>
                          <Avisos achados={achadosPorPeca.get(p.id) ?? []} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[0.6875rem] tabular-nums text-black/60">
                          {periodoDaVeiculacao(p) ?? <span className="text-black/30">—</span>}
                          {defeso && (
                            <span className="flex items-center gap-1 text-[0.625rem] text-black/45">
                              <Clock size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                              no defeso
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[0.6875rem] tabular-nums"><Marcas p={p} regime={regime} defesos={defesos} /></td>
                        <td className="min-w-[10rem] px-4 py-3 text-[0.6875rem] text-black/60">{situacaoDaAprovacao(p, regime, hoje()).texto}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[0.6875rem]"><Amostra p={p} onAbrir={abrirAmostra} /></td>
                        {podeEditar && (
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            <button type="button" onClick={() => setEditando(p)} aria-label={`Editar ${p.titulo}`} className={botaoIcone}><Pencil size={13} /></button>
                            <button type="button" onClick={() => excluir(p)} aria-label={`Excluir ${p.titulo}`} className={botaoExcluir}><Trash2 size={13} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <ul className="divide-y divide-black/[.05] md:hidden">
              {pecas.map(p => (
                <li key={p.id} className="space-y-2 px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.75rem] text-black/80">{p.titulo}</p>
                      <p className="text-[0.625rem] text-black/40">{rotuloDoTipoPeca(p.tipo)}{p.meio ? ` · ${p.meio}` : ""}</p>
                    </div>
                    {podeEditar && (
                      <div className="flex shrink-0 items-center">
                        <button type="button" onClick={() => setEditando(p)} aria-label={`Editar ${p.titulo}`} className={botaoIcone}><Pencil size={13} /></button>
                        <button type="button" onClick={() => excluir(p)} aria-label={`Excluir ${p.titulo}`} className={botaoExcluir}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.6875rem]">
                    <dt className="text-black/40">Veiculação</dt><dd className="tabular-nums text-black/70">{periodoDaVeiculacao(p) ?? "—"}</dd>
                    <dt className="text-black/40">Marcas</dt><dd className="tabular-nums"><Marcas p={p} regime={regime} defesos={defesos} /></dd>
                    <dt className="text-black/40">Aprovação</dt><dd className="text-black/70">{situacaoDaAprovacao(p, regime, hoje()).texto}</dd>
                    <dt className="text-black/40">Amostra</dt><dd><Amostra p={p} onAbrir={abrirAmostra} /></dd>
                  </dl>
                  <Avisos achados={achadosPorPeca.get(p.id) ?? []} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {editando && (
        <PecaModal
          prestacaoId={id}
          organizationId={organizationId}
          peca={editando === "nova" ? null : editando}
          regime={regime}
          divulgacao={divulgacao}
          defesos={defesos}
          onClose={() => setEditando(null)}
          onSaved={salvou}
        />
      )}
    </div>
  );
}
