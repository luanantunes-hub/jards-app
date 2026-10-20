"use client";

// Escolher, enviar e conferir os arquivos. Cada arquivo vai direto ao Storage por um endereço assinado (não passa pelo
// servidor do Jards, que limita o corpo a 4,5 MB); depois o servidor confere o que chegou: tamanho, tipo pelo conteúdo e
// se já estava na prestação. O código do link é a autorização, então nada aqui depende de login.

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Camera, CircleAlert, CircleCheck, FileText, LoaderCircle } from "lucide-react";
import { ACCEPT_DO_SELETOR, FRASE_ACEITA, nomeParaEnvio, problemaDoArquivo, type DestinoDeEnvio } from "@/lib/mcp/prestacao/tipos-de-envio";

type Estado = "na_fila" | "enviando" | "recebido" | "repetido" | "erro";

interface Item {
  chave: string;
  arquivo: File;
  nome: string;
  estado: Estado;
  mensagem?: string;
}

interface EnderecoPreparado {
  arquivo_id: string;
  upload_url: string;
}

interface ArquivoConferido {
  arquivo_id: string;
  resultado: "chegou" | "ainda_nao_chegou" | "recusado" | "repetido";
  motivo?: string;
}

/** Situações em que o link em si deixou de valer (o servidor devolve `situacao` junto do erro). */
const LINK_SEM_VALOR = new Set(["inexistente", "expirado", "revogado", "esgotado", "sem_permissao"]);

const SEM_CONEXAO = "Sem conexão. Confira a internet e tente de novo.";

const tamanhoLegivel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** O motivo do servidor começa pelo nome do arquivo ("nf.pdf: não é..."); na lista o nome já está ao lado. */
const semONome = (motivo: string, nome: string) => (motivo.startsWith(`${nome}: `) ? motivo.slice(nome.length + 2) : motivo);

async function chamar(codigo: string, passo: "preparar" | "concluir", corpo: unknown): Promise<{ ok: boolean; dados: Record<string, unknown> }> {
  try {
    const resposta = await fetch(`/api/enviar/${codigo}/${passo}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
    const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: resposta.ok, dados };
  } catch {
    return { ok: false, dados: { error: SEM_CONEXAO } };
  }
}

/** Envia o arquivo ao endereço assinado do Storage, do mesmo jeito que o cliente oficial do Supabase faz no navegador. */
async function subir(endereco: string, arquivo: File): Promise<boolean> {
  const corpo = new FormData();
  corpo.append("cacheControl", "3600");
  corpo.append("", arquivo);
  try {
    const resposta = await fetch(endereco, { method: "PUT", body: corpo });
    return resposta.ok;
  } catch {
    return false;
  }
}

async function emParalelo<T>(itens: readonly T[], limite: number, tarefa: (item: T, indice: number) => Promise<void>): Promise<void> {
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      await tarefa(itens[indice], indice);
    }
  });
  await Promise.all(trabalhadores);
}

const horaLimite = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function EnvioDeArquivos({ codigo, destino, organizacao, titulo, restantes, expiraEm }: {
  codigo: string;
  destino: DestinoDeEnvio;
  organizacao: string | null;
  titulo: string;
  restantes: number;
  expiraEm: string;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [vagas, setVagas] = useState(restantes);
  const [ocupado, setOcupado] = useState(false);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const contador = useRef(0);

  const notas = destino === "despesa" ? "notas e comprovantes" : "evidências";
  const fila = itens.filter(i => i.estado === "na_fila");
  // O "pronto" só vale quando nada ficou esperando e o link segue de pé: com o link vencido, a mensagem de cima é a que importa.
  const concluiu = !ocupado && !bloqueio && fila.length === 0 && itens.some(i => i.estado === "recebido" || i.estado === "repetido");

  const atualizar = (chave: string, parcial: Partial<Item>) => setItens(atual => atual.map(i => (i.chave === chave ? { ...i, ...parcial } : i)));

  function adicionar(lista: FileList | File[] | null) {
    if (!lista || bloqueio) return;
    let livres = vagas - fila.length;
    const novos: Item[] = [];
    for (const arquivo of Array.from(lista)) {
      const nome = nomeParaEnvio(arquivo.name, arquivo.type);
      const problema = problemaDoArquivo(destino, nome, arquivo.size);
      const item: Item = { chave: `${contador.current++}-${nome}`, arquivo, nome, estado: "na_fila" };
      if (problema) {
        item.estado = "erro";
        item.mensagem = problema;
      } else if (livres <= 0) {
        item.estado = "erro";
        item.mensagem = "Este link não aceita mais arquivos.";
      } else {
        livres -= 1;
      }
      novos.push(item);
    }
    setItens(atual => [...atual, ...novos]);
  }

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    adicionar(e.target.files);
    e.target.value = "";
  }

  function aoSoltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastando(false);
    adicionar(e.dataTransfer.files);
  }

  async function enviar() {
    if (ocupado || fila.length === 0) return;
    setOcupado(true);
    fila.forEach(i => atualizar(i.chave, { estado: "enviando", mensagem: undefined }));

    const preparo = await chamar(codigo, "preparar", { nomes: fila.map(i => i.nome) });
    if (!preparo.ok) {
      const motivo = typeof preparo.dados.error === "string" ? preparo.dados.error : "Não foi possível preparar o envio agora.";
      if (typeof preparo.dados.situacao === "string" && LINK_SEM_VALOR.has(preparo.dados.situacao)) {
        setBloqueio(motivo);
        fila.forEach(i => atualizar(i.chave, { estado: "erro", mensagem: "Não enviado." }));
      } else {
        fila.forEach(i => atualizar(i.chave, { estado: "na_fila", mensagem: motivo }));
      }
      setOcupado(false);
      return;
    }
    const enderecos = (preparo.dados.arquivos ?? []) as EnderecoPreparado[];
    if (typeof preparo.dados.restantes === "number") setVagas(preparo.dados.restantes);

    const enviados: { chave: string; id: string; nome: string }[] = [];
    await emParalelo(fila, 3, async (item, indice) => {
      const endereco = enderecos[indice];
      if (!endereco) {
        atualizar(item.chave, { estado: "na_fila", mensagem: "Não foi possível preparar este arquivo. Tente de novo." });
        return;
      }
      if (await subir(endereco.upload_url, item.arquivo)) enviados.push({ chave: item.chave, id: endereco.arquivo_id, nome: item.nome });
      else atualizar(item.chave, { estado: "na_fila", mensagem: "Não foi possível enviar. Tente de novo." });
    });

    if (enviados.length > 0) {
      const conclusao = await chamar(codigo, "concluir", { arquivo_ids: enviados.map(e => e.id) });
      if (!conclusao.ok) {
        const motivo = typeof conclusao.dados.error === "string" ? conclusao.dados.error : "Não foi possível conferir o arquivo.";
        enviados.forEach(e => atualizar(e.chave, { estado: "erro", mensagem: motivo }));
      } else {
        const conferidos = new Map(((conclusao.dados.arquivos ?? []) as ArquivoConferido[]).map(a => [a.arquivo_id, a]));
        for (const e of enviados) {
          const r = conferidos.get(e.id);
          if (r?.resultado === "chegou") atualizar(e.chave, { estado: "recebido", mensagem: undefined });
          else if (r?.resultado === "repetido") atualizar(e.chave, { estado: "repetido", mensagem: undefined });
          else if (r?.resultado === "ainda_nao_chegou") atualizar(e.chave, { estado: "na_fila", mensagem: "O arquivo ainda não chegou. Tente de novo." });
          else atualizar(e.chave, { estado: "erro", mensagem: r?.motivo ? semONome(r.motivo, e.nome) : "Não foi possível conferir este arquivo." });
        }
        if (typeof conclusao.dados.restantes === "number") setVagas(conclusao.dados.restantes);
      }
    }
    setOcupado(false);
  }

  const podeEscolher = !ocupado && !bloqueio && vagas - fila.length > 0;

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-[34rem] space-y-4">
        <header className="px-1">
          {organizacao && <p className="text-[0.75rem] text-black/50">{organizacao}</p>}
          <h1 className="mt-1 text-[1.375rem] font-bold tracking-[-.02em] text-[#282525] [text-wrap:balance]">Enviar {notas}</h1>
          <p className="mt-1 text-[0.8125rem] text-black/50">{titulo}</p>
        </header>

        <section className="rounded border bg-white p-4 md:p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <label
            htmlFor="arquivos"
            onDragEnter={e => { e.preventDefault(); if (podeEscolher) setArrastando(true); }}
            onDragOver={e => e.preventDefault()}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
            className={`flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded border border-dashed px-4 py-6 text-center transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#7259B5] ${
              podeEscolher ? "cursor-pointer hover:bg-black/[.02]" : "cursor-not-allowed opacity-50"
            } ${arrastando ? "border-[#7259B5]/60 bg-[#7259B5]/[.04]" : "border-black/[.18]"}`}
          >
            <FileText size={20} className="text-black/35" aria-hidden />
            <span className="text-[0.875rem] font-semibold text-[#282525]">Escolher arquivos</span>
            <span className="text-[0.75rem] text-black/45">
              <span className="pointer-coarse:hidden">ou arraste até aqui · </span>
              {FRASE_ACEITA[destino]} · até 15 MB cada
            </span>
            <input id="arquivos" type="file" multiple accept={ACCEPT_DO_SELETOR[destino]} disabled={!podeEscolher} onChange={aoEscolher} className="sr-only" />
          </label>

          <label
            htmlFor="foto"
            className={`mt-3 hidden items-center justify-center gap-2 rounded border border-black/[.12] px-4 py-2.5 text-[0.8125rem] font-medium text-[#282525] transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#7259B5] pointer-coarse:flex ${
              podeEscolher ? "cursor-pointer active:bg-black/[.04]" : "cursor-not-allowed opacity-50"
            }`}
          >
            <Camera size={16} aria-hidden /> Tirar foto
            <input id="foto" type="file" accept="image/*" capture="environment" disabled={!podeEscolher} onChange={aoEscolher} className="sr-only" />
          </label>

          {bloqueio && <p role="alert" className="mt-4 text-[0.8125rem] text-[#B23B3B]">{bloqueio}</p>}

          {itens.length > 0 && (
            <ul className="mt-4 divide-y divide-black/[.06]" aria-live="polite">
              {itens.map(item => (
                <li key={item.chave} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 shrink-0">
                    {item.estado === "enviando" && <LoaderCircle size={16} className="animate-spin text-black/40 motion-reduce:animate-none" aria-label="Enviando" />}
                    {(item.estado === "recebido" || item.estado === "repetido") && <CircleCheck size={16} className="text-[#2E8932]" aria-label="Recebido" />}
                    {item.estado === "erro" && <CircleAlert size={16} className="text-[#B23B3B]" aria-label="Com problema" />}
                    {item.estado === "na_fila" && <FileText size={16} className={item.mensagem ? "text-[#B23B3B]" : "text-black/30"} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] text-[#282525]">{item.nome}</span>
                    <span className={`block text-[0.6875rem] ${item.estado === "erro" || item.mensagem ? "text-[#B23B3B]" : "text-black/45"}`}>
                      {item.mensagem ??
                        (item.estado === "repetido" ? "Já estava na prestação" : item.estado === "recebido" ? "Recebido" : tamanhoLegivel(item.arquivo.size))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {fila.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={enviar}
                disabled={ocupado || Boolean(bloqueio)}
                className="flex items-center gap-1.5 rounded bg-[#0D0D0D] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ocupado && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
                Enviar {fila.length} {fila.length === 1 ? "arquivo" : "arquivos"}
              </button>
            </div>
          )}

          {concluiu && (
            <p className="mt-4 flex items-center gap-2 text-[0.8125rem] font-medium text-[#2E8932]" role="status">
              <CircleCheck size={16} aria-hidden /> Pronto. Volte à conversa e avise que enviou.
            </p>
          )}
        </section>

        <p className="px-1 text-center text-[0.6875rem] text-black/40">Este link vale até {horaLimite(expiraEm)}.</p>
      </div>
    </main>
  );
}
