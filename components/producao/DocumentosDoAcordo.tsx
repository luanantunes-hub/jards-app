"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dropdown } from "@/components/ui/Dropdown";
import { BOTAO_PEQUENO, Erro } from "@/components/producao/estilos";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { ROTULO_DO_TIPO_DE_DOCUMENTO, situacaoDaValidade, textoDaValidade, type DocumentoDaPasta } from "@/lib/producao/documentos";

type Ligacao = { id: string; documento_id: string };

const CAIXA = { borderColor: "rgba(13,13,13,.08)" };

/** O banco recusa anexar a acordo encerrado e documento de pessoa; o resto vira esta frase. */
function mensagemDoErro(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (mensagem.includes("acordo_encerrado")) return "O acordo está encerrado: não recebe mais documentos.";
  if (mensagem.includes("documento_so_da_organizacao")) return "Só os documentos da organização se anexam ao acordo.";
  if (erro.code === "23505") return "Esse documento já está neste acordo.";
  if (erro.code === "42501") return "Você não pode alterar os documentos deste acordo (eles pedem a permissão de dinheiro).";
  return "Não foi possível salvar. Tente de novo.";
}

/**
 * Os documentos de habilitação do acordo (PD4.8, segundo corte): os da pasta de documentos da organização que a contraparte pede (contrato social, certidões, carta
 * de exclusividade), com a validade de cada um. Anexar não copia: renovar na pasta vale para todos os acordos.
 */
export function DocumentosDoAcordo({ organizationId, acordoId, encerrado, podeEditar }: { organizationId: string; acordoId: string; encerrado: boolean; podeEditar: boolean }) {
  const [ligacoes, setLigacoes] = useState<Ligacao[] | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoDaPasta[]>([]);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [lig, doc] = await Promise.all([
        producao.from("producao_acordo_documentos").select("id, documento_id").eq("acordo_id", acordoId),
        producao.from("producao_documentos").select("id, escopo, pessoa_id, tipo, titulo, emitido_em, validade, notas").eq("organization_id", organizationId).eq("escopo", "organizacao"),
      ]);
      if (!ativo) return;
      setLigacoes((lig.data ?? []) as Ligacao[]);
      setDocumentos((doc.data ?? []) as DocumentoDaPasta[]);
      setErro(lig.error || doc.error ? "Não foi possível carregar os documentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [acordoId, organizationId, versao]);

  const porId = useMemo(() => new Map(documentos.map(item => [item.id, item])), [documentos]);
  const anexados = useMemo(() => (ligacoes ?? []).flatMap(ligacao => { const documento = porId.get(ligacao.documento_id); return documento ? [{ ligacao, documento }] : []; })
    .sort((a, b) => (a.documento.validade ?? "9999-12-31").localeCompare(b.documento.validade ?? "9999-12-31")), [ligacoes, porId]);
  const disponiveis = useMemo(() => documentos.filter(item => !(ligacoes ?? []).some(ligacao => ligacao.documento_id === item.id)), [documentos, ligacoes]);
  const mudou = () => setVersao(atual => atual + 1);

  async function anexar(documentoId: string) {
    if (documentoId === "") return;
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_acordo_documentos").insert({ organization_id: organizationId, acordo_id: acordoId, documento_id: documentoId });
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErro(error)); return; }
    mudou();
  }

  async function tirar(ligacaoId: string) {
    setTrabalhando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_acordo_documentos").delete().eq("id", ligacaoId);
    setTrabalhando(false);
    if (error) { setErro(mensagemDoErro(error)); return; }
    mudou();
  }

  if (ligacoes === null) return null;
  const vencidos = anexados.filter(item => situacaoDaValidade(item.documento.validade, hoje).estado === "vencido").length;

  return (
    <section aria-labelledby="acordo-habilitacao">
      <h2 id="acordo-habilitacao" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Documentos de habilitação</h2>
      <div className="rounded border bg-white" style={CAIXA}>
        {erro && <div className="px-4 pt-3"><Erro texto={erro} /></div>}
        {anexados.length === 0 ? (
          <p className="px-4 py-3 text-[0.8125rem] text-black/55">
            Nenhum documento anexado. Anexe o contrato social, as certidões e a carta de exclusividade que a contraparte pede; eles vêm da <Link href="/producoes/documentos" className="font-medium text-[#282525] underline decoration-black/20 underline-offset-2 hover:decoration-black/50">pasta de documentos</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-black/[.06]">
            {anexados.map(({ ligacao, documento }) => {
              const { estado } = situacaoDaValidade(documento.validade, hoje);
              const cor = estado === "vencido" ? "#B23B3B" : estado === "vence_em_breve" ? "#B07A14" : null;
              return (
                <li key={ligacao.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{ROTULO_DO_TIPO_DE_DOCUMENTO[documento.tipo]}</span>
                    <span className="block truncate text-[0.6875rem] text-black/45">{documento.titulo}</span>
                  </span>
                  <span className={`rounded border px-2 py-1 text-[0.6875rem] font-medium ${cor ? "" : "text-black/55"}`} style={cor ? { borderColor: `${cor}47`, color: cor } : { borderColor: "rgba(13,13,13,.15)" }}>{textoDaValidade(documento.validade, hoje)}</span>
                  {podeEditar && <button type="button" className={BOTAO_PEQUENO} disabled={trabalhando} onClick={() => void tirar(ligacao.id)} aria-label={`Tirar ${documento.titulo} do acordo`}>Tirar</button>}
                </li>
              );
            })}
          </ul>
        )}
        {vencidos > 0 && <p className="border-t border-black/[.06] px-4 py-2.5 text-[0.75rem] text-[#B23B3B]">{vencidos === 1 ? "Há 1 documento vencido neste acordo." : `Há ${vencidos} documentos vencidos neste acordo.`} Renove na pasta de documentos.</p>}
        {podeEditar && !encerrado && (
          <div className="border-t border-black/[.06] px-4 py-3">
            {disponiveis.length > 0
              ? <div className="max-w-sm"><Dropdown ariaLabel="Anexar um documento da pasta" value="" disabled={trabalhando} onChange={valor => void anexar(valor)}
                  options={[{ value: "", label: "Anexar um documento da pasta" }, ...disponiveis.map(item => ({ value: item.id, label: `${ROTULO_DO_TIPO_DE_DOCUMENTO[item.tipo]} · ${item.titulo}` }))]} /></div>
              : <p className="text-[0.6875rem] text-black/45">{documentos.length === 0 ? "A pasta ainda não tem documentos da organização." : "Todos os documentos da pasta já estão neste acordo."}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
