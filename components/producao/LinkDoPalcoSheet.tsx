"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { BOTAO_PEQUENO, CAMPO, CANCELAR, Erro, ROTULO, SALVAR } from "@/components/producao/estilosDoBordero";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";

type Link = { id: string; expira_em: string; revogado_em: string | null; created_at: string };

const VALIDADES = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** A situação do link para quem produz: no ar, desativado ou vencido. */
function situacaoDoLink(link: Link, agora = Date.now()): "no ar" | "desativado" | "vencido" {
  if (link.revogado_em) return "desativado";
  return new Date(link.expira_em).getTime() <= agora ? "vencido" : "no ar";
}

/** O link da tela de palco (PD7.1): só leitura, com validade, e dá para desativar a qualquer hora. */
export function LinkDoPalcoSheet({ dataId, rotulo, podeEditar, onClose }: { dataId: string; rotulo: string; podeEditar: boolean; onClose: () => void }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [validade, setValidade] = useState("30");
  const [endereco, setEndereco] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_palco_links").select("id, expira_em, revogado_em, created_at").eq("data_id", dataId).order("created_at", { ascending: false });
      if (!ativo) return;
      setLinks((data ?? []) as Link[]);
      if (error) setErro("Não foi possível carregar os links. Recarregue a página.");
    })();
    return () => { ativo = false; };
  }, [dataId, versao]);

  async function gerar() {
    setGerando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_palco_criar_link", { p_data: dataId, p_dias: Number(validade) });
    setGerando(false);
    if (error || !data) { setErro(error?.code === "42501" ? "Você não pode mudar esta data." : "Não foi possível gerar o link. Tente de novo."); return; }
    setEndereco(`${window.location.origin}/palco/${data}`);
    setCopiado(false);
    setVersao(atual => atual + 1);
  }

  async function desativar(link: Link) {
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_palco_links").update({ revogado_em: new Date().toISOString() }).eq("id", link.id);
    if (error) { setErro("Não foi possível desativar. Tente de novo."); return; }
    setVersao(atual => atual + 1);
  }

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o endereço e copie à mão.");
    }
  }

  return (
    <TopSheet
      titulo={`Tela de palco: ${rotulo}`}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} className={CANCELAR}>Fechar</button>
          {podeEditar && <button type="button" onClick={() => void gerar()} disabled={gerando} className={SALVAR}>{gerando ? "Gerando…" : "Gerar link"}</button>}
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <Erro texto={erro} />}
        <p className="text-[0.75rem] text-black/55">
          Quem tem o endereço vê, num telão ou no celular, o bloco em andamento com o tempo que falta, o próximo (já com o atraso) e a lista do dia, atualizados sozinhos. <strong className="font-medium">Pessoas, contatos, notas e dinheiro não aparecem, nem os blocos ocultos ou restritos a um grupo.</strong>
        </p>
        {endereco && (
          <div className="space-y-2 rounded border bg-white p-3" style={{ borderColor: "rgba(13,13,13,.12)" }} role="status">
            <p className="text-[0.75rem] font-medium text-[#282525]">Link pronto. Ele aparece só agora: copie e abra no telão ou envie a quem está no palco.</p>
            <div className="flex items-start gap-2">
              <input readOnly value={endereco} aria-label="Endereço da tela de palco" onFocus={event => event.currentTarget.select()} className={`${CAMPO} min-w-0 flex-1`} />
              <button type="button" onClick={() => void copiar()} className={`${BOTAO_PEQUENO} inline-flex h-10 items-center gap-1.5`}>
                {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}
        {podeEditar && (
          <div className="max-w-xs">
            <span className={ROTULO}>O link vale por</span>
            <Dropdown value={validade} onChange={setValidade} options={VALIDADES} />
          </div>
        )}
        {links === null ? (
          <div className="h-12 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
        ) : links.length > 0 && (
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {links.map(link => {
              const situacao = situacaoDoLink(link);
              return (
                <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block text-[0.8125rem] font-medium text-[#282525]">Criado em {dataBr(link.created_at)}</span>
                    <span className="block text-[0.6875rem] text-black/45">{situacao === "no ar" ? `no ar até ${dataBr(link.expira_em)}` : situacao === "vencido" ? `venceu em ${dataBr(link.expira_em)}` : "desativado"}</span>
                  </span>
                  {podeEditar && situacao === "no ar" && <button type="button" onClick={() => void desativar(link)} className={BOTAO_PEQUENO}>Desativar</button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TopSheet>
  );
}
