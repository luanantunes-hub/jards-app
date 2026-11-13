"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerCodigo, lerRespostaDaPorta, presencaDaSessao, textoDaPorta, type RespostaDaPorta, type Tom } from "@/lib/producao/credenciais";
import { LeitorDeCamera } from "@/components/producao/LeitorDeCamera";

const COR: Record<Tom, string> = { bom: "#2E8932", atencao: "#B07A14", ruim: "#B23B3B" };

type Leitura = { chave: number; hora: string; resposta: RespostaDaPorta };

/** A porta da sessão (PD7.3): digita ou cola o código da credencial e vê a resposta (pode entrar, já entrou, não pode entrar), com a contagem de quem já entrou. */
export function PortaDaSessao({ sessaoId, podeLer }: { sessaoId: string; podeLer: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultima, setUltima] = useState<Leitura | null>(null);
  const [recentes, setRecentes] = useState<Leitura[]>([]);
  const [convidados, setConvidados] = useState<{ id: string; quantidade: number; situacao: string }[]>([]);
  const [credenciais, setCredenciais] = useState<{ convidado_id: string; entradas: number; revogada_em: string | null }[]>([]);
  const [versao, setVersao] = useState(0);
  const contador = useRef(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const producao = clienteDaProducao(createClient());
      const [con, cre] = await Promise.all([
        producao.from("producao_convidados").select("id, quantidade, situacao").eq("sessao_id", sessaoId),
        producao.from("producao_credenciais").select("convidado_id, entradas, revogada_em").eq("sessao_id", sessaoId),
      ]);
      if (!ativo) return;
      setConvidados(con.data ?? []);
      setCredenciais(cre.data ?? []);
    })();
    return () => { ativo = false; };
  }, [sessaoId, versao]);

  const presenca = useMemo(() => presencaDaSessao(convidados, credenciais), [convidados, credenciais]);

  async function ler(vindoDaCamera?: string) {
    const lido = lerCodigo(vindoDaCamera ?? codigo);
    if (!lido) { setErro("O código tem 16 letras e números (de 0 a 9 e de A a F). Confira e digite de novo."); return; }
    setLendo(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient()).rpc("fn_producao_porta_ler", { p_sessao: sessaoId, p_codigo: lido });
    setLendo(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode ler credenciais nesta produção." : "Não foi possível ler agora. Confira a conexão e tente de novo."); return; }
    const resposta = lerRespostaDaPorta(data);
    if (!resposta) { setErro("A resposta da porta veio diferente do esperado. Não libere a entrada; tente de novo."); return; }
    contador.current += 1;
    const leitura: Leitura = { chave: contador.current, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), resposta };
    setUltima(leitura);
    setRecentes(atual => [leitura, ...atual].slice(0, 8));
    setCodigo("");
    setVersao(atual => atual + 1);
    campo.current?.focus();
  }

  const texto = ultima ? textoDaPorta(ultima.resposta) : null;
  // A câmera lê o QR e entrega o código à mesma leitura do campo; segura a leitura em andamento para não ler duas vezes o mesmo QR.
  const lerDaCamera = (lido: string) => { if (!lendo) void ler(lido); };

  return (
    <div className="mx-auto max-w-[36rem] space-y-5">
      <p className="text-[0.75rem] tabular-nums text-black/55">{presenca.entraram} de {presenca.confirmados} {presenca.confirmados === 1 ? "lugar confirmado entrou" : "lugares confirmados entraram"}{presenca.semCredencial > 0 ? ` · ${presenca.semCredencial} ${presenca.semCredencial === 1 ? "convidado sem credencial" : "convidados sem credencial"}` : ""}</p>

      {podeLer && <LeitorDeCamera onCodigo={lerDaCamera} />}

      <form onSubmit={event => { event.preventDefault(); void ler(); }} className="space-y-3">
        <label htmlFor="porta-codigo" className="block text-[0.6875rem] font-medium text-black/55">Código da credencial</label>
        <input ref={campo} id="porta-codigo" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" maxLength={24}
          className="h-14 w-full rounded border border-black/[.14] bg-white px-4 text-center text-[1.25rem] font-semibold tabular-nums uppercase tracking-[.1em] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50"
          value={codigo} onChange={event => setCodigo(event.target.value)} disabled={lendo || !podeLer} placeholder="0000-0000-0000-0000" />
        <button type="submit" disabled={lendo || !podeLer || codigo.trim() === ""} className="h-12 w-full rounded bg-[#282525] text-[0.9375rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">{lendo ? "Lendo…" : "Conferir"}</button>
        {!podeLer && <p className="text-[0.75rem] text-black/55">Só quem edita a produção lê credenciais na porta.</p>}
      </form>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-3 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {ultima && texto && (
        <div role="status" aria-live="assertive" className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: `${COR[texto.tom]}66` }}>
          <p className="text-[1.5rem] font-semibold tracking-[-.01em]" style={{ color: COR[texto.tom] }}>{texto.titulo}</p>
          <p className="mx-auto mt-2 max-w-[26rem] text-[0.875rem] text-[#282525]">{texto.detalhe}</p>
        </div>
      )}

      {recentes.length > 1 && (
        <section aria-labelledby="leituras-recentes">
          <h2 id="leituras-recentes" className="mb-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Últimas leituras</h2>
          <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {recentes.slice(1).map(leitura => {
              const t = textoDaPorta(leitura.resposta);
              return (
                <li key={leitura.chave} className="flex items-baseline gap-3 px-4 py-2">
                  <span className="w-16 text-[0.6875rem] tabular-nums text-black/45">{leitura.hora}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[#282525]">{leitura.resposta.nome ?? "Código desconhecido"}</span>
                  <span className="text-[0.75rem] font-medium" style={{ color: COR[t.tom] }}>{t.titulo}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
