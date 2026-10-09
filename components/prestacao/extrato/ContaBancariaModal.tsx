"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { TIPOS_CONTA, type TipoConta } from "@/lib/prestacao/extrato";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoContaBancaria } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

/** Cria ou edita uma conta bancária da prestação. */
export function ContaBancariaModal({ prestacaoId, conta, onClose, onSaved }: {
  prestacaoId: string;
  conta: PrestacaoContaBancaria | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? "movimento");
  const [banco, setBanco] = useState(conta?.banco ?? "");
  const [agencia, setAgencia] = useState(conta?.agencia ?? "");
  const [numero, setNumero] = useState(conta?.conta ?? "");
  const [apelido, setApelido] = useState(conta?.apelido ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setSalvando(true);
    setErro("");
    const campos = {
      tipo,
      banco: banco.trim() || null,
      agencia: agencia.trim() || null,
      conta: numero.trim() || null,
      apelido: apelido.trim() || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do extrato ainda não estão no tipo Database
    const tabela = (supabase as any).from("prestacao_contas_bancarias");
    const { error } = conta
      ? await tabela.update(campos).eq("id", conta.id)
      : await tabela.insert({ ...campos, prestacao_id: prestacaoId });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a conta")); return; }
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={conta ? "Editar conta" : "Nova conta bancária"}
      subtitulo="A conta do projeto de onde vêm os extratos"
      onClose={onClose}
      largura="max-w-[30rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            Salvar
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ROTULO}>Tipo de conta</span>
          <Dropdown
            value={tipo}
            onChange={valor => setTipo(valor as TipoConta)}
            ariaLabel="Tipo de conta"
            options={TIPOS_CONTA.map(t => ({ value: t.id, label: t.rotulo }))}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Banco</span>
          <input value={banco} onChange={e => setBanco(e.target.value)} placeholder="001 · Banco do Brasil" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Agência</span>
          <input value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="1234-5" inputMode="numeric" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Conta</span>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="98765-4" inputMode="numeric" className={CAMPO} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Apelido (opcional)</span>
          <input value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Ex.: conta movimento do projeto" className={CAMPO} />
        </label>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

/** "Movimento · BB 1234-5 / 98765-4" ou o apelido, para listas e seletores. */
export function rotuloDaConta(conta: Pick<PrestacaoContaBancaria, "tipo" | "banco" | "agencia" | "conta" | "apelido">): string {
  const tipo = TIPOS_CONTA.find(t => t.id === conta.tipo)?.rotulo ?? conta.tipo;
  const numeros = [conta.agencia, conta.conta].filter(Boolean).join(" / ");
  const detalhe = conta.apelido || [conta.banco, numeros].filter(Boolean).join(" ") || "sem número";
  return `${tipo} · ${detalhe}`;
}
