"use client";

import { useState } from "react";
import { BriefcaseBusiness, Check, Pencil, UserPlus } from "lucide-react";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import { dominioDoEmail } from "@/lib/email/triagem";
import { createClient } from "@/lib/supabase/client";
import type { RemetenteDaTriagem } from "@/app/api/email/triagem/route";

const VERDE = "#3DA86A";
const BOTAO = "flex h-8 items-center gap-1.5 rounded border border-black/12 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

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

/**
 * Os três passos para quem ainda não é contato, dentro da conversa aberta: criar o contato (com a empresa sugerida
 * pelo domínio, ou uma nova empresa com o nome que o domínio sugere), registrar a conversa para a equipe e abrir a
 * negociação. Nenhum é obrigatório, e "Dispensar" apaga as cópias guardadas. Até registrar, a conversa é só sua.
 *
 * Criar contato é um clique só: o nome e o e-mail já são conhecidos, a empresa é a sugerida, e sem nenhuma que já
 * combine, a empresa nasce junto, com o nome que o domínio sugere. "Editar antes de criar" fica como saída para
 * quem quer ajustar algo primeiro — telefone, cargo, outra empresa —, abrindo o mesmo formulário completo que o
 * resto do Jards usa. Depois de criado, o contato (e a empresa) se corrigem na própria ficha, como qualquer outro.
 */
export function AcoesDaTriagem({ remetente, onMudou }: { remetente: RemetenteDaTriagem; onMudou: () => void }) {
  const [tratando, setTratando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoContato, setEditandoContato] = useState(false);
  const [novaNegociacao, setNovaNegociacao] = useState(false);
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!contato && (
          <>
            <button type="button" onClick={() => void criarContatoRapido()} disabled={ocupado} className={BOTAO}>
              <UserPlus size={13} aria-hidden="true" />{criando ? "Criando…" : "Criar contato"}
            </button>
            <button type="button" onClick={() => setEditandoContato(true)} disabled={ocupado} className="flex h-8 items-center gap-1.5 rounded px-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">
              <Pencil size={12} aria-hidden="true" />Editar antes de criar
            </button>
          </>
        )}
        <button type="button" onClick={() => void tratar("registrar")} disabled={!contato || ocupado} title={contato ? undefined : "Crie o contato primeiro"} className={BOTAO}>
          <Check size={13} aria-hidden="true" />{tratando === "registrar" ? "Registrando…" : "Registrar conversa"}
        </button>
        <button type="button" onClick={() => setNovaNegociacao(true)} disabled={!contato?.empresaId || ocupado} title={contato?.empresaId ? undefined : "Crie o contato em uma empresa primeiro"} className={BOTAO}>
          <BriefcaseBusiness size={13} aria-hidden="true" />Criar negociação
        </button>
        <button type="button" onClick={() => void tratar("dispensar")} disabled={ocupado} className="h-8 rounded px-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">
          {tratando === "dispensar" ? "Dispensando…" : "Dispensar"}
        </button>
      </div>
    </div>
  );
}
