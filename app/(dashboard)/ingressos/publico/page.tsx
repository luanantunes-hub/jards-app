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
import { EnviosDaLoja, NovoEnvioSheet, type DadosDoNovoEnvio, type EnvioParaLista, type SessaoParaEscolher } from "@/components/ticketeria/EnviosView";
import type { CorpoDaImportacaoDeContatos } from "@/lib/ticketeria/contatos-importados";
import { mensagemDoErroDoEnvio, type Segmento } from "@/lib/ticketeria/envios";
import { filtrarPublico, type FiltroDoPublico, type PublicoDaLoja as DadosDoPublico } from "@/lib/ticketeria/publico";

const VAZIO: DadosDoPublico = { contatos: [], resumo: { contatos: 0, aceitaram: 0, aceitaram_porcento: 0, com_whatsapp: 0, sairam: 0 } };
type DadosDosEnvios = { ligado: boolean; segmentos: Segmento[]; sessoes: SessaoParaEscolher[]; envios: EnvioParaLista[] };
const SEM_ENVIOS: DadosDosEnvios = { ligado: false, segmentos: [], sessoes: [], envios: [] };
const ABAS: ["contatos" | "envios", string][] = [["contatos", "Contatos"], ["envios", "Envios"]];

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
  const [aba, setAba] = useState<"contatos" | "envios">("contatos");
  const [filtro, setFiltro] = useState<FiltroDoPublico>("todos");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  const [avisoDoEnvio, setAvisoDoEnvio] = useState<string | null>(null);

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
      setAvisoDaImportacao(`${(d.novos ?? 0).toLocaleString("pt-BR")} ${d.novos === 1 ? "contato novo importado" : "contatos novos importados"}${d.ja_existiam ? `; ${d.ja_existiam.toLocaleString("pt-BR")} já estavam no Público` : ""}.`);
      try { setEstado({ dados: await carregarPublico(lojaId) }); } catch { /* a lista fica como estava até recarregar */ }
      void carregarEnvios(lojaId);
    } catch {
      setErroDaImportacao("Sem conexão. Tente de novo.");
    } finally {
      setImportando(false);
    }
  }

  async function enviar(d: DadosDoNovoEnvio, teste: boolean) {
    if (!lojaId) return;
    setTrabalhando(true);
    setErroDoEnvio(null);
    setAvisoDoEnvio(null);
    try {
      const r = await fetch(`/api/ticketeria/lojas/${lojaId}/envios`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...d, teste }) });
      const corpo = (await r.json().catch(() => ({}))) as { error?: string; total?: number; limite?: number };
      if (!r.ok) { setErroDoEnvio(mensagemDoErroDoEnvio(corpo.error ?? "", corpo)); return; }
      if (teste) { setAvisoDoEnvio("Enviamos um teste para o seu e-mail."); return; }
      setNovo(false);
      setAba("envios");
      await carregarEnvios(lojaId);
    } catch {
      setErroDoEnvio("Sem conexão. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

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
            {aba === "contatos"
              ? <PublicoDaLoja resumo={dados.resumo} contatos={contatos} filtro={filtro} busca={busca} onFiltrar={setFiltro} onBuscar={setBusca} />
              : <EnviosDaLoja envios={envios.envios} />}
          </div>
        )}
      </ListContent>
      {importar && <ImportarContatosSheet loja={lojaNome} erro={erroDaImportacao} importando={importando} onClose={() => setImportar(false)} onImportar={c => void importarContatos(c)} />}
      {novo && <NovoEnvioSheet segmentos={envios.segmentos} sessoes={envios.sessoes} ligado={envios.ligado} origem={window.location.origin} erro={erroDoEnvio} aviso={avisoDoEnvio} trabalhando={trabalhando} onTeste={d => void enviar(d, true)} onEnviar={d => void enviar(d, false)} onClose={() => setNovo(false)} />}
    </>
  );
}
