"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { ListContent, ListEmptyState, ListTableSurface } from "@/components/list/ListPagePrimitives";

type Agendado = { id: string; provider: "google" | "microsoft"; para: string[]; cc: string[]; assunto: string; enviar_em: string; estado: "pendente" | "enviando" | "falhou"; erro: string | null };

function quandoSai(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Os e-mails agendados que ainda não saíram, e os que falharam (com o motivo). Dá para cancelar qualquer um. */
export function AgendadosDeEmail({ versao }: { versao: number }) {
  const [agendados, setAgendados] = useState<Agendado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/email/agendados", { cache: "no-store" });
      const json = (await resposta.json().catch(() => ({}))) as { agendados?: Agendado[]; error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível carregar os agendados.");
      setAgendados(json.agendados ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os agendados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar, versao]);

  async function cancelar(id: string) {
    setCancelando(id);
    setErro(null);
    try {
      const resposta = await fetch("/api/email/agendados/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível cancelar.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar.");
      await carregar();
    } finally {
      setCancelando(null);
    }
  }

  return (
    <ListContent>
      {erro && <p role="alert" className="mb-4 rounded border border-[#D94A4A]/25 bg-white px-4 py-3 text-[0.8125rem] text-[#B23B3B]">{erro}</p>}
      {carregando ? (
        <p className="py-16 text-center text-[0.75rem] text-black/35">Carregando…</p>
      ) : agendados.length === 0 ? (
        <ListEmptyState icon={Clock} title="Nenhum e-mail agendado" description="Ao escrever um e-mail, escolha Agendar e ele sai sozinho na hora marcada, da sua própria caixa." />
      ) : (
        <ListTableSurface>
          <ul className="divide-y divide-black/[.06]">
            {agendados.map(item => (
              <li key={item.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-semibold text-[#282525]">{item.assunto}</p>
                  <p className="truncate text-[0.75rem] text-black/45">Para {item.para.join(", ")}</p>
                  {item.estado === "falhou"
                    ? <p className="mt-1 text-[0.75rem] text-[#B23B3B]">Não saiu: {item.erro ?? "erro ao enviar"}</p>
                    : <p className="mt-1 text-[0.75rem] text-black/50">{item.estado === "enviando" ? "Enviando agora…" : `Sai em ${quandoSai(item.enviar_em)}`}</p>}
                </div>
                <button type="button" onClick={() => void cancelar(item.id)} disabled={cancelando === item.id || item.estado === "enviando"} className="h-8 shrink-0 rounded px-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-40">
                  {cancelando === item.id ? "Cancelando…" : item.estado === "falhou" ? "Descartar" : "Cancelar envio"}
                </button>
              </li>
            ))}
          </ul>
        </ListTableSurface>
      )}
    </ListContent>
  );
}
