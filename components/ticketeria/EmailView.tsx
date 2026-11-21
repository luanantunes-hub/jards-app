"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { PRECO_DO_EMAIL_CENTAVOS, textoParaQuemCuidaDoSite, type RegistroDeDns, type RemetenteParaATela } from "@/lib/ticketeria/remetente";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import { Aviso, CAMPO, ROTULO } from "@/components/ticketeria/FolhasDosEventos";

// A aba E-mail do Público: ativar o e-mail (assinatura no cartão), escolher o domínio do produtor, adicionar os registros de DNS e acompanhar o consumo do mês. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const CANCELAR = "rounded-xl px-4 py-2.5 text-[0.75rem] font-normal text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const SECUNDARIO = "rounded-xl border bg-white px-3.5 py-2.5 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";
const FINAL = "rounded-xl bg-[#7259B5] px-4 py-2.5 text-[0.75rem] font-normal text-white transition hover:bg-[#6349A6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";
const numero = (n: number) => n.toLocaleString("pt-BR");
const preco = formatarMoeda(PRECO_DO_EMAIL_CENTAVOS);
const dia = (iso: string | null) => { if (!iso) return ""; try { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso)); } catch { return ""; } };

const SITUACAO: Record<string, { texto: string; cor: string }> = {
  sem_dominio: { texto: "Sem domínio", cor: "#8A8A8A" },
  aguardando_dns: { texto: "Aguardando o DNS", cor: "#B7791F" },
  verificado: { texto: "Verificado", cor: "#2E8932" },
  falhou: { texto: "Não deu certo", cor: "#B23B3B" },
};
const SITUACAO_DO_REGISTRO: Record<string, { texto: string; cor: string }> = {
  verified: { texto: "Verificado", cor: "#2E8932" },
  failed: { texto: "Não encontrado", cor: "#B23B3B" },
  temporary_failure: { texto: "Tentando de novo", cor: "#B7791F" },
};

const Etiqueta = ({ texto, cor }: { texto: string; cor: string }) => <span className="rounded-xl border px-2 py-0.5 text-[0.625rem] font-normal uppercase tracking-[.06em]" style={{ color: cor, borderColor: `${cor}59` }}>{texto}</span>;

/** O que o produtor vê na aba E-mail, de acordo com onde ele está: sem assinatura, sem domínio, aguardando o DNS, ou funcionando. */
export function EmailDaLoja({ email, ocupado, aviso, erro, onAtivar, onEscolherDominio, onVerificar, onGerenciar, onTeste }: {
  email: RemetenteParaATela; ocupado?: boolean; aviso?: string | null; erro?: string | null;
  onAtivar?: () => void; onEscolherDominio?: () => void; onVerificar?: () => void; onGerenciar?: () => void; onTeste?: () => void;
}) {
  const assinou = email.assinatura === "ativa" || email.assinatura === "inadimplente";
  return (
    <div className="space-y-4">
      {erro && <Aviso texto={erro} />}
      {aviso && <p role="status" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}
      {!assinou
        ? <Oferta email={email} onAtivar={onAtivar} />
        : (
          <>
            {email.assinatura === "inadimplente" && <Aviso texto="Não conseguimos cobrar o cartão da assinatura. Os envios ficam pausados até o pagamento ser regularizado." />}
            {email.situacao === "sem_dominio" && <EscolherDominio onEscolher={onEscolherDominio} />}
            {(email.situacao === "aguardando_dns" || email.situacao === "falhou") && <RegistrosDeDns email={email} ocupado={ocupado} onVerificar={onVerificar} onTrocar={onEscolherDominio} />}
            {email.situacao === "verificado" && <Funcionando email={email} onTeste={onTeste} onTrocar={onEscolherDominio} ocupado={ocupado} />}
            <Consumo email={email} onGerenciar={onGerenciar} />
          </>
        )}
    </div>
  );
}

function Oferta({ email, onAtivar }: { email: RemetenteParaATela; onAtivar?: () => void }) {
  return (
    <div className="rounded-xl border bg-white px-6 py-8" style={{ borderColor: BORDA }}>
      <Mail size={24} className="mb-3 text-[#7259B5]" aria-hidden="true" />
      <h2 className="text-[1rem] font-medium text-[#282525]">E-mail da Ticketeria</h2>
      <p className="mt-1 text-[0.8125rem] text-black/55">Envie novidades do seu domínio, com o seu nome.</p>
      <ul className="mt-4 space-y-1.5 text-[0.8125rem] text-black/70">
        <li>Os e-mails saem de um endereço do seu próprio domínio</li>
        <li>Até {numero(email.cota)} e-mails por mês</li>
        <li>Veja quem abriu, quem clicou e quanto vendeu</li>
        <li>Quem não quer mais receber sai com um clique</li>
      </ul>
      {email.assinatura === "pendente" && <p className="mt-4 text-[0.75rem] text-[#B7791F]">Seu pagamento ainda não foi confirmado. Se você já pagou, aguarde um instante e recarregue a página.</p>}
      {email.assinatura === "cancelada" && <p className="mt-4 text-[0.75rem] text-black/55">Sua assinatura foi cancelada. Você pode ativar de novo quando quiser.</p>}
      <div className="mt-5 flex items-center gap-4">
        <p className="text-[0.8125rem] text-[#282525]"><span className="text-[1.25rem] font-medium">{preco}</span> por mês</p>
        <button type="button" onClick={onAtivar} className={FINAL}>Ativar e-mail</button>
      </div>
    </div>
  );
}

function EscolherDominio({ onEscolher }: { onEscolher?: () => void }) {
  return (
    <div className="rounded-xl border bg-white px-6 py-8" style={{ borderColor: BORDA }}>
      <h2 className="text-[1rem] font-medium text-[#282525]">Agora, o seu domínio</h2>
      <p className="mt-1 max-w-[34rem] text-[0.8125rem] text-black/55">O e-mail sai de um endereço seu, como ingressos@novidades.seusite.com.br. Escolha o domínio e o Jards diz quais registros adicionar no provedor dele.</p>
      <button type="button" onClick={onEscolher} className={`${FINAL} mt-5`}>Escolher domínio</button>
    </div>
  );
}

function Copiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button type="button" aria-label={`${rotulo} ${texto.slice(0, 40)}`} onClick={() => { void navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); }).catch(() => undefined); }}
      className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[0.6875rem] text-[#7259B5] transition hover:bg-[#F5F2FB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
      {copiado ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}{copiado ? "Copiado" : rotulo}
    </button>
  );
}

function RegistrosDeDns({ email, ocupado, onVerificar, onTrocar }: { email: RemetenteParaATela; ocupado?: boolean; onVerificar?: () => void; onTrocar?: () => void }) {
  const dominio = email.dominio ?? "";
  const situacao = SITUACAO[email.situacao];
  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: BORDA }}>
        <div>
          <p className="text-[0.6875rem] text-black/45">Remetente</p>
          <p className="text-[0.8125rem] text-[#282525]">{email.nome_exibicao} &lt;{email.endereco_local}@{dominio}&gt;</p>
        </div>
        <Etiqueta texto={situacao.texto} cor={situacao.cor} />
      </div>
      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[0.875rem] font-medium text-[#282525]">Registros para adicionar no seu provedor de domínio</h2>
          {email.registros.length > 0 && <Copiar texto={textoParaQuemCuidaDoSite(dominio, email.registros)} rotulo="Enviar para quem cuida do meu site" />}
        </div>
        <p className="mt-1 text-[0.75rem] text-black/50">{email.situacao === "falhou" ? "O provedor não conseguiu confirmar o domínio. Confira se os registros abaixo foram adicionados exatamente assim e verifique de novo." : "Os registros que você já tem (o site e o e-mail de hoje) não mudam: só entram estes. Pode levar de alguns minutos a algumas horas para valer."}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse">
          <thead><tr className="border-y" style={{ borderColor: BORDA }}><th className={CABECALHO}>Tipo</th><th className={CABECALHO}>Nome</th><th className={CABECALHO}>Valor</th><th className={CABECALHO}>Situação</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {email.registros.map((r, i) => {
              const s = SITUACAO_DO_REGISTRO[r.situacao] ?? { texto: "Pendente", cor: "#B7791F" };
              return (
                <tr key={`${r.tipo}-${r.nome}-${i}`}>
                  <td className={`${CELULA} whitespace-nowrap`}>{r.tipo}{r.prioridade !== null ? <span className="block text-[0.6875rem] text-black/45">prioridade {r.prioridade}</span> : null}</td>
                  <td className={`${CELULA} break-all`}>{r.nome}<Copiar texto={r.nome} /></td>
                  <td className={`${CELULA} break-all text-[0.75rem]`}>{r.valor.length > 60 ? `${r.valor.slice(0, 60)}…` : r.valor}<Copiar texto={r.valor} /></td>
                  <td className={`${CELULA} whitespace-nowrap`}><Etiqueta texto={s.texto} cor={s.cor} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-[0.6875rem] text-black/45">Onde adicionar: no provedor onde você registrou o domínio (GoDaddy, Registro.br, Cloudflare, Hostinger…).</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onTrocar} className={CANCELAR}>Trocar domínio</button>
          <button type="button" onClick={onVerificar} disabled={ocupado} className={FINAL}>{ocupado ? "Verificando…" : "Verificar agora"}</button>
        </div>
      </div>
    </div>
  );
}

function Funcionando({ email, ocupado, onTeste, onTrocar }: { email: RemetenteParaATela; ocupado?: boolean; onTeste?: () => void; onTrocar?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: BORDA }}>
      <div>
        <p className="text-[0.6875rem] text-black/45">Remetente</p>
        <p className="text-[0.8125rem] text-[#282525]">{email.nome_exibicao} &lt;{email.endereco_local}@{email.dominio}&gt;</p>
        {email.responder_para && <p className="mt-0.5 text-[0.75rem] text-black/50">Respostas para {email.responder_para}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Etiqueta texto={SITUACAO.verificado.texto} cor={SITUACAO.verificado.cor} />
        <button type="button" onClick={onTrocar} className={CANCELAR}>Alterar</button>
        <button type="button" onClick={onTeste} disabled={ocupado} className={SECUNDARIO} style={{ borderColor: BORDA }}>Enviar teste para mim</button>
      </div>
    </div>
  );
}

function Consumo({ email, onGerenciar }: { email: RemetenteParaATela; onGerenciar?: () => void }) {
  const porcento = email.cota > 0 ? Math.min(100, Math.round((email.usados / email.cota) * 100)) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: BORDA }}>
        <p className="text-[0.6875rem] text-black/45">E-mails deste mês</p>
        <p className="mt-1 text-[1rem] text-[#282525]"><span className="tabular-nums">{numero(email.usados)}</span> <span className="text-black/45">de {numero(email.cota)}</span></p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[.06]" role="progressbar" aria-valuenow={porcento} aria-valuemin={0} aria-valuemax={100} aria-label="E-mails usados no mês"><div className="h-full rounded-full bg-[#7259B5]" style={{ width: `${porcento}%` }} /></div>
        {email.periodo_fim && <p className="mt-2 text-[0.6875rem] text-black/45">{email.cancela_no_fim ? `A assinatura termina em ${dia(email.periodo_fim)}` : `Renova em ${dia(email.periodo_fim)}`}</p>}
      </div>
      <div className="rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: BORDA }}>
        <p className="text-[0.6875rem] text-black/45">Assinatura</p>
        <p className="mt-1 text-[1rem] text-[#282525]">{preco} <span className="text-[0.8125rem] text-black/45">por mês</span></p>
        <button type="button" onClick={onGerenciar} className="mt-2 text-[0.75rem] text-[#7259B5] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Gerenciar assinatura</button>
      </div>
    </div>
  );
}

/** Antes do pagamento: o que está sendo contratado e quanto custa, com a explicação do valor. */
export function AtivarEmailSheet({ cota, trabalhando, erro, onContinuar, onClose }: { cota: number; trabalhando?: boolean; erro?: string | null; onContinuar?: () => void; onClose: () => void }) {
  return (
    <TopSheet titulo="Ativar o e-mail da Ticketeria" onClose={onClose} footer={fechar => (
      <>
        <button type="button" onClick={fechar} disabled={trabalhando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={onContinuar} disabled={trabalhando} className={FINAL}>{trabalhando ? "Abrindo o pagamento…" : "Continuar para o pagamento"}</button>
      </>
    )}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div className="rounded-xl border bg-[#FBFAFD] px-4 py-3.5" style={{ borderColor: BORDA }}>
          <p className="text-[0.8125rem] text-[#282525]">E-mail do seu domínio</p>
          <p className="text-[0.75rem] text-black/50">Até {numero(cota)} e-mails por mês</p>
          <p className="mt-2 text-[1.125rem] text-[#282525]">{preco} <span className="text-[0.8125rem] text-black/45">por mês, no cartão</span></p>
        </div>
        <p className="text-[0.75rem] text-black/55">Esse valor cobre o custo do provedor de e-mail: o domínio verificado, o envio e o acompanhamento de aberturas e cliques. Você cancela quando quiser, e o que já foi enviado continua no histórico.</p>
      </div>
    </TopSheet>
  );
}

export type DadosDoDominio = { dominio: string; endereco_local: string; nome_exibicao: string; responder_para: string };

/** O domínio de envio: o domínio, o começo do endereço, o nome que aparece e o e-mail das respostas. */
export function DominioDoEmailSheet({ inicial, trabalhando, erro, onSalvar, onClose }: { inicial: DadosDoDominio; trabalhando?: boolean; erro?: string | null; onSalvar?: (d: DadosDoDominio) => void; onClose: () => void }) {
  const [d, setD] = useState(inicial);
  const mudar = (campo: keyof DadosDoDominio) => (e: React.ChangeEvent<HTMLInputElement>) => setD(x => ({ ...x, [campo]: e.target.value }));
  const dominioLimpo = d.dominio.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  const pode = !trabalhando && dominioLimpo.includes(".") && d.nome_exibicao.trim() !== "";
  return (
    <TopSheet titulo="Seu domínio de envio" onClose={onClose} largura="34rem" footer={fechar => (
      <>
        <button type="button" onClick={fechar} disabled={trabalhando} className={CANCELAR}>Cancelar</button>
        <button type="button" onClick={() => onSalvar?.(d)} disabled={!pode} className={FINAL}>{trabalhando ? "Continuando…" : "Continuar"}</button>
      </>
    )}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <div>
          <label className={ROTULO} htmlFor="email-dominio">Domínio</label>
          <input id="email-dominio" className={CAMPO} value={d.dominio} onChange={mudar("dominio")} placeholder="novidades.seusite.com.br" autoComplete="off" inputMode="url" disabled={trabalhando} />
          <p className="mt-1.5 text-[0.6875rem] text-black/45">Use um subdomínio, como novidades.seusite.com.br: o site e o e-mail que você já usa continuam como estão.</p>
        </div>
        <div>
          <label className={ROTULO} htmlFor="email-endereco">Endereço de envio</label>
          <div className="flex items-center gap-2">
            <input id="email-endereco" className={`${CAMPO} max-w-[11rem]`} value={d.endereco_local} onChange={mudar("endereco_local")} placeholder="ingressos" autoComplete="off" disabled={trabalhando} />
            <span className="truncate text-[0.8125rem] text-black/55">@{dominioLimpo || "seusite.com.br"}</span>
          </div>
        </div>
        <div>
          <label className={ROTULO} htmlFor="email-nome">Nome que aparece para quem recebe</label>
          <input id="email-nome" className={CAMPO} value={d.nome_exibicao} onChange={mudar("nome_exibicao")} placeholder="Nome do seu teatro ou companhia" maxLength={120} disabled={trabalhando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="email-respostas">E-mail para as respostas <span className="text-black/35">(opcional)</span></label>
          <input id="email-respostas" className={CAMPO} type="email" value={d.responder_para} onChange={mudar("responder_para")} placeholder="contato@seusite.com.br" autoComplete="off" disabled={trabalhando} />
        </div>
      </div>
    </TopSheet>
  );
}

export type { RegistroDeDns };
