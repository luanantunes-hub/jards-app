"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { APAGAR, BOTAO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilos";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { EscopoDoDocumento, TipoDeDocumento } from "@/lib/producao/estados";
import {
  lerDocumento, mensagemDoErroDeDocumento, ROTULO_DO_TIPO_DE_DOCUMENTO, situacaoDaValidade, textoDaValidade, TIPOS_POR_ESCOPO, type DocumentoDaPasta,
} from "@/lib/producao/documentos";

type Pessoa = { id: string; nome: string };

const CAIXA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO_DO_ESCOPO: Record<EscopoDoDocumento, string> = { organizacao: "Da organização", pessoa: "Das pessoas" };

function DocumentoSheet({ organizationId, escopo, documento, pessoas, onClose, onSalvou }: {
  organizationId: string; escopo: EscopoDoDocumento; documento: DocumentoDaPasta | null; pessoas: Pessoa[]; onClose: () => void; onSalvou: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [tipo, setTipo] = useState<TipoDeDocumento>(documento?.tipo ?? TIPOS_POR_ESCOPO[escopo][0]);
  const [titulo, setTitulo] = useState(documento?.titulo ?? "");
  const [pessoaId, setPessoaId] = useState(documento?.pessoa_id ?? "");
  const [emitidoEm, setEmitidoEm] = useState(documento?.emitido_em ?? "");
  const [validade, setValidade] = useState(documento?.validade ?? "");
  const [notas, setNotas] = useState(documento?.notas ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const leitura = lerDocumento({ escopo, pessoaId, tipo, titulo, emitidoEm, validade, notas });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    // De quem é o documento (escopo e pessoa) não muda depois de criado: o banco recusa, então a edição só manda o resto.
    const { tipo: tipoLido, titulo: tituloLido, emitido_em, validade: validadeLida, notas: notasLidas } = leitura.valor;
    const { error } = documento
      ? await producao.from("producao_documentos").update({ tipo: tipoLido, titulo: tituloLido, emitido_em, validade: validadeLida, notas: notasLidas }).eq("id", documento.id)
      : await producao.from("producao_documentos").insert({ organization_id: organizationId, ...leitura.valor });
    setSalvando(false);
    if (error) { setErro(mensagemDoErroDeDocumento(error)); return; }
    onSalvou();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!documento) return;
    confirmDelete({
      title: "Apagar documento?",
      description: `"${documento.titulo}" sai da pasta e o aviso de vencimento dele também. Isso não pode ser desfeito.`,
      confirmLabel: "Apagar", pendingLabel: "Apagando…", illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_documentos").delete().eq("id", documento.id);
        if (error) throw new Error(mensagemDoErroDeDocumento(error));
        onSalvou();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={documento ? "Editar documento" : escopo === "pessoa" ? "Novo documento de uma pessoa" : "Novo documento da organização"}
      onClose={onClose}
      footer={fechar => (
        <>
          {documento && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className={APAGAR}>Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className={CANCELAR}>Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className={SALVAR}>{salvando ? "Salvando…" : documento ? "Salvar" : "Guardar documento"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        {escopo === "pessoa" && (
          <div>
            <span className={ROTULO}>De quem</span>
            <Dropdown ariaLabel="Pessoa dona do documento" value={pessoaId} onChange={setPessoaId} disabled={salvando || documento !== null}
              options={[{ value: "", label: "Escolha a pessoa" }, ...pessoas.map(item => ({ value: item.id, label: item.nome }))]} />
            {pessoas.length === 0 && <p className="mt-1 text-[0.6875rem] text-black/45">Cadastre a pessoa na equipe antes.</p>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div>
            <span className={ROTULO}>Tipo</span>
            <Dropdown ariaLabel="Tipo de documento" value={tipo} onChange={novo => setTipo(novo as TipoDeDocumento)} disabled={salvando}
              options={TIPOS_POR_ESCOPO[escopo].map(item => ({ value: item, label: ROTULO_DO_TIPO_DE_DOCUMENTO[item] }))} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="doc-titulo">Nome do documento</label>
            <input id="doc-titulo" className={CAMPO} value={titulo} maxLength={120} onChange={event => setTitulo(event.target.value)} disabled={salvando}
              placeholder={escopo === "pessoa" ? "CNH categoria D" : "Certidão negativa federal"} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ROTULO} htmlFor="doc-emitido">Emitido em</label>
            <input id="doc-emitido" type="date" className={CAMPO} value={emitidoEm} onChange={event => setEmitidoEm(event.target.value)} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="doc-validade">Vale até</label>
            <input id="doc-validade" type="date" className={CAMPO} value={validade} onChange={event => setValidade(event.target.value)} disabled={salvando} />
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="doc-notas">Nota</label>
          <textarea id="doc-notas" rows={2} className={`${CAMPO} h-auto min-h-[3.5rem] py-2`} value={notas} maxLength={300} onChange={event => setNotas(event.target.value)} disabled={salvando} />
        </div>
        <p className="text-[0.6875rem] text-black/45">A pasta guarda só o tipo e a validade, para o Jards avisar antes de vencer. <strong className="font-medium text-black/60">Não escreva o número do documento</strong> (CPF, RG, CNH, passaporte), e o arquivo ainda não é guardado aqui.</p>
      </div>
    </TopSheet>
  );
}

function ListaDeDocumentos({ documentos, nomeDaPessoa, hoje, podeEditar, vazio, onAbrir }: {
  documentos: DocumentoDaPasta[]; nomeDaPessoa: (id: string) => string; hoje: string; podeEditar: boolean; vazio: string; onAbrir: (documento: DocumentoDaPasta) => void;
}) {
  if (documentos.length === 0) return <p className="rounded border bg-white px-5 py-6 text-center text-[0.75rem] text-black/45" style={CAIXA}>{vazio}</p>;
  return (
    <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={CAIXA}>
      {documentos.map(documento => {
        const { estado } = situacaoDaValidade(documento.validade, hoje);
        const cor = estado === "vencido" ? "#B23B3B" : estado === "vence_em_breve" ? "#B07A14" : null;
        const conteudo = (
          <>
            <span className="min-w-0 flex-1 basis-56">
              <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">
                {documento.pessoa_id ? `${ROTULO_DO_TIPO_DE_DOCUMENTO[documento.tipo]} de ${nomeDaPessoa(documento.pessoa_id)}` : ROTULO_DO_TIPO_DE_DOCUMENTO[documento.tipo]}
              </span>
              <span className="block truncate text-[0.6875rem] text-black/45">{documento.titulo}{documento.notas ? ` · ${documento.notas}` : ""}</span>
            </span>
            <span className={`rounded border px-2 py-1 text-[0.6875rem] font-medium ${cor ? "" : "text-black/55"}`} style={cor ? { borderColor: `${cor}47`, color: cor } : { borderColor: "rgba(13,13,13,.15)" }}>
              {textoDaValidade(documento.validade, hoje)}
            </span>
          </>
        );
        return (
          <li key={documento.id}>
            {podeEditar
              ? <button type="button" onClick={() => onAbrir(documento)} title="Editar o documento" className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 text-left transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">{conteudo}</button>
              : <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3">{conteudo}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** A pasta de documentos com validade (PD4.8): os da organização e os das pessoas da equipe (só para quem vê o dinheiro), com o aviso do que vence. */
export function DocumentosDaProducao({ organizationId, podeEditar }: { organizationId: string; podeEditar: boolean }) {
  const [comDinheiro, setComDinheiro] = useState<boolean | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoDaPasta[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<{ escopo: EscopoDoDocumento; documento: DocumentoDaPasta | null } | null>(null);
  const [hoje] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await clienteDaProducao(createClient()).rpc("auth_producao_pode", { p_org: organizationId, p_acao: "dinheiro" });
      if (ativo) setComDinheiro(data === true);
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [doc, pes] = await Promise.all([
        producao.from("producao_documentos").select("id, escopo, pessoa_id, tipo, titulo, emitido_em, validade, notas").eq("organization_id", organizationId),
        producao.from("producao_pessoas").select("id, nome").eq("organization_id", organizationId).eq("arquivada", false).order("nome"),
      ]);
      if (!ativo) return;
      setDocumentos((doc.data ?? []) as DocumentoDaPasta[]);
      setPessoas((pes.data ?? []) as Pessoa[]);
      setErro(doc.error || pes.error ? "Não foi possível carregar os documentos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [organizationId, versao]);

  const nomes = useMemo(() => new Map(pessoas.map(item => [item.id, item.nome])), [pessoas]);
  const nomeDaPessoa = (id: string) => nomes.get(id) ?? "pessoa arquivada";
  // Vence primeiro, antes; sem validade, por último.
  const ordenados = useMemo(() => [...(documentos ?? [])].sort((a, b) => (a.validade ?? "9999-12-31").localeCompare(b.validade ?? "9999-12-31") || a.titulo.localeCompare(b.titulo, "pt-BR")), [documentos]);
  const daOrganizacao = ordenados.filter(item => item.escopo === "organizacao");
  const dasPessoas = ordenados.filter(item => item.escopo === "pessoa");
  const mudou = () => setVersao(atual => atual + 1);

  if (documentos === null || comDinheiro === null) return <div className="h-32 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />;

  const secao = (escopo: EscopoDoDocumento, lista: DocumentoDaPasta[], vazio: string, podeCriar: boolean) => (
    <section aria-labelledby={`documentos-${escopo}`} className="mt-8 first:mt-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`documentos-${escopo}`} className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{ROTULO_DO_ESCOPO[escopo]}</h2>
        {podeEditar && podeCriar && <button type="button" onClick={() => setFolha({ escopo, documento: null })} className={BOTAO}><Plus size={13} aria-hidden="true" /> Documento</button>}
      </div>
      <ListaDeDocumentos documentos={lista} nomeDaPessoa={nomeDaPessoa} hoje={hoje} podeEditar={podeEditar && podeCriar} vazio={vazio} onAbrir={documento => setFolha({ escopo, documento })} />
    </section>
  );

  return (
    <>
      {erro && <div className="mb-4"><Erro texto={erro} /></div>}
      {secao("organizacao", daOrganizacao, "Nenhum documento da organização. Guarde o contrato social, as certidões negativas e a carta de exclusividade com a validade, e o Jards avisa antes de vencerem.", true)}
      {comDinheiro
        ? secao("pessoa", dasPessoas, "Nenhum documento de pessoa. Guarde a CNH, o passaporte e a identidade de quem viaja com a produção, só com a validade.", true)
        : <p className="mt-8 rounded border bg-white px-5 py-4 text-[0.75rem] text-black/45" style={CAIXA}>Os documentos das pessoas só aparecem para quem tem a permissão de dinheiro.</p>}
      {folha && <DocumentoSheet organizationId={organizationId} escopo={folha.escopo} documento={folha.documento} pessoas={pessoas} onClose={() => setFolha(null)} onSalvou={mudou} />}
    </>
  );
}
