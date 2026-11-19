"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { ListContent, ListEmptyState, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { ConversaDeEmail } from "@/components/relationship/ConversaDeEmail";
import { LinhaDeConversa } from "@/components/relationship/LinhaDeConversa";
import { contagemPorFiltro, conversaNoFiltro, FILTROS_DA_CAIXA, quemDaConversa, type FiltroDaCaixa } from "@/lib/email/caixa";
import { agruparConversas, COLUNAS_DO_EMAIL_DE_CONVERSA, type EmailDeConversa } from "@/lib/email/conversas";
import { emPartes } from "@/lib/email/lotes";
import { createClient } from "@/lib/supabase/client";

/** As últimas mensagens da própria caixa que a tela agrupa em conversas. */
const MENSAGENS_NA_CAIXA = 600;

function dataDaConversa(ms: number | null): string {
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * A caixa de entrada do Jards: as conversas por e-mail da própria pessoa (de contatos e de quem ainda não é contato),
 * agrupadas em fios. Só lê o que a pessoa já tem sincronizado; a política de linha do banco garante que ela só vê a própria caixa.
 */
export function CaixaDeEntrada({ versao }: { versao: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [emails, setEmails] = useState<EmailDeConversa[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDaCaixa>("todas");
  const [chaveAberta, setChaveAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const usuario = auth.user?.id ?? null;
      setMeuId(usuario);
      if (!usuario) throw new Error("Entre de novo para ver seus e-mails.");
      const { data, error } = await (supabase as any)
        .from("emails")
        .select(COLUNAS_DO_EMAIL_DE_CONVERSA)
        .eq("user_id", usuario)
        .order("sent_at", { ascending: false })
        .limit(MENSAGENS_NA_CAIXA);
      if (error) throw new Error(error.message);
      const lidos = (data ?? []) as EmailDeConversa[];
      setEmails(lidos);

      const idsDeContatos = [...new Set(lidos.map((email) => email.contato_id).filter((id): id is string => Boolean(id)))];
      const porId: Record<string, string> = {};
      for (const parte of emPartes(idsDeContatos, 100)) {
        const { data: contatos } = await (supabase as any).from("contatos").select("id, nome").in("id", parte);
        for (const contato of (contatos ?? []) as Array<{ id: string; nome: string | null }>) if (contato.nome) porId[contato.id] = contato.nome;
      }
      setNomes(porId);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar seus e-mails.");
    } finally {
      setCarregando(false);
    }
  }, [supabase]);

  useEffect(() => { void carregar(); }, [carregar, versao]);

  const conversas = useMemo(() => agruparConversas(emails), [emails]);
  const contagem = useMemo(() => contagemPorFiltro(conversas), [conversas]);
  const visiveis = useMemo(() => conversas.filter((conversa) => conversaNoFiltro(conversa, filtro)), [conversas, filtro]);
  const conversaAberta = chaveAberta ? conversas.find((conversa) => conversa.chave === chaveAberta) ?? null : null;
  const contatosParaOPainel = useMemo(() => Object.entries(nomes).map(([id, nome]) => ({ id, nome })), [nomes]);

  return (
    <>
      {conversaAberta && (
        <ConversaDeEmail
          conversa={conversaAberta}
          meuId={meuId}
          contatos={contatosParaOPainel}
          membros={[]}
          onClose={() => setChaveAberta(null)}
          onMudou={() => void carregar()}
        />
      )}
      <ListContent>
        {erro && <p role="alert" className="mb-4 rounded border border-[#D94A4A]/25 bg-white px-4 py-3 text-[0.8125rem] text-[#B23B3B]">{erro}</p>}
        {carregando ? (
          <p className="py-16 text-center text-[0.75rem] text-black/35">Carregando…</p>
        ) : conversas.length === 0 ? (
          <ListEmptyState
            icon={Mail}
            title="Nenhum e-mail por aqui ainda"
            description="Conecte seu e-mail em Minhas ferramentas e clique em Atualizar. Aparecem as conversas com seus contatos e com quem ainda não é contato."
            action={<Link href="/configuracoes?section=ferramentas" className="flex h-9 items-center rounded px-3 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04]">Abrir Minhas ferramentas</Link>}
          />
        ) : (
          <>
            <div className="mb-3">
              <SegmentedControl
                ariaLabel="Filtrar conversas"
                value={filtro}
                onChange={setFiltro}
                options={FILTROS_DA_CAIXA.map(({ value, label }) => ({ value, label: `${label} · ${contagem[value]}` }))}
              />
            </div>
            {visiveis.length === 0 ? (
              <ListEmptyState icon={Mail} title="Nenhuma conversa neste filtro" filtered onClearFilters={() => setFiltro("todas")} />
            ) : (
              <ListTableSurface>
                <ul className="divide-y divide-black/[.06]">
                  {visiveis.map((conversa) => (
                    <li key={conversa.chave}>
                      <LinhaDeConversa
                        conversa={conversa}
                        data={dataDaConversa(conversa.ultimaEm)}
                        contatos={quemDaConversa(conversa, conversa.contatoIds.map((id) => nomes[id]).filter((nome): nome is string => Boolean(nome)))}
                        canal="E-mail"
                        autor={null}
                        onAbrir={() => setChaveAberta(conversa.chave)}
                      />
                    </li>
                  ))}
                </ul>
              </ListTableSurface>
            )}
          </>
        )}
      </ListContent>
    </>
  );
}
