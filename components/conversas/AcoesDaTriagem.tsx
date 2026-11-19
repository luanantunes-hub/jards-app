"use client";

import { useState } from "react";
import { BriefcaseBusiness, Check, MoreHorizontal, Pencil, UserPlus, X } from "lucide-react";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";
import { dominioDoEmail } from "@/lib/email/triagem";
import { createClient } from "@/lib/supabase/client";
import type { RemetenteDaTriagem } from "@/app/api/email/triagem/route";

const VERDE = "#3DA86A";
const BOTAO = "flex h-8 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";
const ITEM_DO_MENU = "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-[0.8125rem] text-[#282525] outline-none transition hover:bg-black/[.04] focus-visible:bg-black/[.04] disabled:cursor-not-allowed disabled:text-black/30 disabled:hover:bg-transparent";

/**
 * A empresa do contato: reaproveita uma já cadastrada com o mesmo nome (evita duplicar) ou cria uma nova, já com o
 * domínio como site — assim a próxima pessoa desse domínio encontra essa empresa pelo site, sem precisar de palpite.
 */
async function obterOuCriarEmpresa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  accountId: string,
  organizationId: string,
  nome: string,
  dominio: string | null,
): Promise<string> {
  const { data: existente } = await supabase
    .from("empresas_crm")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("nome", nome)
    .maybeSingle();
  if (existente) return existente.id as string;
  const { data: criada, error } = await supabase
    .from("empresas_crm")
    .insert({ nome, site: dominio, organization_id: organizationId, account_id: accountId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return criada.id as string;
}

type ItemDoMenu = { label: string; icone: typeof Pencil; onClick: () => void; disabled?: boolean; titulo?: string };

/**
 * Os três passos para quem ainda não é contato, dentro da conversa aberta: criar o contato (com a empresa sugerida
 * pelo domínio, ou uma nova empresa com o nome que o domínio sugere), registrar a conversa para a equipe e abrir a
 * negociação. Nenhum é obrigatório, e "Dispensar" apaga as cópias guardadas. Até registrar, a conversa é só sua.
 *
 * Só a ação seguinte mais provável fica à vista — "Criar contato" antes dele existir, "Registrar conversa" depois —,
 * e o resto ("Editar antes de criar", "Criar negociação", "Dispensar") mora nos três pontos ao lado, para o card não
 * virar uma fileira de botões. Criar contato é um clique só: o nome e o e-mail já são conhecidos, a empresa é a
 * sugerida, e sem nenhuma que já combine, a empresa nasce junto, com o nome que o domínio sugere. Depois de criado,
 * o contato (e a empresa) se corrigem na própria ficha, como qualquer outro.
 */
export function AcoesDaTriagem({ remetente, onMudou }: { remetente: RemetenteDaTriagem; onMudou: () => void }) {
  const [tratando, setTratando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoContato, setEditandoContato] = useState(false);
  const [novaNegociacao, setNovaNegociacao] = useState(false);
  const { pos, abrir, fechar } = useAnchoredPopover();
  const contato = remetente.contato;
  const ocupado = tratando !== null || criando;

  async function tratar(acao: "registrar" | "dispensar") {
    setTratando(acao);
    setErro(null);
    try {
      const resposta = await fetch(`/api/email/triagem/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: remetente.organizationId, endereco: remetente.endereco }),
      });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível concluir.");
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setTratando(null);
    }
  }

  async function criarContatoRapido() {
    setCriando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Entre de novo para criar o contato.");

      let empresaCrmId = remetente.sugestaoDeEmpresa?.id ?? null;
      if (!empresaCrmId && remetente.nomeDaEmpresaPeloDominio) {
        empresaCrmId = await obterOuCriarEmpresa(
          supabase, user.id, remetente.organizationId, remetente.nomeDaEmpresaPeloDominio, dominioDoEmail(remetente.endereco),
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("contatos")
        .insert({
          account_id: user.id,
          organization_id: remetente.organizationId,
          nome: remetente.nomeSugerido,
          email: remetente.endereco,
          empresa_crm_id: empresaCrmId,
        });
      if (error) throw new Error(error.message);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o contato.");
    } finally {
      setCriando(false);
    }
  }

  function noMenu(acao: () => void) {
    fechar();
    acao();
  }

  // O que fica nos três pontos: o resto dos passos, sempre na mesma ordem, cada um com a sua condição de ficar desabilitado.
  const itensDoMenu: ItemDoMenu[] = [
    ...(!contato ? [{ label: "Editar antes de criar", icone: Pencil, onClick: () => noMenu(() => setEditandoContato(true)) }] : []),
    {
      label: "Registrar conversa", icone: Check, onClick: () => noMenu(() => void tratar("registrar")),
      disabled: !contato || ocupado, titulo: contato ? undefined : "Crie o contato primeiro",
    },
    {
      label: "Criar negociação", icone: BriefcaseBusiness, onClick: () => noMenu(() => setNovaNegociacao(true)),
      disabled: !contato?.empresaId || ocupado, titulo: contato?.empresaId ? undefined : "Crie o contato em uma empresa primeiro",
    },
    { label: tratando === "dispensar" ? "Dispensando…" : "Dispensar", icone: X, onClick: () => noMenu(() => void tratar("dispensar")), disabled: ocupado },
  ];

  return (
    <div className="mb-4 rounded border bg-[#FBFAFA] px-4 py-3.5" style={{ borderColor: "rgba(13,13,13,.09)" }}>
      {editandoContato && (
        <NovoContatoModal
          initialNome={remetente.nomeSugerido}
          initialEmail={remetente.endereco}
          empresaPreId={remetente.sugestaoDeEmpresa?.id}
          onClose={() => setEditandoContato(false)}
          onSaved={() => { setEditandoContato(false); onMudou(); }}
        />
      )}
      {novaNegociacao && contato?.empresaId && (
        <NovaCaptacaoModal empresaPreId={contato.empresaId} onClose={() => setNovaNegociacao(false)} onSaved={() => { setNovaNegociacao(false); onMudou(); }} />
      )}

      {contato
        ? <p className="flex items-center gap-1.5 text-[0.75rem] font-medium" style={{ color: VERDE }}><Check size={12} aria-hidden="true" />Contato criado{contato.empresaNome ? ` em ${contato.empresaNome}` : " sem empresa"}</p>
        : <p className="text-[0.75rem] text-black/55">
            {remetente.sugestaoDeEmpresa
              ? <>Parece ser da <span className="font-medium text-[#282525]">{remetente.sugestaoDeEmpresa.nome}</span>{remetente.sugestaoDeEmpresa.motivo === "site" ? ", pelo site da empresa" : ", pelos outros contatos dela"}.</>
              : remetente.nomeDaEmpresaPeloDominio
                ? <>Pelo domínio do e-mail, deve ser da <span className="font-medium text-[#282525]">{remetente.nomeDaEmpresaPeloDominio}</span>. Ao criar o contato, a empresa nasce junto.</>
                : "Essa pessoa ainda não está nos seus contatos."}
          </p>}

      {erro && <p role="alert" className="mt-2 text-[0.75rem] text-[#B23B3B]">{erro}</p>}

      <div className="mt-3 flex items-center gap-2">
        {contato ? (
          <button type="button" onClick={() => void tratar("registrar")} disabled={ocupado} className={BOTAO}>
            <Check size={13} aria-hidden="true" />{tratando === "registrar" ? "Registrando…" : "Registrar conversa"}
          </button>
        ) : (
          <button type="button" onClick={() => void criarContatoRapido()} disabled={ocupado} className={BOTAO}>
            <UserPlus size={13} aria-hidden="true" />{criando ? "Criando…" : "Criar contato"}
          </button>
        )}
        <button
          type="button"
          onClick={(event) => abrir(event, 220)}
          disabled={ocupado}
          aria-label="Mais ações"
          aria-haspopup="menu"
          title="Mais ações"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-black/12 bg-white text-black/45 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        >
          <MoreHorizontal size={15} aria-hidden="true" />
        </button>
      </div>

      <AnchoredPopover pos={pos} onClose={fechar}>
        <div className="-m-2 flex flex-col" role="menu" aria-label="Mais ações">
          {itensDoMenu.map(({ label, icone: Icone, onClick, disabled, titulo }) => (
            <button key={label} type="button" role="menuitem" onClick={onClick} disabled={disabled} title={titulo} className={ITEM_DO_MENU}>
              <Icone size={13} className="shrink-0 text-black/40" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </AnchoredPopover>
    </div>
  );
}
