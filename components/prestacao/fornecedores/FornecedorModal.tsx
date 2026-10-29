"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import {
  cnpjValido,
  documentoValido,
  formatarDocumento,
  limparDocumento,
  TIPOS_PESSOA,
  TIPOS_RELACAO,
  type TipoPessoa,
  type TipoRelacao,
} from "@/lib/prestacao/fornecedores";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoFornecedor } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 aria-[invalid=true]:border-[#D94A4A]/50";

/** Consulta a Receita e o TCU pela função; devolve o fornecedor atualizado ou null se não respondeu. */
export async function consultarFornecedor(supabase: ReturnType<typeof createClient>, id: string): Promise<PrestacaoFornecedor | null> {
  const { data, error } = await supabase.functions.invoke("consultar-fornecedor", { body: { fornecedor_id: id } });
  return error ? null : ((data?.fornecedor as PrestacaoFornecedor | undefined) ?? null);
}

/** Cadastra ou edita um fornecedor; com CNPJ válido, já consulta a Receita e as sanções. */
export function FornecedorModal({ organizationId, fornecedor, onClose, onSaved }: {
  organizationId: string;
  fornecedor: PrestacaoFornecedor | null;
  onClose: () => void;
  onSaved: (fornecedor: PrestacaoFornecedor, aviso: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tipo, setTipo] = useState<TipoPessoa>(fornecedor?.tipo_pessoa ?? "pj");
  const [documento, setDocumento] = useState(fornecedor?.documento ? formatarDocumento(fornecedor.documento) : "");
  const [nome, setNome] = useState(fornecedor?.nome ?? "");
  const [parte, setParte] = useState(fornecedor?.parte_relacionada ?? false);
  const [relacao, setRelacao] = useState<TipoRelacao | "">(fornecedor?.tipo_relacao ?? "");
  const [grupo, setGrupo] = useState(fornecedor?.grupo_economico ?? "");
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes ?? "");
  const [salvando, setSalvando] = useState("");
  const [erro, setErro] = useState("");

  const temCnpj = tipo === "pj" || tipo === "mei";
  const rotuloDocumento = TIPOS_PESSOA.find(t => t.id === tipo)?.documento ?? "Documento";
  const limpo = limparDocumento(documento);
  const documentoInvalido = limpo !== "" && !documentoValido(tipo, limpo);

  async function salvar() {
    setErro("");
    if (tipo !== "estrangeiro" && !limpo) { setErro(`Informe o ${rotuloDocumento}.`); return; }
    if (documentoInvalido) { setErro(`${rotuloDocumento} inválido. Confira os dígitos.`); return; }
    if (!temCnpj && !nome.trim()) { setErro("Informe o nome."); return; }

    setSalvando("Salvando…");
    const campos = {
      tipo_pessoa: tipo,
      documento: limpo || null,
      nome: nome.trim() || null,
      parte_relacionada: parte,
      tipo_relacao: parte ? relacao || null : null,
      grupo_economico: grupo.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
    const tabela = (supabase as any).from("prestacao_fornecedores");
    const { data, error } = fornecedor
      ? await tabela.update(campos).eq("id", fornecedor.id).select("*").single()
      : await tabela.insert({ ...campos, organization_id: organizationId }).select("*").single();
    if (error) {
      setSalvando("");
      setErro(error.code === "23505"
        ? `Já existe um fornecedor com esse ${rotuloDocumento} no cadastro.`
        : mensagemErroPrestacao(error, "Não foi possível salvar o fornecedor"));
      return;
    }
    let salvo = data as PrestacaoFornecedor;

    // Documento novo ou trocado: a consulta anterior foi apagada pelo banco; consulta de novo.
    if (temCnpj && cnpjValido(limpo) && !salvo.cnpj_consultado_em) {
      setSalvando("Consultando a Receita e o TCU…");
      const consultado = await consultarFornecedor(supabase, salvo.id);
      if (!consultado) {
        setSalvando("");
        onSaved(salvo, "Fornecedor salvo. A consulta não respondeu; use “Consultar de novo”.");
        return;
      }
      salvo = consultado;
    }
    setSalvando("");
    onSaved(salvo, fornecedor ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
  }

  return (
    <ModalPrestacao
      titulo={fornecedor ? "Editar fornecedor" : "Novo fornecedor"}
      subtitulo="Vale para todas as suas prestações"
      onClose={onClose}
      largura="max-w-[34rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={Boolean(salvando)}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
            {salvando || "Salvar"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown
            value={tipo}
            onChange={valor => setTipo(valor as TipoPessoa)}
            ariaLabel="Tipo de fornecedor"
            options={TIPOS_PESSOA.map(t => ({ value: t.id, label: t.rotulo }))}
          />
        </div>
        <label>
          <span className={ROTULO}>{rotuloDocumento}{tipo === "estrangeiro" ? " (opcional)" : ""}</span>
          <input
            value={documento}
            onChange={e => setDocumento(e.target.value)}
            onBlur={() => { if (!documentoInvalido && limpo) setDocumento(formatarDocumento(limpo)); }}
            placeholder={temCnpj ? "00.000.000/0000-00" : tipo === "pf" ? "000.000.000-00" : "Passaporte ou registro"}
            aria-invalid={documentoInvalido}
            autoComplete="off"
            className={`${CAMPO} tabular-nums`}
          />
          {documentoInvalido && <span className="mt-1 block text-[0.625rem] text-[#B23B3B]">{rotuloDocumento} inválido.</span>}
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Nome{temCnpj ? " (opcional)" : ""}</span>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder={temCnpj ? "Em branco, usa o nome da Receita" : "Nome completo"} className={CAMPO} />
        </label>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-2.5 text-[0.75rem] text-black/75">
            <input
              type="checkbox"
              checked={parte}
              onChange={e => { setParte(e.target.checked); if (!e.target.checked) setRelacao(""); }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 accent-[#7259B5] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
            />
            <span>
              Parte relacionada ao proponente
              <span className="block text-[0.625rem] text-black/40">O próprio proponente, dirigente, sócio em comum, coligada ou parente: o regime limita o total pago a eles.</span>
            </span>
          </label>
        </div>
        {parte && (
          <div className="sm:col-span-2">
            <span className={ROTULO}>Relação</span>
            <Dropdown
              value={relacao}
              onChange={valor => setRelacao(valor as TipoRelacao)}
              ariaLabel="Relação com o proponente"
              placeholder="Escolha a relação"
              options={TIPOS_RELACAO.map(r => ({ value: r.id, label: r.rotulo }))}
            />
          </div>
        )}
        <label className="sm:col-span-2">
          <span className={ROTULO}>Grupo econômico (opcional)</span>
          <input value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Ex.: empresas do mesmo dono" className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Observações (opcional)</span>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} className={`${CAMPO} h-auto py-2`} />
        </label>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
