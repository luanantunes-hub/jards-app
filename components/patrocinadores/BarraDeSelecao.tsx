"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Tag, UserRound, X } from "lucide-react";
import { AnchoredPopover, useAnchoredPopover } from "@/components/ui/AnchoredPopover";
import { AvatarDaPessoa } from "@/components/ui/AvatarDaPessoa";
import { CampoDeTags, useTagsDoTime } from "@/components/ui/Tags";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { membrosDaEquipe, type MembroDaEquipe } from "@/lib/equipe/responsavel";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { adicionarEmpresasAoCrm } from "@/lib/patrocinadores-lote";
import { MAX_SELECAO, aplicouAlgo, enderecoDoResultado, mensagemDoLote, notaDoLote, type PedidoDoLote } from "@/lib/patrocinadores-selecao";
import { acrescentarTag } from "@/lib/tags";
import { SucessoDoLote } from "./SucessoDoLote";
import type { SelecaoDeEmpresas } from "./useSelecaoDeEmpresas";

// A barra de seleção é toda no roxo noite do app (a cor dos botões de criar). As duas ações têm o mesmo peso (levam as
// empresas ao CRM, uma com tag, a outra com responsável), então os dois botões são iguais e vazados: texto e ícone
// brancos, borda fina clara. Um branco e um roxo lado a lado sugeriam uma ação principal que não existe.
const BOTAO = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-white/30 px-2.5 text-[0.75rem] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-8";
const BOTAO_ICONE_NO_ROXO = "flex h-9 w-9 shrink-0 items-center justify-center rounded text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-8 sm:w-8";
// O ✕ do aviso de "nada mudou", que é branco com borda âmbar.
const BOTAO_ICONE = "flex h-9 w-9 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.04] hover:text-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25 sm:h-8 sm:w-8";
const TITULO_DO_MENU = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const ERRO = "rounded border border-[#D94A4A]/30 bg-white px-2.5 py-2 text-[0.6875rem] text-[#D94A4A]";

// O lote deu certo: a tela de sucesso (o check que sobe) e, no fim dela, a lista do que a pessoa acabou de fazer.
type Sucesso = { texto: string; nota: string | null; href: string };
// O lote não mudou nada (tudo é de outra pessoa da equipe): não há lista para mostrar, só o aviso.
type Aviso = { texto: string };
type Aplicar = (pedido: PedidoDoLote, vocabulario: readonly string[], fechar: () => void, aoConcluir?: () => void) => Promise<void>;

function empresas(n: number): string {
  return `${n} ${n === 1 ? "empresa" : "empresas"}`;
}

/** Menu da tag: digitar ou escolher uma tag do time e levar as empresas marcadas para o CRM já com ela. */
function MenuDaTag({ pos, total, aplicando, erro, onFechar, onAplicar }: {
  pos: NonNullable<ReturnType<typeof useAnchoredPopover>["pos"]>;
  total: number;
  aplicando: boolean;
  erro: string | null;
  onFechar: () => void;
  onAplicar: Aplicar;
}) {
  // As tags do time só são buscadas quando o menu abre (ele só existe enquanto está aberto).
  const [vocabulario, lembrar] = useTagsDoTime();
  const [tags, setTags] = useState<string[]>([]);
  // O que está digitado e ainda não virou etiqueta: o botão já vale por isso.
  const [pendente, setPendente] = useState("");
  const doPedido = acrescentarTag(tags, pendente, vocabulario);
  return (
    <AnchoredPopover pos={pos} onClose={onFechar}>
      <div className="flex flex-col gap-3" role="dialog" aria-label="Criar tag">
        <p className={TITULO_DO_MENU}>Tag para {empresas(total)}</p>
        <CampoDeTags valor={tags} onChange={setTags} vocabulario={vocabulario} onDigitando={setPendente} />
        <p className="text-[0.6875rem] text-black/45">Quem ainda não está no CRM entra agora, já com a tag.</p>
        {erro && <p role="alert" className={ERRO}>{erro}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onFechar} className="text-[0.75rem] text-black/35 transition hover:text-black/55">Cancelar</button>
          <button
            type="button"
            onClick={() => void onAplicar({ tipo: "tag", tags: doPedido }, vocabulario, onFechar, () => lembrar(doPedido))}
            disabled={doPedido.length === 0 || aplicando}
            className="rounded acao-salvar px-3.5 py-2 text-[0.75rem] font-medium text-white disabled:opacity-60"
          >
            {aplicando ? "Adicionando…" : "Adicionar ao CRM"}
          </button>
        </div>
      </div>
    </AnchoredPopover>
  );
}

/** Menu do responsável: a equipe da organização (quem está logado primeiro) e a pessoa que fica com as empresas. */
function MenuDoResponsavel({ pos, total, equipe, falhou, meuId, aplicando, erro, onFechar, onAplicar }: {
  pos: NonNullable<ReturnType<typeof useAnchoredPopover>["pos"]>;
  total: number;
  equipe: MembroDaEquipe[] | null;
  falhou: boolean;
  meuId: string | null;
  aplicando: boolean;
  erro: string | null;
  onFechar: () => void;
  onAplicar: Aplicar;
}) {
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  // Com uma pessoa só na equipe, não há o que escolher.
  const escolhida = equipe?.find((membro) => membro.id === (pessoaId ?? (equipe.length === 1 ? equipe[0].id : null))) ?? null;
  return (
    <AnchoredPopover pos={pos} onClose={onFechar}>
      <div className="flex flex-col gap-3" role="dialog" aria-label="Atribuir responsável">
        <p className={TITULO_DO_MENU}>Responsável por {empresas(total)}</p>
        {falhou ? (
          <p role="alert" className={ERRO}>Não foi possível carregar a equipe. Feche e tente de novo.</p>
        ) : equipe === null ? (
          <div className="flex flex-col gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-black/[.05] motion-reduce:animate-none" />)}
          </div>
        ) : (
          <div role="radiogroup" aria-label="Pessoa responsável" className="flex max-h-60 flex-col overflow-y-auto">
            {equipe.map((membro) => (
              <label key={membro.id} className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded px-2.5 text-[0.8125rem] text-[#282525] transition hover:bg-black/[.04] ${membro.id === escolhida?.id ? "bg-black/[.04]" : ""}`}>
                <input type="radio" name="responsavel-do-lote" checked={membro.id === escolhida?.id} onChange={() => setPessoaId(membro.id)} className="h-4 w-4 accent-[#684DB0]" />
                <AvatarDaPessoa nome={membro.nome} tamanho="pequeno" />
                <span className="min-w-0 flex-1 truncate">{membro.nome}{membro.id === meuId && <span className="text-black/40"> (você)</span>}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-[0.6875rem] text-black/45">Quem ainda não está no CRM entra agora, com esta pessoa como responsável.</p>
        {erro && <p role="alert" className={ERRO}>{erro}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onFechar} className="text-[0.75rem] text-black/35 transition hover:text-black/55">Cancelar</button>
          <button
            type="button"
            onClick={() => escolhida && void onAplicar({ tipo: "responsavel", pessoaId: escolhida.id, nome: escolhida.nome }, [], onFechar)}
            disabled={!escolhida || aplicando}
            className="rounded acao-salvar px-3.5 py-2 text-[0.75rem] font-medium text-white disabled:opacity-60"
          >
            {aplicando ? "Adicionando…" : "Adicionar ao CRM"}
          </button>
        </div>
      </div>
    </AnchoredPopover>
  );
}

/**
 * A barra fininha que aparece no cabeçalho da lista de patrocinadores quando há empresas marcadas. Não escurece
 * a tela e não trava nada: a pessoa segue marcando, filtrando e trocando de página. Tem duas ações, e as duas levam
 * as empresas para o CRM: "Criar tag" põe a tag nelas; "Atribuir responsável" deixa uma pessoa da equipe com elas.
 * Fica sobre o cabeçalho da tabela (sem empurrar as linhas) e acompanha a rolagem. A caixa dela, no mesmo lugar
 * da caixa do cabeçalho, continua marcando e desmarcando a página; o ✕ limpa tudo.
 */
export function BarraDeSelecao({ selecao, marcadasNaPagina, totalNaPagina, onAlternarPagina }: {
  selecao: SelecaoDeEmpresas;
  marcadasNaPagina: number;
  totalNaPagina: number;
  onAlternarPagina: () => void;
}) {
  const organizationId = useOrganizationId();
  const menuDaTag = useAnchoredPopover();
  const menuDoResponsavel = useAnchoredPopover();

  const [equipe, setEquipe] = useState<MembroDaEquipe[] | null>(null);
  const [equipeFalhou, setEquipeFalhou] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);
  const router = useRouter();

  // O aviso do lote anterior sai quando a pessoa começa a marcar de novo.
  const [totalAnterior, setTotalAnterior] = useState(selecao.total);
  if (totalAnterior !== selecao.total) {
    setTotalAnterior(selecao.total);
    if (selecao.total > 0 && aviso) setAviso(null);
  }
  useEffect(() => {
    if (!aviso) return;
    const prazo = setTimeout(() => setAviso(null), 14000);
    return () => clearTimeout(prazo);
  }, [aviso]);

  const caixaDaPagina = useRef<HTMLInputElement>(null);
  const paginaToda = totalNaPagina > 0 && marcadasNaPagina === totalNaPagina;
  const paginaParcial = marcadasNaPagina > 0 && !paginaToda;
  useEffect(() => {
    if (caixaDaPagina.current) caixaDaPagina.current.indeterminate = paginaParcial;
  }, [paginaParcial, selecao.total]);

  const marcando = selecao.total > 0;
  const visivel = marcando || aviso !== null;

  function abrirTag(evento: React.MouseEvent<HTMLElement>) {
    setErro(null);
    menuDaTag.abrir(evento, 320, "esquerda");
  }

  async function abrirResponsavel(evento: React.MouseEvent<HTMLElement>) {
    setErro(null);
    menuDoResponsavel.abrir(evento, 320, "esquerda");
    if (equipe || !organizationId) return;
    setEquipeFalhou(false);
    try {
      const [{ data: { user } }, membros] = await Promise.all([createClient().auth.getUser(), fetchOrganizationMembers(organizationId)]);
      const lista = membrosDaEquipe(membros);
      // Quem está logado vem primeiro.
      setMeuId(user?.id ?? null);
      setEquipe([...lista.filter((membro) => membro.id === user?.id), ...lista.filter((membro) => membro.id !== user?.id)]);
    } catch {
      setEquipeFalhou(true);
    }
  }

  const aplicar: Aplicar = async (pedido, vocabulario, fechar, aoConcluir) => {
    if (!organizationId || aplicando) return;
    setAplicando(true);
    setErro(null);
    try {
      const cliente = createClient();
      const { data: { user } } = await cliente.auth.getUser();
      if (!user) throw new Error("Sua sessão expirou. Entre de novo para continuar.");
      const resumo = await adicionarEmpresasAoCrm(cliente, { organizacaoId: organizationId, usuarioId: user.id, empresas: selecao.lista, pedido, vocabulario });
      aoConcluir?.();
      fechar();
      selecao.limpar();
      const texto = mensagemDoLote(resumo, pedido);
      if (aplicouAlgo(resumo)) {
        const href = enderecoDoResultado(pedido);
        router.prefetch(href);
        setSucesso({ texto, nota: notaDoLote(resumo), href });
      } else {
        setAviso({ texto });
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível adicionar as empresas ao CRM.");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">{aviso?.texto ?? ""}</p>
      <div className="sticky top-0 z-10 h-0">
        <div
          role="toolbar"
          aria-label="Empresas selecionadas"
          inert={!visivel}
          // Só do tamanho do que cabe nela, encostada no começo do cabeçalho. O aviso do lote deixa a caixa do
          // cabeçalho livre (começa depois da coluna da caixa); a barra de seleção leva a caixa da página no lugar dela.
          className={`absolute top-0 flex min-h-[2.5625rem] w-fit items-center gap-2 rounded border pr-2 elevacao-1 ${
            marcando ? "left-0 max-w-full bg-[#1C0E33] text-white" : "left-10 max-w-[calc(100%-2.5rem)] bg-white"
          } ${visivel ? "opacity-100 transition-opacity duration-200 motion-reduce:transition-none" : "pointer-events-none opacity-0"}`}
          style={marcando ? { borderColor: "#1C0E33" } : aviso ? { borderColor: "rgba(176,122,20,.45)" } : undefined}
        >
          {marcando ? (
            <>
              <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center" title="Selecionar todas da página">
                <input
                  ref={caixaDaPagina}
                  type="checkbox"
                  checked={paginaToda}
                  disabled={totalNaPagina === 0}
                  onChange={onAlternarPagina}
                  aria-label="Selecionar todas as empresas da página"
                  className="h-4 w-4 cursor-pointer accent-white [color-scheme:dark] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                />
              </label>
              <p className="mr-2 whitespace-nowrap text-[0.8125rem] font-medium text-white">
                {selecao.total} <span className="font-normal text-white/65">{selecao.total === 1 ? "selecionada" : "selecionadas"}</span>
                {selecao.noLimite && <span className="ml-2 text-[0.6875rem] font-normal text-white/55">máximo de {MAX_SELECAO} por vez</span>}
              </p>
              <button type="button" onClick={abrirTag} aria-haspopup="dialog" aria-expanded={menuDaTag.pos !== null} aria-label="Criar tag" title="Criar tag" className={BOTAO}>
                <Tag size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Criar tag</span>
              </button>
              <button type="button" onClick={abrirResponsavel} aria-haspopup="dialog" aria-expanded={menuDoResponsavel.pos !== null} aria-label="Atribuir responsável" title="Atribuir responsável" className={BOTAO}>
                <UserRound size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Atribuir responsável</span>
              </button>
              <button type="button" onClick={selecao.limpar} aria-label="Limpar seleção" title="Limpar seleção" className={BOTAO_ICONE_NO_ROXO}>
                <X size={14} aria-hidden="true" />
              </button>
            </>
          ) : aviso ? (
            <>
              <span className="flex h-10 w-9 shrink-0 items-center justify-center text-[#B07A14]"><AlertCircle size={16} aria-hidden="true" /></span>
              <p className="min-w-0 py-2 text-[0.8125rem] leading-snug text-[#B07A14]">{aviso.texto}</p>
              <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" title="Fechar aviso" className={BOTAO_ICONE}>
                <X size={14} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {menuDaTag.pos && (
        <MenuDaTag pos={menuDaTag.pos} total={selecao.total} aplicando={aplicando} erro={erro} onFechar={menuDaTag.fechar} onAplicar={aplicar} />
      )}
      {menuDoResponsavel.pos && (
        <MenuDoResponsavel
          pos={menuDoResponsavel.pos}
          total={selecao.total}
          equipe={equipe}
          falhou={equipeFalhou}
          meuId={meuId}
          aplicando={aplicando}
          erro={erro}
          onFechar={menuDoResponsavel.fechar}
          onAplicar={aplicar}
        />
      )}
      {sucesso && <SucessoDoLote texto={sucesso.texto} nota={sucesso.nota} onConcluido={() => router.push(sucesso.href)} />}
    </>
  );
}
