"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AcertoPublico, ItemPublico } from "@/lib/producao/acerto-publico";

const CAMPO = "h-11 w-full rounded border border-black/[.12] bg-white px-3 text-[0.9375rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.8125rem] font-medium text-[#282525]";

const SITUACAO_DO_ITEM: Record<ItemPublico["situacao"], string> = { pendente: "", respondido: "Enviado, em revisão", aprovado: "Aprovado", recusado: "Recusado" };

function textoDoValor(item: ItemPublico, valor: string | null): string {
  if (valor === null || valor === "") return "—";
  if (item.tipo === "sim_nao") return valor === "sim" ? "Sim" : "Não";
  if (item.tipo === "data") return valor.split("-").reverse().join("/");
  return valor;
}

function Campo({ item, valor, erro, onChange, desabilitado }: { item: ItemPublico; valor: string; erro?: string; onChange: (valor: string) => void; desabilitado: boolean }) {
  const id = `campo-${item.id}`;
  const descricao = [item.ajuda, erro].filter(Boolean).length > 0 ? `${id}-ajuda` : undefined;
  let controle: React.ReactNode;
  if (item.tipo === "texto") {
    controle = <textarea id={id} rows={3} maxLength={2000} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.9375rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50" value={valor} onChange={event => onChange(event.target.value)} disabled={desabilitado} aria-describedby={descricao} aria-invalid={Boolean(erro)} />;
  } else if (item.tipo === "escolha" || item.tipo === "sim_nao") {
    const opcoes = item.tipo === "sim_nao" ? [{ valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }] : item.opcoes.map(opcao => ({ valor: opcao, rotulo: opcao }));
    controle = (
      <div role="radiogroup" aria-labelledby={`${id}-rotulo`} className="flex flex-wrap gap-2">
        {opcoes.map(opcao => (
          <button key={opcao.valor} type="button" role="radio" aria-checked={valor === opcao.valor} disabled={desabilitado} onClick={() => onChange(valor === opcao.valor ? "" : opcao.valor)}
            className={`h-11 rounded border px-4 text-[0.875rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50 ${valor === opcao.valor ? "border-[#282525] bg-black/[.08] font-medium text-[#282525]" : "border-black/[.12] text-black/60 hover:bg-black/[.04]"}`}>
            {opcao.rotulo}
          </button>
        ))}
      </div>
    );
  } else {
    controle = <input id={id} type={item.tipo === "data" ? "date" : item.tipo === "hora" ? "time" : "text"} inputMode={item.tipo === "numero" ? "decimal" : undefined} className={CAMPO} value={valor} onChange={event => onChange(event.target.value)} disabled={desabilitado} aria-describedby={descricao} aria-invalid={Boolean(erro)} />;
  }
  return (
    <div>
      <label id={`${id}-rotulo`} htmlFor={id} className={ROTULO}>{item.rotulo}{item.visibilidade === "opcional" ? <span className="font-normal text-black/45"> (opcional)</span> : null}</label>
      {controle}
      {(item.ajuda || erro) && <p id={`${id}-ajuda`} className={`mt-1.5 text-[0.75rem] ${erro ? "text-[#B23B3B]" : "text-black/45"}`}>{erro ?? item.ajuda}</p>}
    </div>
  );
}

/** O acerto técnico visto pela casa: o que a produção pede, o que já foi respondido e o formulário do que falta. */
export function RespostaDoAcerto({ codigo, acerto }: { codigo: string; acerto: AcertoPublico }) {
  const router = useRouter();
  const editaveis = useMemo(() => acerto.itens.filter(item => item.editavel), [acerto.itens]);
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(editaveis.map(item => [item.id, item.resposta ?? ""])));
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const secoes = useMemo(() => {
    const grupos = new Map<string, ItemPublico[]>();
    for (const item of acerto.itens) grupos.set(item.secao, [...(grupos.get(item.secao) ?? []), item]);
    return [...grupos];
  }, [acerto.itens]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    setErros({});
    try {
      const resposta = await fetch(`/api/acerto/${codigo}/responder`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome, email, respostas: valores }),
      });
      const corpo = await resposta.json().catch(() => ({})) as { error?: string; erros?: Record<string, string> };
      if (!resposta.ok) {
        setErros(corpo.erros ?? {});
        setErro(corpo.error ?? "Não foi possível enviar agora. Tente de novo.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const dia = acerto.dia ? acerto.dia.split("-").reverse().join("/") : null;
  const estado = acerto.situacao === "concluido" ? { titulo: "Acerto concluído", texto: "A produção revisou e aprovou as respostas. Obrigado." }
    : acerto.situacao === "respondido" ? { titulo: "Resposta enviada", texto: `Recebemos a resposta${acerto.respondente ? ` de ${acerto.respondente}` : ""}. A produção vai revisar e, se precisar de algo, este mesmo link volta a abrir.` }
    : null;

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[40rem]">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{acerto.organizacao}</p>
        <h1 className="mt-1 text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">{acerto.titulo}</h1>
        <p className="mt-1 text-[0.8125rem] text-black/55">{[acerto.temporada, dia, acerto.espaco].filter(Boolean).join(" · ")}</p>

        {estado && (
          <div role="status" className="mt-6 rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.12)" }}>
            <p className="text-[0.875rem] font-medium text-[#282525]">{estado.titulo}</p>
            <p className="mt-1 text-[0.8125rem] text-black/55">{estado.texto}</p>
          </div>
        )}

        <form onSubmit={enviar} className="mt-6 space-y-8" noValidate>
          {secoes.map(([secao, itens]) => (
            <section key={secao} aria-label={secao}>
              <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45">{secao}</h2>
              <div className="space-y-5 rounded border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                {itens.map(item => item.editavel ? (
                  <div key={item.id}>
                    {item.situacao === "recusado" && <p className="mb-2 rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>A produção pediu para revisar{item.motivo ? `: ${item.motivo}` : "."}</p>}
                    <Campo item={item} valor={valores[item.id] ?? ""} erro={erros[item.id]} onChange={valor => setValores(atual => ({ ...atual, [item.id]: valor }))} desabilitado={enviando} />
                  </div>
                ) : (
                  <div key={item.id}>
                    <p className="text-[0.8125rem] font-medium text-[#282525]">{item.rotulo}</p>
                    <p className="mt-0.5 text-[0.9375rem] text-[#282525]">{textoDoValor(item, item.visibilidade === "leitura" ? item.valor_atual : item.resposta)}</p>
                    {item.visibilidade !== "leitura" && SITUACAO_DO_ITEM[item.situacao] && <p className="mt-0.5 text-[0.75rem] text-black/45">{SITUACAO_DO_ITEM[item.situacao]}</p>}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {editaveis.length > 0 && (
            <section aria-label="Quem responde" className="space-y-4 rounded border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div>
                <label htmlFor="resp-nome" className={ROTULO}>Seu nome</label>
                <input id="resp-nome" className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} maxLength={120} autoComplete="name" disabled={enviando} />
              </div>
              <div>
                <label htmlFor="resp-email" className={ROTULO}>Seu e-mail <span className="font-normal text-black/45">(opcional)</span></label>
                <input id="resp-email" type="email" className={CAMPO} value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="email" disabled={enviando} />
              </div>
              <p className="text-[0.75rem] text-black/45">Seu nome e e-mail ficam só com a produção, para saber quem respondeu.</p>
              {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
              <button type="submit" disabled={enviando} className="h-12 w-full rounded bg-[#2E8932] text-[0.9375rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">{enviando ? "Enviando…" : "Enviar resposta"}</button>
            </section>
          )}
        </form>
        <p className="mt-6 text-[0.75rem] text-black/40">Este link vale até {new Date(acerto.expiraEm).toLocaleDateString("pt-BR")}.</p>
      </div>
    </main>
  );
}
