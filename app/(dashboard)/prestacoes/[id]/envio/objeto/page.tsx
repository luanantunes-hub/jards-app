"use client";

// Rascunho do relatório do objeto (P4.3): o relatório de cumprimento do objeto
// nos campos do sistema oficial do regime (Comprovação Física do Salic, RCO da
// LIE ou o relatório genérico). Cada dado leva à aba de onde veio; o que falta
// aparece como lacuna. O texto que só a pessoa sabe (resultados, empregos,
// repercussão) fica guardado por seção em prestacao_relatorio.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import {
  chaveDoComplemento,
  chaveDosNumeros,
  rascunhoDoRelatorio,
  textoDaSecao,
  textoDoRascunho,
  type FonteDoDado,
  type ModeloDoRelatorio,
  type Paragrafo,
  type SecaoDoRelatorio,
} from "@/lib/prestacao/relatorio-objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-3 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:text-black/35 active:scale-[.98]";
const SALVAR = "h-9 rounded bg-[#2E8932] px-4 text-[0.6875rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] disabled:opacity-50 active:scale-[.98]";

const CAMINHO: Record<FonteDoDado["aba"], string> = {
  visao_geral: "", objeto: "/objeto", atividades: "/atividades", distribuicao: "/distribuicao", bens: "/bens", divulgacao: "/divulgacao", orcamento: "/orcamento", envio: "/envio",
};
const hrefDa = (prestacaoId: string, f: FonteDoDado) =>
  `/prestacoes/${prestacaoId}${CAMINHO[f.aba]}${f.parametro && f.id ? `?${f.parametro}=${f.id}` : ""}`;

type Guardar = (chave: string, conteudo: string) => Promise<string | null>;

function Texto({ paragrafo, prestacaoId }: { paragrafo: Paragrafo; prestacaoId: string }) {
  return (
    <>
      {paragrafo.map((x, i) => {
        if (x.tipo === "texto") return <span key={i}>{x.texto}</span>;
        if (x.tipo === "dado") {
          return (
            <Link key={i} href={hrefDa(prestacaoId, x.fonte)} className="rounded text-black/85 underline decoration-black/20 underline-offset-2 hover:decoration-[#684DB0] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              {x.texto}
            </Link>
          );
        }
        const conteudo = <>Falta: {x.texto}</>;
        const classe = "mx-0.5 inline rounded border bg-white px-1 text-[#B07A14] focus-visible:outline-2 focus-visible:outline-[#7259B5]";
        return x.fonte
          ? <Link key={i} href={hrefDa(prestacaoId, x.fonte)} className={`${classe} hover:bg-black/[.03]`} style={{ borderColor: "#B07A1450" }}>{conteudo}</Link>
          : <span key={i} className={classe} style={{ borderColor: "#B07A1450" }}>{conteudo}</span>;
      })}
    </>
  );
}

function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sem área de transferência: o texto continua na tela */ }
  }
  return (
    <button type="button" onClick={copiar} aria-label={copiado ? `${rotulo}: copiado` : rotulo} className={BOTAO} style={BORDA}>
      {copiado ? <Check size={12} className="text-[#2E8932]" aria-hidden /> : <Copy size={12} aria-hidden />} {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

function Complemento({ secao, chave, podeEditar, guardar }: { secao: SecaoDoRelatorio; chave: string; podeEditar: boolean; guardar: Guardar }) {
  const c = secao.complemento!;
  const [valor, setValor] = useState(c.valor);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterado = valor.trim() !== c.valor.trim();
  const id = `complemento-${secao.id}`;
  async function salvar() {
    setSalvando(true);
    setErro((await guardar(chave, valor.trim())) ?? "");
    setSalvando(false);
  }
  return (
    <div className="mt-3 space-y-1.5">
      <label htmlFor={id} className="block text-[0.6875rem] text-black/55">
        {c.rotulo}{c.obrigatorio ? "" : <span className="text-black/35"> (opcional)</span>}
      </label>
      <textarea
        id={id}
        value={valor}
        onChange={e => setValor(e.target.value)}
        readOnly={!podeEditar}
        rows={3}
        maxLength={c.limite ?? 5000}
        className="w-full resize-y rounded border px-3 py-2 text-[0.75rem] text-black/80 focus:outline-none focus-visible:border-[#7259B5]"
        style={{ borderColor: c.obrigatorio && !valor.trim() ? "#B07A1460" : "rgba(13,13,13,.14)" }}
      />
      {podeEditar && (
        <div className="flex items-center justify-end gap-2">
          {erro && <p role="alert" className="mr-auto text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
          {alterado && <button type="button" onClick={() => setValor(c.valor)} className="h-9 rounded px-3 text-[0.6875rem] text-black/55 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Desfazer</button>}
          <button type="button" disabled={!alterado || salvando} onClick={salvar} className={SALVAR}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      )}
    </div>
  );
}

function Numeros({ secao, chave, podeEditar, guardar }: { secao: SecaoDoRelatorio; chave: string; podeEditar: boolean; guardar: Guardar }) {
  const iniciais = Object.fromEntries(secao.numeros!.map(n => [n.id, n.valor === null ? "" : String(n.valor)]));
  const [valores, setValores] = useState<Record<string, string>>(iniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterado = secao.numeros!.some(n => (valores[n.id] ?? "") !== iniciais[n.id]);
  const lidos = secao.numeros!.map(n => ({ ...n, lido: valores[n.id]?.trim() ? Number(valores[n.id]) : null }));
  const total = lidos.every(n => n.lido !== null && Number.isFinite(n.lido)) ? lidos.reduce((s, n) => s + (n.lido ?? 0), 0) : null;
  async function salvar() {
    if (lidos.some(n => n.lido !== null && (!Number.isInteger(n.lido) || n.lido < 0))) { setErro("Use números inteiros, sem sinal."); return; }
    setSalvando(true);
    const objeto = Object.fromEntries(lidos.filter(n => n.lido !== null).map(n => [n.id, n.lido]));
    setErro((await guardar(chave, Object.keys(objeto).length ? JSON.stringify(objeto) : "")) ?? "");
    setSalvando(false);
  }
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        {secao.numeros!.map(n => (
          <label key={n.id} className="text-[0.6875rem] text-black/55">
            {n.rotulo}
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={valores[n.id] ?? ""}
              readOnly={!podeEditar}
              onChange={e => setValores(v => ({ ...v, [n.id]: e.target.value }))}
              className="mt-1 block w-[7rem] rounded border px-3 py-2 text-[0.75rem] tabular-nums focus:outline-none focus-visible:border-[#7259B5]"
              style={{ borderColor: valores[n.id]?.trim() ? "rgba(13,13,13,.14)" : "#B07A1460" }}
            />
          </label>
        ))}
        <p className="pb-2 text-[0.6875rem] text-black/55">Total: <span className="tabular-nums text-black/80">{total === null ? "—" : total.toLocaleString("pt-BR")}</span></p>
        {podeEditar && <button type="button" disabled={!alterado || salvando} onClick={salvar} className={`${SALVAR} ml-auto`}>{salvando ? "Salvando…" : "Salvar"}</button>}
      </div>
      {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
    </div>
  );
}

function Secao({ secao, modelo, prestacaoId, podeEditar, guardar }: { secao: SecaoDoRelatorio; modelo: ModeloDoRelatorio; prestacaoId: string; podeEditar: boolean; guardar: Guardar }) {
  return (
    <section className="rounded border bg-white" style={BORDA} aria-labelledby={`secao-${secao.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="min-w-0">
          <h3 id={`secao-${secao.id}`} className="text-[0.75rem] font-semibold text-black">
            {secao.titulo}
            {secao.obrigatoria && <span className="ml-2 text-[0.625rem] font-normal text-black/40">obrigatório</span>}
            {secao.lacunas > 0 && <span className="ml-2 text-[0.625rem] font-normal text-[#B07A14]">{secao.lacunas} {secao.lacunas === 1 ? "lacuna" : "lacunas"}</span>}
          </h3>
          {secao.instrucao && <p className="mt-0.5 max-w-[48rem] text-[0.6875rem] text-black/45">{secao.instrucao}</p>}
        </div>
        <BotaoCopiar texto={textoDaSecao(secao)} rotulo={`Copiar ${secao.titulo}`} />
      </div>
      <div className="space-y-2 px-5 py-4 text-[0.75rem] leading-relaxed text-black/75">
        {secao.paragrafos.map((p, i) => <p key={i}><Texto paragrafo={p} prestacaoId={prestacaoId} /></p>)}
        {secao.tabela && (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-[0.6875rem]">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  {secao.tabela.colunas.map(c => <th key={c} className={CABECALHO}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {secao.tabela.linhas.map((linha, i) => (
                  <tr key={i} className="border-b align-top last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    {linha.map((celula, j) => <td key={j} className="px-3 py-2 text-black/75"><Texto paragrafo={celula} prestacaoId={prestacaoId} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {secao.numeros && <Numeros secao={secao} chave={chaveDosNumeros(modelo, secao.id)} podeEditar={podeEditar} guardar={guardar} />}
        {secao.complemento && <Complemento secao={secao} chave={chaveDoComplemento(modelo, secao.id)} podeEditar={podeEditar} guardar={guardar} />}
        {secao.documentos.length > 0 && (
          <p className="text-[0.6875rem] text-black/50">
            Anexar: {secao.documentos.map((d, i) => (
              <span key={i}>{i > 0 && "; "}<Link href={hrefDa(prestacaoId, d.fonte)} className="rounded underline decoration-black/20 underline-offset-2 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">{d.nome}</Link></span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

type Prestacao = { titulo: string; identificador_oficial: string | null; proponente: { nome: string; cnpj: string | null } | null };

export default function RelatorioDoObjetoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const { dados, erro: erroDoEnvio } = useDadosDoEnvio(id);
  const [prestacao, setPrestacao] = useState<Prestacao | null>(null);
  const [guardados, setGuardados] = useState<Record<string, string> | null>(null);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [p, r] = await Promise.all([
      db.from("prestacoes_contas").select("titulo, identificador_oficial, proponente:proponente_id(nome, cnpj)").eq("id", id).maybeSingle(),
      db.from("prestacao_relatorio").select("secao, conteudo").eq("prestacao_id", id),
    ]);
    const falha = p.error ?? r.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar o relatório") : "",
      prestacao: (p.data ?? null) as Prestacao | null,
      guardados: Object.fromEntries(((r.data ?? []) as { secao: string; conteudo: string }[]).map(x => [x.secao, x.conteudo])),
    };
  }, [id, supabase]);

  useEffect(() => {
    let ativo = true;
    buscar().then(lido => {
      if (!ativo) return;
      setErro(lido.erro);
      setPrestacao(lido.prestacao);
      setGuardados(lido.guardados);
    });
    return () => { ativo = false; };
  }, [buscar]);

  const guardar: Guardar = useCallback(async (chave, conteudo) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_relatorio ainda não está no tipo Database
    const tabela = (supabase as any).from("prestacao_relatorio");
    const { error } = conteudo
      ? await tabela.upsert({ prestacao_id: id, secao: chave, conteudo, updated_at: new Date().toISOString() }, { onConflict: "prestacao_id,secao" })
      : await tabela.delete().eq("prestacao_id", id).eq("secao", chave);
    if (error) return mensagemErroPrestacao(error, "Não foi possível salvar");
    setGuardados(g => {
      const novo = { ...(g ?? {}) };
      if (conteudo) novo[chave] = conteudo; else delete novo[chave];
      return novo;
    });
    return null;
  }, [id, supabase]);

  const rascunho = useMemo(() => {
    if (!dados || !prestacao || !guardados) return null;
    return rascunhoDoRelatorio({ regime: dados.regime, estado: dados.estado, prestacao, guardados, envio: dados });
  }, [dados, prestacao, guardados]);

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>

      {(erro || erroDoEnvio) && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro || erroDoEnvio}</p>}
      {!rascunho && !erro && !erroDoEnvio && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {rascunho && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">{rascunho.titulo}</h2>
              <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
                Rascunho para revisar e copiar. {rascunho.descricao} Cada dado leva à aba de onde veio; o que falta aparece como lacuna.
                {rascunho.fonte && <span className="text-black/35"> ({rascunho.fonte.documento}, {rascunho.fonte.dispositivo})</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[0.75rem] ${rascunho.lacunas ? "text-[#B07A14]" : "text-[#2E8932]"}`}>
                {rascunho.lacunas ? `${rascunho.lacunas} ${rascunho.lacunas === 1 ? "lacuna" : "lacunas"}` : "Sem lacunas"}
              </span>
              <CopiarTudo texto={textoDoRascunho(rascunho)} />
            </div>
          </div>
          {rascunho.secoes.map(s => (
            <Secao key={`${rascunho.modelo}:${s.id}:${s.complemento?.valor ?? ""}:${JSON.stringify(s.numeros ?? [])}`} secao={s} modelo={rascunho.modelo} prestacaoId={id} podeEditar={permissoes.editar} guardar={guardar} />
          ))}
        </>
      )}
    </div>
  );
}

function CopiarTudo({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sem área de transferência */ }
  }
  return (
    <button type="button" onClick={copiar} className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]">
      {copiado ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copiado ? "Copiado" : "Copiar tudo"}
    </button>
  );
}
