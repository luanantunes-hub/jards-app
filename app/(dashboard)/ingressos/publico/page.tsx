"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, Send } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ListContent, ListPageHeader, PrimaryListAction, SecondaryListAction } from "@/components/list/ListPagePrimitives";
import { DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PublicoDaLoja } from "@/components/ticketeria/PublicoView";
import { ImportarContatosSheet } from "@/components/ticketeria/ImportarContatosSheet";
import { EmailDaLoja, AtivarEmailSheet, DominioDoEmailSheet, type DadosDoDominio } from "@/components/ticketeria/EmailView";
import { EnviosDaLoja, ListaDoWhatsAppSheet, NovoEnvioSheet, type DadosDoNovoEnvio, type EnvioParaLista, type SessaoParaEscolher } from "@/components/ticketeria/EnviosView";
import type { CorpoDaImportacaoDeContatos } from "@/lib/ticketeria/contatos-importados";
import { mensagemDoErroDoEnvio, type PessoaDoWhatsapp, type Segmento } from "@/lib/ticketeria/envios";
import { COTA_PADRAO_DE_EMAILS, MOTIVOS_DO_REMETENTE, PRECO_DO_EMAIL_CENTAVOS, type RemetenteParaATela } from "@/lib/ticketeria/remetente";
import { filtrarPublico, type FiltroDoPublico, type PublicoDaLoja as DadosDoPublico } from "@/lib/ticketeria/publico";

const VAZIO: DadosDoPublico = { contatos: [], resumo: { contatos: 0, aceitaram: 0, aceitaram_porcento: 0, com_whatsapp: 0, sairam: 0 } };
type DadosDosEnvios = { ligado: boolean; email: RemetenteParaATela; segmentos: Segmento[]; segmentos_whatsapp?: Segmento[]; sessoes: SessaoParaEscolher[]; envios: EnvioParaLista[] };
const SEM_EMAIL: RemetenteParaATela = { assinatura: "nenhuma", periodo_fim: null, cancela_no_fim: false, dominio: null, endereco_local: "ingressos", nome_exibicao: null, responder_para: null, situacao: "sem_dominio", registros: [], usados: 0, cota: COTA_PADRAO_DE_EMAILS, preco_centavos: PRECO_DO_EMAIL_CENTAVOS, pode_enviar: false };
const SEM_ENVIOS: DadosDosEnvios = { ligado: false, email: SEM_EMAIL, segmentos: [], sessoes: [], envios: [] };
type Aba = "contatos" | "envios" | "email";
const ERROS_DO_EMAIL: Record<string, string> = {
  so_administrador: "Só quem administra a organização pode ativar o e-mail.",
  cobranca_nao_configurada: "A cobrança do e-mail ainda não está ligada. Fale com o suporte do Jards.",
  ja_assinado: "O e-mail já está ativo.",
  email_nao_ativo: "Ative o e-mail antes de escolher o domínio.",
  provedor_indisponivel: "O envio de e-mail ainda não está ligado. Fale com o suporte do Jards.",
  provedor_falhou: "O provedor de e-mail não respondeu direito. Tente de novo em instantes.",
  dominio_em_uso: "Esse domínio já está em uso em outra conta. Use outro ou fale com o suporte.",
  sem_dominio: "Escolha o domínio primeiro.",
  teste_falhou: "Não foi possível enviar o teste agora. Tente de novo em instantes.",
  sem_email_para_o_teste: "Sua conta não tem e-mail para receber o teste.",
  muitas_tentativas: "Muitas tentativas seguidas. Espere um pouco.",
};
const ABAS: [Aba, string][] = [["contatos", "Contatos"], ["envios", "Envios"], ["email", "E-mail"]];

function textoDoErroDoEmail(codigo: string | undefined, status: number) { return ERROS_DO_EMAIL[codigo ?? ""] ?? (status === 429 ? ERROS_DO_EMAIL.muitas_tentativas : "Não foi possível agora. Tente de novo em instantes."); }

/** Chama uma rota do e-mail da loja e devolve a resposta lida (ou o texto do erro). */
async function chamarEmail(lojaId: string | null | undefined, caminho: string, metodo: "POST" | "PUT", corpo?: unknown): Promise<{ ok: true; dados: { remetente?: RemetenteParaATela; url?: string; teste?: boolean } } | { ok: false; erro: string; problemas?: string[] }> {
  try {
    const r = await fetch(`/api/ticketeria/lojas/${lojaId}/${caminho}`, { method: metodo, headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const d = (await r.json().catch(() => ({}))) as { error?: string; problemas?: string[]; remetente?: RemetenteParaATela; url?: string; teste?: boolean };
    if (!r.ok) return { ok: false, erro: d.error === "dados_invalidos" && d.problemas?.length ? d.problemas.join(" ") : textoDoErroDoEmail(d.error, r.status), problemas: d.problemas };
    return { ok: true, dados: d };
  } catch {
    return { ok: false, erro: "Sem conexão. Tente de novo." };
  }
}

/** Público: quem comprou ou entrou na lista de espera, com o aceite de novidades, e os envios de divulgação por e-mail. Lê das rotas do servidor, que conferem quem edita a Ticketeria. */
export default function PublicoPage() {
  const organizationId = useOrganizationId();
  const [lojaId, setLojaId] = useState<string | null | undefined>(undefined);
  const [lojaNome, setLojaNome] = useState("");
  const [importar, setImportar] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erroDaImportacao, setErroDaImportacao] = useState<string | null>(null);
  const [avisoDaImportacao, setAvisoDaImportacao] = useState<string | null>(null);
  const [estado, setEstado] = useState<{ dados: DadosDoPublico | null } | undefined>(undefined);
  const [envios, setEnvios] = useState<DadosDosEnvios>(SEM_ENVIOS);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("contatos");
  const [filtro, setFiltro] = useState<FiltroDoPublico>("todos");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  // A lista de um envio por WhatsApp aberta: o envio, o nome e as pessoas (cada uma com o link da conversa).
  const [listaWhatsapp, setListaWhatsapp] = useState<{ envio: string; assunto: string; pessoas: PessoaDoWhatsapp[] } | null>(null);
  const [erroDaLista, setErroDaLista] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  const [avisoDoEnvio, setAvisoDoEnvio] = useState<string | null>(null);
  // A aba E-mail: a folha de ativar, a do domínio, e o que está acontecendo (pagamento, conferência do DNS, teste).
  const [ativarEmail, setAtivarEmail] = useState(false);
  const [dominioEmail, setDominioEmail] = useState(false);
  const [trabalhandoEmail, setTrabalhandoEmail] = useState(false);
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null);
  const [avisoDoEmail, setAvisoDoEmail] = useState<string | null>(null);
  const [erroDaFolhaDoEmail, setErroDaFolhaDoEmail] = useState<string | null>(null);

  const carregarEnvios = useCallback(async (loja: string) => {
    try {
      const r = await fetch(`/api/ticketeria/lojas/${loja}/envios`, { cache: "no-store" });
      if (r.ok) setEnvios((await r.json()) as DadosDosEnvios);
    } catch { /* a lista de envios fica como estava */ }
  }, []);

  const carregarPublico = useCallback(async (loja: string): Promise<DadosDoPublico> => {
    const resposta = await fetch(`/api/ticketeria/lojas/${loja}/publico`, { cache: "no-store" });
    if (!resposta.ok) throw new Error(String(resposta.status));
    return (await resposta.json()) as DadosDoPublico;
  }, []);

  const guardarEmail = useCallback((email: RemetenteParaATela) => setEnvios(e => ({ ...e, email })), []);
  async function assinarEmail() {
    if (!lojaId) return;
    setTrabalhandoEmail(true);
    setErroDaFolhaDoEmail(null);
    const r = await chamarEmail(lojaId, "remetente/assinar", "POST");
    if (r.ok && r.dados.url) { window.location.assign(r.dados.url); return; }
    setErroDaFolhaDoEmail(r.ok ? "Não foi possível abrir o pagamento." : r.erro);
    setTrabalhandoEmail(false);
  }

  async function gerenciarAssinatura() {
    setErroDoEmail(null);
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { url?: string };
      if (r.ok && d.url) { window.location.assign(d.url); return; }
    } catch { /* cai na mensagem abaixo */ }
    setErroDoEmail("Não foi possível abrir a gestão da assinatura agora. Tente de novo em instantes.");
  }

  async function salvarDominio(d: DadosDoDominio) {
    setTrabalhandoEmail(true);
    setErroDaFolhaDoEmail(null);
    const r = await chamarEmail(lojaId, "remetente", "PUT", { dominio: d.dominio, endereco_local: d.endereco_local, nome_exibicao: d.nome_exibicao, responder_para: d.responder_para });
    setTrabalhandoEmail(false);
    if (!r.ok) { setErroDaFolhaDoEmail(r.erro); return; }
    if (r.dados.remetente) guardarEmail(r.dados.remetente);
    setDominioEmail(false);
    setAvisoDoEmail(null);
  }

  const verificarDominio = useCallback(async (silencioso = false) => {
    if (!lojaId) return;
    if (!silencioso) { setTrabalhandoEmail(true); setErroDoEmail(null); setAvisoDoEmail(null); }
    const r = await chamarEmail(lojaId, "remetente/verificar", "POST");
    if (!silencioso) setTrabalhandoEmail(false);
    if (!r.ok) { if (!silencioso) setErroDoEmail(r.erro); return; }
    if (r.dados.remetente) {
      guardarEmail(r.dados.remetente);
      if (!silencioso) setAvisoDoEmail(r.dados.remetente.situacao === "verificado" ? "Domínio verificado. O e-mail já pode sair." : "Ainda não deu para confirmar: o provedor do domínio pode levar um tempo para valer. Tente de novo mais tarde.");
    }
  }, [lojaId, guardarEmail]);

  async function testeDoEmail() {
    setTrabalhandoEmail(true);
    setErroDoEmail(null);
    setAvisoDoEmail(null);
    const r = await chamarEmail(lojaId, "remetente/teste", "POST");
    setTrabalhandoEmail(false);
    if (r.ok) setAvisoDoEmail("Enviamos um teste para o seu e-mail."); else setErroDoEmail(r.erro);
  }

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    void (async () => {
      const { data: loja, error } = await clienteDaTicketeria(createClient()).from("ticketeria_lojas").select("id, nome").eq("organization_id", organizationId).maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não foi possível carregar o público. Recarregue a página."); setEstado({ dados: null }); return; }
      if (!loja) { setLojaId(null); setEstado({ dados: VAZIO }); return; }
      setLojaId(loja.id);
      setLojaNome(loja.nome);
      void carregarEnvios(loja.id);
      try {
        const dados = await carregarPublico(loja.id);
        if (ativo) { setErro(null); setEstado({ dados }); }
      } catch {
        if (ativo) { setErro("Não foi possível carregar o público. Só quem edita a Ticketeria vê esta página."); setEstado({ dados: null }); }
      }
    })();
    return () => { ativo = false; };
  }, [organizationId, carregarEnvios, carregarPublico]);

  // A volta do checkout do Stripe (?aba=email&assinatura=ok&session_id=…): confere o pagamento e ativa na hora; o endereço volta ao normal.
  useEffect(() => {
    if (!lojaId || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("aba") !== "email") return;
    const sessao = q.get("assinatura") === "ok" ? q.get("session_id") : null;
    const cancelada = q.get("assinatura") === "cancelada";
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      await Promise.resolve();
      setAba("email");
      if (cancelada) { setAvisoDoEmail("O pagamento foi cancelado. Nada foi cobrado."); return; }
      if (!sessao) return;
      setTrabalhandoEmail(true);
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const r = await chamarEmail(lojaId, "remetente/confirmar", "POST", { session_id: sessao });
        if (r.ok) { if (r.dados.remetente) guardarEmail(r.dados.remetente); setAvisoDoEmail("Pagamento confirmado. Agora escolha o seu domínio."); break; }
        if (tentativa === 3) setErroDoEmail("Ainda não conseguimos confirmar o pagamento. Se você pagou, aguarde um instante e recarregue a página.");
        else await new Promise(ok => setTimeout(ok, 2500));
      }
      setTrabalhandoEmail(false);
    })();
  }, [lojaId, guardarEmail]);

  // Esperando o DNS: confere de tempos em tempos (a cada 30 s), sem ruído, enquanto a aba E-mail está aberta.
  const aguardandoDns = envios.email.assinatura === "ativa" && envios.email.situacao === "aguardando_dns";
  useEffect(() => {
    if (!aguardandoDns || aba !== "email") return;
    const timer = setInterval(() => { void verificarDominio(true); }, 30_000);
    return () => clearInterval(timer);
  }, [aguardandoDns, aba, verificarDominio]);

  async function importarContatos(corpo: CorpoDaImportacaoDeContatos) {
    if (!lojaId) return;
    setImportando(true);
    setErroDaImportacao(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/publico/importar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; recebidos?: number; novos?: number; ja_existiam?: number };
      if (!r.ok) { setErroDaImportacao(r.status === 413 ? "O arquivo é grande demais para uma vez só. Divida em partes menores." : r.status === 429 ? "Muitas tentativas seguidas. Espere um pouco." : "Não foi possível importar agora. Tente de novo em instantes."); return; }
      setImportar(false);
      setFiltro("importados");
      setAba("contatos");
      setAvisoDaImportacao(`${(d.novos ?? 0) === 0 ? "Nenhum contato novo" : `${(d.novos ?? 0).toLocaleString("pt-BR")} ${d.novos === 1 ? "contato novo importado" : "contatos novos importados"}`}${d.ja_existiam ? `; ${d.ja_existiam.toLocaleString("pt-BR")} ${d.ja_existiam === 1 ? "já estava" : "já estavam"} no Público e ${d.ja_existiam === 1 ? "foi atualizado" : "foram atualizados"}` : ""}.`);
      try { setEstado({ dados: await carregarPublico(lojaId) }); } catch { /* a lista fica como estava até recarregar */ }
      void carregarEnvios(lojaId);
    } catch {
      setErroDaImportacao("Sem conexão. Tente de novo.");
    } finally {
      setImportando(false);
    }
  }

  async function abrirListaWhatsapp(envio: string, assunto: string) {
    if (!lojaId) return;
    setErroDaLista(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/envios/${envio}/whatsapp`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { pessoas: PessoaDoWhatsapp[] };
      setListaWhatsapp({ envio, assunto, pessoas: d.pessoas });
    } catch {
      setAba("envios");
      setErro("Não foi possível abrir a lista do WhatsApp. Tente de novo.");
    }
  }

  /** Abre a conversa (já no clique, para o navegador não bloquear) e marca a pessoa como enviada. */
  function abrirConversa(p: PessoaDoWhatsapp) {
    if (!lojaId || !listaWhatsapp) return;
    window.open(p.link, "_blank", "noopener,noreferrer");
    const envio = listaWhatsapp.envio;
    setListaWhatsapp(l => (l ? { ...l, pessoas: l.pessoas.map(x => (x.id === p.id ? { ...x, enviada: true } : x)) } : l));
    setErroDaLista(null);
    void (async () => {
      try {
        const r = await fetch(`/api/ticketeria/lojas/${lojaId}/envios/${envio}/whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ destinatario: p.id }) });
        if (!r.ok) throw new Error(String(r.status));
        void carregarEnvios(lojaId);
      } catch {
        setListaWhatsapp(l => (l ? { ...l, pessoas: l.pessoas.map(x => (x.id === p.id ? { ...x, enviada: false } : x)) } : l));
        setErroDaLista("Não consegui marcar como enviada. Tente de novo.");
      }
    })();
  }

  async function enviar(d: DadosDoNovoEnvio, teste: boolean) {
    if (!lojaId) return;
    setTrabalhando(true);
    setErroDoEnvio(null);
    setAvisoDoEnvio(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/envios`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...d, teste }) });
      const corpo = (await r.json().catch(() => ({}))) as { error?: string; total?: number; limite?: number; motivo?: string; restante?: number; envio?: string; pessoas?: PessoaDoWhatsapp[] };
      if (!r.ok) { setErroDoEnvio(mensagemDoErroDoEnvio(corpo.error ?? "", corpo)); return; }
      if (teste) { setAvisoDoEnvio("Enviamos um teste para o seu e-mail."); return; }
      setNovo(false);
      setAba("envios");
      if (d.canal === "whatsapp" && corpo.envio) setListaWhatsapp({ envio: corpo.envio, assunto: d.assunto, pessoas: corpo.pessoas ?? [] });
      await carregarEnvios(lojaId);
    } catch {
      setErroDoEnvio("Sem conexão. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  // Enquanto um envio de e-mail está na fila ("enviando"), a lista se atualiza sozinha a cada 5 segundos.
  const enviandoEmail = envios.envios.some(e => e.canal === "email" && e.situacao === "enviando");
  useEffect(() => {
    if (!enviandoEmail || !lojaId) return;
    const timer = setInterval(() => { void carregarEnvios(lojaId); }, 5000);
    return () => clearInterval(timer);
  }, [enviandoEmail, lojaId, carregarEnvios]);

  const dados = estado?.dados ?? null;
  const contatos = useMemo(() => (dados ? filtrarPublico(dados.contatos, filtro, busca) : []), [dados, filtro, busca]);

  if (estado === undefined || !organizationId) return <DetailPageSkeleton />;
  return (
    <>
      <ListPageHeader title="Público" actions={lojaId ? <><SecondaryListAction onClick={() => { setErroDaImportacao(null); setImportar(true); }}><FileUp size={13} aria-hidden="true" /> Importar planilha</SecondaryListAction><PrimaryListAction onClick={() => { setErroDoEnvio(null); setAvisoDoEnvio(null); setNovo(true); }}><Send size={13} aria-hidden="true" /> Novo envio</PrimaryListAction></> : undefined} />
      <ListContent>
        {avisoDaImportacao && <p role="status" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{avisoDaImportacao}</p>}
        {erro && <p role="alert" className="mb-4 rounded-xl border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        {dados && (
          <div className="space-y-4">
            <div className="flex gap-2" role="group" aria-label="Contatos ou envios">
              {ABAS.map(([id, rotulo]) => (
                <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)} className={`h-8 rounded-xl border px-3 text-[0.75rem] font-normal transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${aba === id ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.12] text-black/55 hover:bg-black/[.04]"}`}>{rotulo}</button>
              ))}
            </div>
            {aba === "email"
              ? <EmailDaLoja email={envios.email} ocupado={trabalhandoEmail} aviso={avisoDoEmail} erro={erroDoEmail} onAtivar={() => { setErroDaFolhaDoEmail(null); setAtivarEmail(true); }} onEscolherDominio={() => { setErroDaFolhaDoEmail(null); setDominioEmail(true); }} onVerificar={() => void verificarDominio()} onGerenciar={() => void gerenciarAssinatura()} onTeste={() => void testeDoEmail()} />
              : aba === "contatos"
              ? <PublicoDaLoja resumo={dados.resumo} contatos={contatos} filtro={filtro} busca={busca} onFiltrar={setFiltro} onBuscar={setBusca} />
              : <EnviosDaLoja envios={envios.envios} onContinuar={id => void abrirListaWhatsapp(id, envios.envios.find(e => e.id === id)?.assunto ?? "")} />}
          </div>
        )}
      </ListContent>
      {importar && <ImportarContatosSheet loja={lojaNome} erro={erroDaImportacao} importando={importando} onClose={() => setImportar(false)} onImportar={c => void importarContatos(c)} />}
      {listaWhatsapp && <ListaDoWhatsAppSheet assunto={listaWhatsapp.assunto} pessoas={listaWhatsapp.pessoas} erro={erroDaLista} onAbrir={abrirConversa} onClose={() => setListaWhatsapp(null)} />}
      {ativarEmail && <AtivarEmailSheet cota={envios.email.cota} trabalhando={trabalhandoEmail} erro={erroDaFolhaDoEmail} onContinuar={() => void assinarEmail()} onClose={() => setAtivarEmail(false)} />}
      {dominioEmail && <DominioDoEmailSheet inicial={{ dominio: envios.email.dominio ?? "", endereco_local: envios.email.endereco_local, nome_exibicao: envios.email.nome_exibicao ?? lojaNome, responder_para: envios.email.responder_para ?? "" }} trabalhando={trabalhandoEmail} erro={erroDaFolhaDoEmail} onSalvar={d => void salvarDominio(d)} onClose={() => setDominioEmail(false)} />}
      {novo && <NovoEnvioSheet segmentos={envios.segmentos} segmentosWhatsapp={envios.segmentos_whatsapp ?? []} sessoes={envios.sessoes} ligado={envios.ligado && envios.email.pode_enviar} motivoDoBloqueio={envios.ligado && !envios.email.pode_enviar ? `${envios.email.assinatura !== "ativa" ? MOTIVOS_DO_REMETENTE.sem_assinatura : envios.email.situacao === "sem_dominio" ? MOTIVOS_DO_REMETENTE.sem_dominio : MOTIVOS_DO_REMETENTE.dominio_nao_verificado} Veja a aba E-mail.` : null} origem={window.location.origin} erro={erroDoEnvio} aviso={avisoDoEnvio} trabalhando={trabalhando} onTeste={d => void enviar(d, true)} onEnviar={d => void enviar(d, false)} onClose={() => setNovo(false)} />}
    </>
  );
}
