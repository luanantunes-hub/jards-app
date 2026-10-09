"use client";

// Relação de beneficiados (P8.5): quem a prestação atendeu diretamente, com
// sexo, idade, rede de ensino e benefícios. Na LIE, vira a aba BENEFICIADOS do
// formulário e mostra se a formação esportiva tem ao menos 50% de alunos da
// rede pública.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Ban, FileUp, Info, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { BeneficiadoModal } from "@/components/prestacao/beneficiarios/BeneficiadoModal";
import { ImportarBeneficiados } from "@/components/prestacao/beneficiarios/ImportarBeneficiados";
import { nomeComparavel, ordenarPorNome, resumoDosBeneficiados, ROTULO_DO_SEXO, rotuloDaRede } from "@/lib/prestacao/beneficiarios";
import type { Achado } from "@/lib/prestacao/checagens";
import { checarBeneficiarios } from "@/lib/prestacao/checagens/checar-beneficiarios";
import { regraDoRegime } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { ManifestacaoEsportiva, PrestacaoBeneficiario } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const PAGINA = 1000;
const POR_VEZ = 200;

type DadosDaPrestacao = { regime_id: string | null; manifestacao_esportiva: ManifestacaoEsportiva | null; data_fim_execucao: string | null };

const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const VALOR = (n: number) => `font-semibold tabular-nums ${n ? "text-[#0D0D0D]" : "text-black/30"}`;

/** O ícone diz a gravidade (vermelho bloqueia, âmbar alerta); o texto fica neutro. */
function Avisos({ achados }: { achados: readonly Achado[] }) {
  if (!achados.length) return null;
  return (
    <ul className="space-y-1.5 rounded border bg-white px-5 py-3" style={BORDA} aria-label="Avisos da relação">
      {achados.map(a => {
        const Icone = a.severidade === "bloqueio" ? Ban : a.severidade === "alerta" ? AlertTriangle : Info;
        const cor = a.severidade === "bloqueio" ? "text-[#D94A4A]" : a.severidade === "alerta" ? "text-[#B07A14]" : "text-black/40";
        return (
          <li key={a.chave} className="flex items-start gap-1.5 text-[0.6875rem] text-black/60">
            <Icone size={12} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${cor}`} aria-label={a.severidade === "bloqueio" ? "Bloqueia o envio" : a.severidade === "alerta" ? "Alerta" : "Aviso"} />
            <span>{a.mensagem}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function BeneficiariosPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const podeEditar = permissoes.editar;
  const { confirmDelete } = useDeleteConfirm();
  const regimes = useRegimesPublicados();

  const [lista, setLista] = useState<PrestacaoBeneficiario[]>([]);
  const [prestacao, setPrestacao] = useState<DadosDaPrestacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [mostrando, setMostrando] = useState(POR_VEZ);
  const [editando, setEditando] = useState<{ beneficiado: PrestacaoBeneficiario | null } | null>(null);
  const [importando, setImportando] = useState(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const p = await db.from("prestacoes_contas").select("regime_id, manifestacao_esportiva, data_fim_execucao").eq("id", id).maybeSingle();
    const todos: PrestacaoBeneficiario[] = [];
    let falha = p.error;
    // A relação passa de mil pessoas em projetos grandes: lê em páginas.
    for (let de = 0; !falha; de += PAGINA) {
      const r = await db.from("prestacao_beneficiarios").select("*").eq("prestacao_id", id).order("nome").order("id").range(de, de + PAGINA - 1);
      if (r.error) { falha = r.error; break; }
      todos.push(...((r.data ?? []) as PrestacaoBeneficiario[]));
      if ((r.data ?? []).length < PAGINA) break;
    }
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar os beneficiados") : "",
      lista: todos,
      prestacao: (p.data ?? null) as DadosDaPrestacao | null,
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setLista(dados.lista);
    setPrestacao(dados.prestacao);
    setCarregando(false);
  }, []);

  const carregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const regime = regimes.find(r => r.id === prestacao?.regime_id)?.regime ?? null;
  const pedeRelacao = Boolean(regraDoRegime(regime, "beneficiados"));
  const regraRede = regraDoRegime(regime, "rede_publica");
  const minimoRede = regraRede && prestacao?.manifestacao_esportiva === "formacao" ? Number(regraRede.parametros?.percentual ?? 50) : null;

  const ordenada = useMemo(() => ordenarPorNome(lista), [lista]);
  const resumo = useMemo(() => resumoDosBeneficiados(lista), [lista]);
  const achados = useMemo(() => checarBeneficiarios({
    regime, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
    prestacao: { data_fim_execucao: prestacao?.data_fim_execucao ?? null },
    manifestacaoEsportiva: prestacao?.manifestacao_esportiva ?? null,
    beneficiarios: lista,
  }), [regime, prestacao, lista]);
  const beneficiosConhecidos = useMemo(() => resumo.beneficios.map(b => b.nome), [resumo]);
  const modalidades = useMemo(() => [...new Set(lista.map(b => b.modalidade?.trim()).filter((m): m is string => Boolean(m)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [lista]);

  const filtrada = useMemo(() => {
    const termo = nomeComparavel(busca);
    if (!termo) return ordenada;
    return ordenada.filter(b => nomeComparavel(`${b.nome} ${b.modalidade ?? ""}`).includes(termo));
  }, [ordenada, busca]);
  const visiveis = filtrada.slice(0, mostrando);

  function salvou() {
    setEditando(null);
    setAviso("");
    carregar();
    pedirVerificacao(id);
  }

  function importou(quantidade: number) {
    setImportando(false);
    setAviso(`${quantidade} ${quantidade === 1 ? "beneficiado entrou" : "beneficiados entraram"} na relação.`);
    carregar();
    pedirVerificacao(id);
  }

  async function apagar(ids: string[] | null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const consulta = (supabase as any).from("prestacao_beneficiarios").delete();
    const { error } = ids ? await consulta.in("id", ids) : await consulta.eq("prestacao_id", id);
    if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir"));
    setAviso("");
    await carregar();
    pedirVerificacao(id);
  }

  function excluir(b: PrestacaoBeneficiario) {
    confirmDelete({
      title: "Excluir da relação?",
      description: `${b.nome} sai da relação de beneficiados.`,
      onConfirm: () => apagar([b.id]),
    });
  }

  function excluirTodos() {
    confirmDelete({
      title: "Excluir a relação inteira?",
      description: `Os ${lista.length} beneficiados saem da relação. Use para refazer uma importação.`,
      onConfirm: () => apagar(null),
    });
  }

  const botaoIcone = "rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const botaoExcluir = "rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]";
  const secundario = "flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]";
  const vazio = <span className="text-black/30">—</span>;

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Beneficiários</h2>
          <p className="max-w-[40rem] text-[0.6875rem] text-black/45">
            Quem o projeto atendeu diretamente, com sexo, idade, rede de ensino e benefícios.
            {pedeRelacao ? " Vai na aba BENEFICIADOS do formulário da prestação." : regime ? " O regime desta prestação não pede a relação; ela fica registrada aqui." : ""}
          </p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setImportando(true)} className={secundario} style={{ borderColor: "rgba(13,13,13,.14)" }}>
              <FileUp size={13} aria-hidden /> Importar planilha
            </button>
            <button
              type="button"
              onClick={() => setEditando({ beneficiado: null })}
              className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]"
            >
              <Plus size={13} aria-hidden /> Adicionar beneficiado
            </button>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={BORDA}>{erro}</p>}
      {aviso && <p role="status" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "rgba(46,137,50,.35)" }}>{aviso}</p>}

      {!carregando && lista.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded border bg-white px-5 py-3 text-[0.6875rem]" style={BORDA}>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Beneficiados</dt><dd className={VALOR(resumo.total)}>{resumo.total}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Feminino</dt><dd className={VALOR(resumo.feminino)}>{resumo.feminino}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Masculino</dt><dd className={VALOR(resumo.masculino)}>{resumo.masculino}</dd></div>
          {resumo.semSexo > 0 && (
            <div className="flex items-center gap-1.5">
              <dt className={`${ROTULO} inline-flex items-center gap-1`}>
                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                Sem sexo
              </dt>
              <dd className={VALOR(resumo.semSexo)}>{resumo.semSexo}</dd>
            </div>
          )}
          <div className="flex items-baseline gap-1.5">
            <dt className={ROTULO}>Rede pública</dt>
            <dd className={VALOR(resumo.redePublica)}>
              {resumo.redePublica} ({(resumo.percentualRedePublica ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
              {minimoRede !== null && <span className="font-normal text-black/40"> · mínimo {minimoRede}% na formação</span>}
            </dd>
          </div>
          {resumo.redeNaoInformada > 0 && <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Rede não informada</dt><dd className={VALOR(resumo.redeNaoInformada)}>{resumo.redeNaoInformada}</dd></div>}
        </dl>
      )}

      {!carregando && <Avisos achados={achados} />}

      <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="relacao-titulo">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id="relacao-titulo" className="text-[0.75rem] font-semibold text-black">Relação de beneficiados <span className="font-normal tabular-nums text-black/35">({lista.length})</span></h3>
          {lista.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 items-center gap-1.5 rounded border bg-white px-2.5" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                <Search size={12} className="text-black/35" aria-hidden />
                <input
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setMostrando(POR_VEZ); }}
                  placeholder="Buscar nome ou modalidade"
                  aria-label="Buscar na relação"
                  className="w-[11rem] bg-transparent text-[0.6875rem] text-black outline-none placeholder:text-black/30"
                />
              </label>
              {podeEditar && (
                <button type="button" onClick={excluirTodos} className="rounded px-2 py-2 text-[0.6875rem] text-black/40 transition hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                  Excluir todos
                </button>
              )}
            </div>
          )}
        </div>
        {carregando ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
        ) : lista.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users size={22} className="mx-auto text-black/20" aria-hidden />
            <p className="mt-2 text-[0.75rem] text-black/55">Nenhum beneficiado na relação.</p>
            <p className="mx-auto max-w-[30rem] text-[0.6875rem] text-black/35">
              Importe a planilha de inscrições ou a lista de chamada (nome, sexo, idade, escola, modalidade), ou adicione cada pessoa.
            </p>
          </div>
        ) : filtrada.length === 0 ? (
          <p className="px-5 py-8 text-center text-[0.75rem] text-black/45">Ninguém na relação com &quot;{busca}&quot;.</p>
        ) : (
          <>
            {/* Computador: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <th className={`${CABECALHO} w-full`}>Nome</th>
                    <th className={CABECALHO}>Sexo</th>
                    <th className={`${CABECALHO} text-right`}>Idade</th>
                    <th className={CABECALHO}>Rede</th>
                    <th className={`${CABECALHO} whitespace-nowrap`}>Modalidade</th>
                    <th className={CABECALHO}>Benefícios</th>
                    {podeEditar && <th className={CABECALHO}><span className="sr-only">Ações</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(b => (
                    <tr key={b.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="px-4 py-2.5">
                        <p className="text-black/80">{b.nome}</p>
                        {(b.telefone || b.endereco) && <p className="text-[0.625rem] text-black/40">{[b.telefone, b.endereco].filter(Boolean).join(" · ")}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[0.6875rem] text-black/60">{b.sexo ? ROTULO_DO_SEXO[b.sexo] : <span className="inline-flex items-center gap-1 text-black/45"><AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />Sem sexo</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-black/60">{b.idade ?? vazio}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[0.6875rem] text-black/60">{b.rede_publica === null ? vazio : rotuloDaRede(b.rede_publica)}</td>
                      <td className="min-w-[8rem] px-4 py-2.5 text-[0.6875rem] text-black/60">{b.modalidade ?? vazio}</td>
                      <td className="min-w-[9rem] px-4 py-2.5 text-[0.6875rem] text-black/60">{b.beneficios.join(", ") || vazio}</td>
                      {podeEditar && (
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          <button type="button" onClick={() => setEditando({ beneficiado: b })} aria-label={`Editar ${b.nome}`} className={botaoIcone}><Pencil size={13} /></button>
                          <button type="button" onClick={() => excluir(b)} aria-label={`Excluir ${b.nome}`} className={botaoExcluir}><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: cartões */}
            <ul className="divide-y divide-black/[.05] md:hidden">
              {visiveis.map(b => (
                <li key={b.id} className="space-y-1.5 px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.75rem] text-black/80">{b.nome}</p>
                      <p className="text-[0.625rem] text-black/45">
                        {[b.sexo ? ROTULO_DO_SEXO[b.sexo] : "Sem sexo", b.idade !== null ? `${b.idade} anos` : null, `Rede ${rotuloDaRede(b.rede_publica).toLowerCase()}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {podeEditar && (
                      <div className="flex shrink-0 items-center">
                        <button type="button" onClick={() => setEditando({ beneficiado: b })} aria-label={`Editar ${b.nome}`} className={botaoIcone}><Pencil size={13} /></button>
                        <button type="button" onClick={() => excluir(b)} aria-label={`Excluir ${b.nome}`} className={botaoExcluir}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  {(b.modalidade || b.beneficios.length > 0) && (
                    <p className="text-[0.6875rem] text-black/55">{[b.modalidade, b.beneficios.join(", ")].filter(Boolean).join(" · ")}</p>
                  )}
                </li>
              ))}
            </ul>

            {filtrada.length > visiveis.length && (
              <div className="border-t px-5 py-3 text-center" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <button type="button" onClick={() => setMostrando(m => m + POR_VEZ)} className="rounded px-3 py-2 text-[0.6875rem] text-black/55 transition hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Mostrar mais ({filtrada.length - visiveis.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {editando && (
        <BeneficiadoModal
          prestacaoId={id}
          beneficiado={editando.beneficiado}
          beneficiosConhecidos={beneficiosConhecidos}
          modalidades={modalidades}
          onClose={() => setEditando(null)}
          onSaved={salvou}
        />
      )}
      {importando && (
        <ImportarBeneficiados prestacaoId={id} jaCadastrados={lista.length} onClose={() => setImportando(false)} onImported={importou} />
      )}
    </div>
  );
}
