"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { Aviso, CAMPO, ROTULO, Rodape, garantirLoja } from "@/components/ticketeria/FolhasDosEventos";
import {
  BANCOS, FORMULARIO_VAZIO, OUTRO_BANCO, centavosDoTexto, corpoDoCadastro, ehCpf, formatarMoeda, mascararCelular, mascararCep, mascararDocumento,
  mensagemDoErroDoCadastro, problemasDoFormulario, resumoDaContaDeSaque, somenteNumeros, type FormularioDaConta,
} from "@/lib/ticketeria/recebimentos";

// A conta que recebe o valor das vendas (cadastro da subconta no Asaas, parte 2 do cadeado do repasse). A folha cadastra; o cartão mostra a situação.
// Telas aprovadas pelo dono em 19/11/2026. A edição da conta para saques fica de fora: precisa de confirmação extra e é uma entrega à parte.

const TIPOS_DE_EMPRESA = [
  { value: "MEI", label: "MEI" }, { value: "LIMITED", label: "Ltda" }, { value: "INDIVIDUAL", label: "Empresário individual" }, { value: "ASSOCIATION", label: "Associação" },
];
const OPCOES_DE_BANCO = [...BANCOS.map(b => ({ value: b.codigo, label: `${b.codigo} · ${b.nome}` })), { value: OUTRO_BANCO, label: "Outro banco" }];
const GRUPO = "mt-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";

export type ContaCadastrada = { situacao: string; cpf_cnpj: string; banco_codigo: string | null; agencia: string | null; conta: string | null; conta_digito: string | null };

export function CadastroDaContaSheet({ organizationId, nomeDaOrganizacao, onClose, onSaved }: { organizationId: string; nomeDaOrganizacao: string; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const [f, setF] = useState<FormularioDaConta>(FORMULARIO_VAZIO);
  const [maisDetalhes, setMaisDetalhes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const muda = <K extends keyof FormularioDaConta>(campo: K, valor: FormularioDaConta[K]) => setF(atual => ({ ...atual, [campo]: valor }));
  const cpf = ehCpf(f.documento);

  async function cadastrar(fechar: () => void) {
    const problemas = problemasDoFormulario(f);
    if (problemas.length > 0) { setErro(`Confira: ${problemas.join("; ")}.`); return; }
    setSalvando(true);
    setErro(null);
    const loja = await garantirLoja(clienteDaTicketeria(createClient()), organizationId, nomeDaOrganizacao);
    if (typeof loja !== "string") { setSalvando(false); setErro(loja.erro); return; }
    let resposta: Response;
    try {
      resposta = await fetch(`/api/ticketeria/lojas/${loja}/conta-asaas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpoDoCadastro(f)) });
    } catch {
      setSalvando(false); setErro("Sem conexão. Tente de novo."); return;
    }
    const dados = (await resposta.json().catch(() => ({}))) as { error?: string; codigos?: string[]; problemas?: string[] };
    setSalvando(false);
    if (!resposta.ok) {
      setErro(mensagemDoErroDoCadastro(resposta.status, dados.error, dados.codigos, dados.problemas));
      if (dados.error === "conta_ja_cadastrada") onSaved();
      return;
    }
    onSaved();
    fechar();
  }

  return (
    <TopSheet titulo="Cadastrar conta" onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={salvando} rotulo="Cadastrar conta" onSalvar={() => void cadastrar(fechar)} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div><label className={ROTULO} htmlFor={`${id}-nome`}>Nome ou razão social</label><input id={`${id}-nome`} autoFocus className={CAMPO} value={f.nome} onChange={e => muda("nome", e.target.value)} maxLength={200} autoComplete="organization" disabled={salvando} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor={`${id}-doc`}>CPF ou CNPJ</label><input id={`${id}-doc`} inputMode="numeric" className={CAMPO} value={f.documento} onChange={e => muda("documento", mascararDocumento(e.target.value))} placeholder="00.000.000/0000-00" disabled={salvando} /></div>
          {cpf
            ? <div><label className={ROTULO} htmlFor={`${id}-nasc`}>Data de nascimento</label><input id={`${id}-nasc`} type="date" className={CAMPO} value={f.nascimento} onChange={e => muda("nascimento", e.target.value)} disabled={salvando} /></div>
            : <div><span className={ROTULO}>Tipo de empresa</span><Dropdown ariaLabel="Tipo de empresa" value={f.tipoDeEmpresa} onChange={valor => muda("tipoDeEmpresa", valor as FormularioDaConta["tipoDeEmpresa"])} options={TIPOS_DE_EMPRESA} placeholder="Selecionar…" disabled={salvando} /></div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor={`${id}-email`}>E-mail</label><input id={`${id}-email`} type="email" className={CAMPO} value={f.email} onChange={e => muda("email", e.target.value)} maxLength={200} autoComplete="email" disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor={`${id}-cel`}>Celular</label><input id={`${id}-cel`} inputMode="tel" className={CAMPO} value={f.celular} onChange={e => muda("celular", mascararCelular(e.target.value))} placeholder="(11) 98765-4321" disabled={salvando} /></div>
        </div>
        <div><label className={ROTULO} htmlFor={`${id}-fat`}>Faturamento mensal</label><input id={`${id}-fat`} inputMode="numeric" className={CAMPO} value={f.faturamento === "" ? "" : formatarMoeda(centavosDoTexto(f.faturamento))} onChange={e => muda("faturamento", e.target.value)} placeholder="R$ 0,00" disabled={salvando} /></div>

        <p className={GRUPO}>Endereço</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={ROTULO} htmlFor={`${id}-cep`}>CEP</label><input id={`${id}-cep`} inputMode="numeric" className={CAMPO} value={f.cep} onChange={e => muda("cep", mascararCep(e.target.value))} placeholder="00000-000" autoComplete="postal-code" disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor={`${id}-bairro`}>Bairro</label><input id={`${id}-bairro`} className={CAMPO} value={f.bairro} onChange={e => muda("bairro", e.target.value)} maxLength={150} disabled={salvando} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
          <div><label className={ROTULO} htmlFor={`${id}-end`}>Endereço</label><input id={`${id}-end`} className={CAMPO} value={f.endereco} onChange={e => muda("endereco", e.target.value)} maxLength={150} autoComplete="street-address" disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor={`${id}-num`}>Número</label><input id={`${id}-num`} className={CAMPO} value={f.numero} onChange={e => muda("numero", e.target.value)} maxLength={30} disabled={salvando} /></div>
        </div>

        <p className={GRUPO}>Conta para saques</p>
        <div><span className={ROTULO}>Banco</span><Dropdown ariaLabel="Banco" value={f.banco} onChange={valor => muda("banco", valor)} options={OPCOES_DE_BANCO} placeholder="Selecionar…" disabled={salvando} /></div>
        {f.banco === OUTRO_BANCO && <div><label className={ROTULO} htmlFor={`${id}-outro`}>Código do banco</label><input id={`${id}-outro`} inputMode="numeric" className={CAMPO} value={f.codigoDoOutroBanco} onChange={e => muda("codigoDoOutroBanco", somenteNumeros(e.target.value).slice(0, 3))} placeholder="000" disabled={salvando} /></div>}
        <div className="grid gap-3 grid-cols-[1fr_2fr_1fr]">
          <div><label className={ROTULO} htmlFor={`${id}-ag`}>Agência</label><input id={`${id}-ag`} inputMode="numeric" className={CAMPO} value={f.agencia} onChange={e => muda("agencia", somenteNumeros(e.target.value).slice(0, 6))} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor={`${id}-cc`}>Conta</label><input id={`${id}-cc`} inputMode="numeric" className={CAMPO} value={f.conta} onChange={e => muda("conta", somenteNumeros(e.target.value).slice(0, 15))} disabled={salvando} /></div>
          <div><label className={ROTULO} htmlFor={`${id}-dig`}>Dígito</label><input id={`${id}-dig`} className={CAMPO} value={f.digito} onChange={e => muda("digito", e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 2))} disabled={salvando} /></div>
        </div>
        <p className="text-[0.75rem] text-black/55">Os saques só saem para esta conta.</p>

        <div>
          <button type="button" onClick={() => setMaisDetalhes(aberto => !aberto)} aria-expanded={maisDetalhes} className="inline-flex items-center gap-1.5 rounded text-[0.8125rem] text-black/55 transition hover:text-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <ChevronRight size={14} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${maisDetalhes ? "rotate-90" : ""}`} />Mais detalhes
          </button>
          {maisDetalhes && <div className="mt-3"><label className={ROTULO} htmlFor={`${id}-comp`}>Complemento do endereço</label><input id={`${id}-comp`} className={CAMPO} value={f.complemento} onChange={e => muda("complemento", e.target.value)} maxLength={150} disabled={salvando} /></div>}
        </div>
      </div>
    </TopSheet>
  );
}

const ROTULO_PEQUENO = "mb-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";

function Etiqueta({ cor, texto }: { cor: string; texto: string }) {
  return <span className="shrink-0 rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

/** O cartão da conta depois do cadastro: em análise, ativa ou com atenção. */
export function CartaoDaConta({ conta }: { conta: ContaCadastrada }) {
  const resumo = resumoDaContaDeSaque(conta);
  const aprovada = conta.situacao === "aprovada";
  const bloqueada = conta.situacao === "bloqueada";
  return (
    <section aria-label="Conta de recebimento" className="rounded border border-black/[.1] bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.9375rem] font-medium text-[#282525]">Conta de recebimento</h2>
          {!aprovada && <p className="mt-1 max-w-xl text-[0.8125rem] text-black/60">{bloqueada ? "O Asaas pediu os documentos do titular ou não aceitou o cadastro. As vendas ficam pausadas. Fale com o suporte do Jards." : "O Asaas está conferindo os dados e os documentos."}</p>}
        </div>
        {aprovada ? <Etiqueta cor="#2E8932" texto="ATIVA" /> : bloqueada ? <Etiqueta cor="#D94A4A" texto="PRECISA DE ATENÇÃO" /> : <Etiqueta cor="#B07A14" texto="EM ANÁLISE" />}
      </div>
      {aprovada && (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><dt className={ROTULO_PEQUENO}>Titular</dt><dd className="text-[0.875rem] text-[#282525] tabular-nums">{conta.cpf_cnpj.length === 14 ? "CNPJ" : "CPF"} {mascararDocumento(conta.cpf_cnpj)}</dd></div>
          <div><dt className={ROTULO_PEQUENO}>Conta para saques</dt><dd className="text-[0.875rem] text-[#282525]">{resumo ?? "Ainda não definida"}</dd></div>
          <div><dt className={ROTULO_PEQUENO}>Liberação</dt><dd className="text-[0.875rem] text-[#282525]">18h do dia seguinte ao evento</dd></div>
        </dl>
      )}
    </section>
  );
}
