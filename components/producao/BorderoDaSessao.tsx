"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, TriangleAlert } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { FORMAS_DA_DEDUCAO, type FormaDaDeducao, type SituacaoDoBordero } from "@/lib/producao/estados";
import {
  calcularBordero, formatarReais, lerDeducao, lerReceita, mensagemDoErroDeBordero, MODELOS_DE_DEDUCAO, pendenciasParaFechar, publicoDoBordero, ROTULO_DA_FORMA_DA_DEDUCAO,
  ROTULO_DA_SITUACAO_DO_BORDERO, textoDoBordero, type DeducaoDoBordero, type ReceitaDoBordero,
} from "@/lib/producao/bordero";

type Bordero = { id: string; publico_casa: number | null; situacao: SituacaoDoBordero; fechado_em: string | null };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";
const BOTAO = "flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const CANCELAR = "rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const SALVAR = "rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const APAGAR = "mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

const Erro = ({ texto }: { texto: string }) => <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{texto}</p>;
const CATEGORIAS_SUGERIDAS = ["Inteira", "Meia", "Social", "Cortesia"];

function ReceitaSheet({ organizationId, borderoId, receita, existentes, onClose, onSalvou }: { organizationId: string; borderoId: string; receita: ReceitaDoBordero | null; existentes: string[]; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [categoria, setCategoria] = useState(receita?.categoria ?? "");
  const [quantidade, setQuantidade] = useState(receita ? String(receita.quantidade) : "");
  const [valor, setValor] = useState(receita ? String(receita.valor_unitario).replace(".", ",") : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const livres = CATEGORIAS_SUGERIDAS.filter(nome => !existentes.some(existente => existente.toLowerCase() === nome.toLowerCase()));

  async function salvar(fechar: () => void) {
    const leitura = lerReceita({ categoria, quantidade, valor });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = receita
      ? await producao.from("producao_bordero_receitas").update(leitura.valor).eq("id", receita.id)
      : await producao.from("producao_bordero_receitas").insert({ organization_id: organizationId, bordero_id: borderoId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeBordero(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!receita) return;
    confirmDelete({
      title: "Apagar categoria de ingresso?",
      description: `${receita.categoria} sai da receita deste borderô.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_bordero_receitas").delete().eq("id", receita.id);
        if (error) throw new Error(mensagemDoErroDeBordero(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={receita ? "Editar categoria" : "Nova categoria de ingresso"}
      onClose={onClose}
      footer={fechar => (
        <>
          {receita && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : receita ? "Salvar" : "Adicionar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="rec-categoria">Categoria</label>
          <input id="rec-categoria" className={CAMPO} value={categoria} maxLength={60} onChange={event => setCategoria(event.target.value)} disabled={salvando} placeholder="Inteira" />
          {!receita && livres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {livres.map(nome => <button key={nome} type="button" className={BOTAO_PEQUENO} onClick={() => setCategoria(nome)}>{nome}</button>)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={ROTULO} htmlFor="rec-quantidade">Ingressos</label><input id="rec-quantidade" inputMode="numeric" className={CAMPO} value={quantidade} onChange={event => setQuantidade(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="0" /></div>
          <div><label className={ROTULO} htmlFor="rec-valor">Valor de cada (R$)</label><input id="rec-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando} placeholder="50,00" /></div>
        </div>
        <p className="text-[0.6875rem] text-black/45">Cortesia entra com valor 0: conta no público, não na receita.</p>
      </div>
    </TopSheet>
  );
}

function DeducaoSheet({ organizationId, borderoId, deducao, onClose, onSalvou }: { organizationId: string; borderoId: string; deducao: DeducaoDoBordero | null; onClose: () => void; onSalvou: () => void }) {
  const { confirmDelete } = useDeleteConfirm();
  const [nome, setNome] = useState(deducao?.nome ?? "");
  const [forma, setForma] = useState<FormaDaDeducao>(deducao?.forma ?? "percentual");
  const [valor, setValor] = useState(deducao ? String(deducao.valor).replace(".", ",") : "");
  const [beneficiario, setBeneficiario] = useState(deducao?.beneficiario ?? "");
  const [ordem, setOrdem] = useState(deducao ? String(deducao.ordem) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerDeducao({ nome, forma, valor, beneficiario, ordem });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = deducao
      ? await producao.from("producao_bordero_deducoes").update(leitura.valor).eq("id", deducao.id)
      : await producao.from("producao_bordero_deducoes").insert({ organization_id: organizationId, bordero_id: borderoId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeBordero(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!deducao) return;
    confirmDelete({
      title: "Apagar dedução?",
      description: `${deducao.nome} sai do borderô.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_bordero_deducoes").delete().eq("id", deducao.id);
        if (error) throw new Error(mensagemDoErroDeBordero(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={deducao ? "Editar dedução" : "Nova dedução"}
      onClose={onClose}
      footer={fechar => (
        <>
          {deducao && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : deducao ? "Salvar" : "Adicionar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="ded-nome">Nome</label>
          <input id="ded-nome" className={CAMPO} value={nome} maxLength={80} onChange={event => setNome(event.target.value)} disabled={salvando} />
          {!deducao && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MODELOS_DE_DEDUCAO.map(modelo => <button key={modelo.nome} type="button" className={BOTAO_PEQUENO} onClick={() => { setNome(modelo.nome); setForma(modelo.forma); }}>{modelo.nome}</button>)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Forma</span>
            <Dropdown ariaLabel="Forma da dedução" value={forma} onChange={valorNovo => setForma(valorNovo as FormaDaDeducao)} disabled={salvando} options={FORMAS_DA_DEDUCAO.map(item => ({ value: item, label: ROTULO_DA_FORMA_DA_DEDUCAO[item] }))} />
          </div>
          <div><label className={ROTULO} htmlFor="ded-valor">{forma === "percentual" ? "Porcentagem (%)" : "Valor (R$)"}</label><input id="ded-valor" inputMode="decimal" className={CAMPO} value={valor} onChange={event => setValor(event.target.value)} disabled={salvando} placeholder={forma === "percentual" ? "5" : "300,00"} /></div>
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div><label className={ROTULO} htmlFor="ded-benef">Quem recebe (opcional)</label><input id="ded-benef" className={CAMPO} value={beneficiario} maxLength={80} onChange={event => setBeneficiario(event.target.value)} disabled={salvando} placeholder="Prefeitura, ECAD, casa..." /></div>
          <div><label className={ROTULO} htmlFor="ded-ordem">Ordem</label><input id="ded-ordem" inputMode="numeric" className={CAMPO} value={ordem} onChange={event => setOrdem(event.target.value.replace(/\D/g, ""))} disabled={salvando} placeholder="0" /></div>
        </div>
        <p className="rounded border bg-white px-3 py-2 text-[0.6875rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.1)" }}>O app não traz porcentagem pronta. Digite o que está no contrato ou na lei do município e confira com o contador.</p>
      </div>
    </TopSheet>
  );
}

/** O borderô de uma sessão (PD7.4): o público (a casa e a porta), a receita por categoria, as deduções e o líquido. Receita e deduções só aparecem a quem tem a permissão de dinheiro. */
export function BorderoDaSessao({ organizationId, sessaoId, sessaoRotulo, podeEditar, comDinheiro }: { organizationId: string; sessaoId: string; sessaoRotulo: string; podeEditar: boolean; comDinheiro: boolean }) {
  const [carregado, setCarregado] = useState(false);
  const [bordero, setBordero] = useState<Bordero | null>(null);
  const [porta, setPorta] = useState(0);
  const [receitas, setReceitas] = useState<ReceitaDoBordero[]>([]);
  const [deducoes, setDeducoes] = useState<DeducaoDoBordero[]>([]);
  const [publicoTexto, setPublicoTexto] = useState("");
  const [folhaReceita, setFolhaReceita] = useState<{ receita: ReceitaDoBordero | null } | null>(null);
  const [folhaDeducao, setFolhaDeducao] = useState<{ deducao: DeducaoDoBordero | null } | null>(null);
  const [confirmandoFechar, setConfirmandoFechar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [trabalhando, setTrabalhando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [bor, por] = await Promise.all([
        producao.from("producao_borderos").select("id, publico_casa, situacao, fechado_em").eq("sessao_id", sessaoId).maybeSingle(),
        producao.from("producao_porta_leituras").select("id", { count: "exact", head: true }).eq("sessao_id", sessaoId).eq("resultado", "permitido"),
      ]);
      const encontrado = bor.data ?? null;
      const [rec, ded] = comDinheiro && encontrado
        ? await Promise.all([
            producao.from("producao_bordero_receitas").select("id, categoria, quantidade, valor_unitario").eq("bordero_id", encontrado.id),
            producao.from("producao_bordero_deducoes").select("id, nome, forma, valor, beneficiario, ordem").eq("bordero_id", encontrado.id),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (!ativo) return;
      setBordero(encontrado);
      setPublicoTexto(encontrado?.publico_casa === null || !encontrado ? "" : String(encontrado.publico_casa));
      setPorta(por.count ?? 0);
      setReceitas(rec.data ?? []);
      setDeducoes(ded.data ?? []);
      setCarregado(true);
      setErro(bor.error || por.error || rec.error || ded.error ? "Não foi possível carregar o borderô. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [sessaoId, comDinheiro, versao]);

  const recarregar = () => setVersao(atual => atual + 1);
  const contas = useMemo(() => calcularBordero(receitas, deducoes), [receitas, deducoes]);
  const publico = useMemo(() => publicoDoBordero(bordero?.publico_casa ?? null, porta), [bordero, porta]);
  const fechado = bordero?.situacao === "fechado";
  const editavel = podeEditar && !fechado;
  const pendencias = useMemo(() => pendenciasParaFechar({ publicoCasa: bordero?.publico_casa ?? null, porta, receitas: receitas.length, liquidoCentavos: contas.liquidoCentavos }), [bordero, porta, receitas, contas]);

  async function criar() {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_borderos").insert({ organization_id: organizationId, sessao_id: sessaoId });
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErroDeBordero(error)); return; }
    recarregar();
  }

  async function atualizar(valores: { publico_casa?: number | null; situacao?: SituacaoDoBordero }) {
    if (!bordero) return;
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_borderos").update(valores).eq("id", bordero.id);
    setTrabalhando(false);
    setConfirmandoFechar(false);
    if (error) { setErro(mensagemDoErroDeBordero(error)); return; }
    recarregar();
  }

  function salvarPublico() {
    if (!bordero || fechado) return;
    const limpo = publicoTexto.trim();
    if (limpo !== "" && !/^\d+$/.test(limpo)) { setErro("O público é um número inteiro de pessoas."); return; }
    const numero = limpo === "" ? null : Number(limpo);
    if (numero !== null && numero > 100000) { setErro("O público pode ir até 100.000."); return; }
    if (numero === bordero.publico_casa) return;
    void atualizar({ publico_casa: numero });
  }

  async function copiar() {
    const texto = textoDoBordero({ sessao: sessaoRotulo, situacao: bordero?.situacao ?? "rascunho", publico, contas, comDinheiro });
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { setErro("Não foi possível copiar. Selecione o texto e copie à mão."); }
  }

  if (!carregado) return <div className="h-24 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  if (!bordero) {
    return (
      <div className="space-y-3">
        {erro && <Erro texto={erro} />}
        <div className="rounded border bg-white px-5 py-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Esta sessão ainda não tem borderô</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">O borderô guarda o público e, para quem tem a permissão de dinheiro, a receita por categoria de ingresso, as deduções e o líquido.</p>
          {podeEditar && <button type="button" onClick={() => void criar()} disabled={trabalhando} className={`${BOTAO} mx-auto mt-4`}><Plus size={13} aria-hidden="true" /> Criar borderô</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {erro && <Erro texto={erro} />}

      <section aria-labelledby="bordero-publico">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="bordero-publico" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Público e situação</h2>
          <span className="rounded border px-2 py-1 text-[0.6875rem] font-medium text-[#282525]" style={{ borderColor: "rgba(13,13,13,.25)" }}>{ROTULO_DA_SITUACAO_DO_BORDERO[bordero.situacao]}{fechado && bordero.fechado_em ? ` em ${new Date(bordero.fechado_em).toLocaleDateString("pt-BR")}` : ""}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <label htmlFor="bordero-casa" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Contado pela casa</label>
            <input id="bordero-casa" inputMode="numeric" className={`${CAMPO} mt-1.5`} value={publicoTexto} disabled={!editavel || trabalhando} onChange={event => setPublicoTexto(event.target.value.replace(/\D/g, ""))} onBlur={salvarPublico} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} placeholder="Pessoas" />
          </div>
          <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Entraram pela porta</p>
            <p className={`mt-1.5 text-[1.25rem] font-semibold tabular-nums ${porta === 0 ? "text-black/30" : "text-[#282525]"}`}>{porta.toLocaleString("pt-BR")}</p>
            <p className="text-[0.6875rem] text-black/45">Só conta quem tem credencial</p>
          </div>
          <div className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Público do borderô</p>
            <p className={`mt-1.5 text-[1.25rem] font-semibold tabular-nums ${publico.oficial === null ? "text-black/30" : "text-[#282525]"}`}>{publico.oficial === null ? "—" : publico.oficial.toLocaleString("pt-BR")}</p>
            <p className="text-[0.6875rem] text-black/45">{publico.origem === "casa" ? "Valem os números da casa" : publico.origem === "porta" ? "Vale o da porta" : "Ainda não informado"}</p>
          </div>
        </div>
        {publico.aviso && <p className="mt-2 flex items-start gap-1.5 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}><TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {publico.aviso}</p>}
        {podeEditar && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {bordero.situacao === "rascunho" && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => void atualizar({ situacao: "conferido" })}>Marcar como conferido</button>}
            {bordero.situacao !== "fechado" && !confirmandoFechar && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => (pendencias.length === 0 ? void atualizar({ situacao: "fechado" }) : setConfirmandoFechar(true))}>Fechar borderô</button>}
            {confirmandoFechar && (
              <div className="flex flex-wrap items-center gap-2 rounded border bg-white px-3 py-2" style={{ borderColor: "#B07A1447" }}>
                <span className="text-[0.75rem] text-[#B07A14]">{pendencias.join(" · ")}.</span>
                <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => void atualizar({ situacao: "fechado" })}>Fechar mesmo assim</button>
                <button type="button" className={BOTAO_PEQUENO} onClick={() => setConfirmandoFechar(false)}>Voltar</button>
              </div>
            )}
            {fechado && <button type="button" className={BOTAO} disabled={trabalhando} onClick={() => void atualizar({ situacao: "conferido" })}>Reabrir para mudar</button>}
            {fechado && <span className="text-[0.75rem] text-black/55">Fechado: nada muda até reabrir.</span>}
          </div>
        )}
      </section>

      {comDinheiro ? (
        <>
          <section aria-labelledby="bordero-receita">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="bordero-receita" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Receita por categoria</h2>
              {editavel && <button type="button" onClick={() => setFolhaReceita({ receita: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Categoria</button>}
            </div>
            {contas.receitas.length === 0 ? (
              <p className="rounded border bg-white px-5 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma categoria de ingresso lançada. Comece por inteira, meia, social e cortesia.</p>
            ) : (
              <div className="overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <table className="w-full min-w-[28rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/[.06]">
                      {["Categoria", "Ingressos", "Valor de cada", "Subtotal"].map((titulo, indice) => <th key={titulo} scope="col" className={`px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 ${indice > 0 ? "text-right" : ""}`}>{titulo}</th>)}
                      {editavel && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {contas.receitas.map(linha => (
                      <tr key={linha.id} className="border-b border-black/[.06] last:border-b-0">
                        <th scope="row" className="px-4 py-2 text-left text-[0.8125rem] font-medium text-[#282525]">{linha.categoria}</th>
                        <td className="px-4 py-2 text-right text-[0.8125rem] tabular-nums text-[#282525]">{linha.quantidade.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-2 text-right text-[0.8125rem] tabular-nums text-black/65">{formatarReais(linha.valorUnitarioCentavos)}</td>
                        <td className={`px-4 py-2 text-right text-[0.8125rem] tabular-nums ${linha.subtotalCentavos === 0 ? "text-black/30" : "text-[#282525]"}`}>{formatarReais(linha.subtotalCentavos)}</td>
                        {editavel && <td className="px-3 py-2 text-right"><button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaReceita({ receita: receitas.find(item => item.id === linha.id) ?? null })}>Editar</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="bordero-deducoes">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="bordero-deducoes" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Deduções</h2>
              {editavel && <button type="button" onClick={() => setFolhaDeducao({ deducao: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Dedução</button>}
            </div>
            {contas.deducoes.length === 0 ? (
              <p className="rounded border bg-white px-5 py-5 text-center text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.08)" }}>Nenhuma dedução. Acrescente as da sessão (taxa da casa, ISS, ECAD, cartão...) com a porcentagem ou o valor do contrato. O app não traz percentual pronto; confira com o contador.</p>
            ) : (
              <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {contas.deducoes.map(linha => (
                  <li key={linha.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-[0.8125rem] font-medium text-[#282525]">{linha.nome}</p>
                      <p className="truncate text-[0.6875rem] text-black/45">{linha.forma === "percentual" ? `${linha.valor.toLocaleString("pt-BR")}% da receita` : "Valor fixo"}{linha.beneficiario ? ` · ${linha.beneficiario}` : ""}</p>
                    </div>
                    <span className="text-[0.8125rem] tabular-nums text-[#282525]">− {formatarReais(linha.descontoCentavos)}</span>
                    {editavel && <button type="button" className={BOTAO_PEQUENO} onClick={() => setFolhaDeducao({ deducao: deducoes.find(item => item.id === linha.id) ?? null })}>Editar</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="bordero-resultado">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="bordero-resultado" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Resultado</h2>
              <button type="button" onClick={() => void copiar()} className={BOTAO}><Copy size={13} aria-hidden="true" /> {copiado ? "Copiado" : "Copiar borderô"}</button>
            </div>
            <dl className="grid gap-2 sm:grid-cols-4">
              {[
                { rotulo: "Ingressos", valor: contas.ingressos.toLocaleString("pt-BR"), zero: contas.ingressos === 0 },
                { rotulo: "Receita bruta", valor: formatarReais(contas.brutoCentavos), zero: contas.brutoCentavos === 0 },
                { rotulo: "Deduções", valor: contas.totalDeducoesCentavos === 0 ? formatarReais(0) : `− ${formatarReais(contas.totalDeducoesCentavos)}`, zero: contas.totalDeducoesCentavos === 0 },
                { rotulo: "Líquido", valor: formatarReais(contas.liquidoCentavos), zero: contas.liquidoCentavos === 0, forte: true },
              ].map(item => (
                <div key={item.rotulo} className="rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <dt className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{item.rotulo}</dt>
                  <dd className={`mt-1 text-[1.125rem] tabular-nums ${item.forte ? "font-semibold" : "font-medium"} ${item.zero ? "text-black/30" : contas.liquidoCentavos < 0 && item.forte ? "text-[#B23B3B]" : "text-[#282525]"}`}>{item.valor}</dd>
                </div>
              ))}
            </dl>
            {contas.ticketMedioCentavos !== null && <p className="mt-2 text-[0.6875rem] tabular-nums text-black/45">Ticket médio: {formatarReais(contas.ticketMedioCentavos)} por ingresso.</p>}
          </section>
        </>
      ) : (
        <p className="rounded border bg-white px-5 py-5 text-[0.75rem] text-black/55" style={{ borderColor: "rgba(13,13,13,.08)" }}>A receita, as deduções e o líquido só aparecem para quem tem a permissão de dinheiro. Peça a um administrador, se precisar vê-los.</p>
      )}

      {folhaReceita && <ReceitaSheet organizationId={organizationId} borderoId={bordero.id} receita={folhaReceita.receita} existentes={receitas.map(item => item.categoria)} onClose={() => setFolhaReceita(null)} onSalvou={recarregar} />}
      {folhaDeducao && <DeducaoSheet organizationId={organizationId} borderoId={bordero.id} deducao={folhaDeducao.deducao} onClose={() => setFolhaDeducao(null)} onSalvou={recarregar} />}
    </div>
  );
}
