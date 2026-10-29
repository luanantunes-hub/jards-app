// Peças comuns da lista do blog e da página de cada post: data, tempo de
// leitura, temas, capa e o estilo dos rótulos.

import { ROTULO } from "./Quadro";

export { ROTULO };

export type PostResumo = {
  id: string;
  titulo: string;
  slug: string;
  tags: string[] | null;
  seo_descricao: string | null;
  imagem_capa: string | null;
  imagem_alt: string | null;
  publicado_em: string | null;
  conteudo: string | null;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "8 set 2026", no fuso de Brasília (o servidor roda em UTC).
export function fmtData(d: string | null) {
  if (!d) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "numeric", month: "numeric", year: "numeric",
  }).formatToParts(new Date(d));
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return `${valor("day")} ${MESES[valor("month") - 1]} ${valor("year")}`;
}

// Minutos de leitura pelo texto dos blocos do post, a ~200 palavras por minuto.
export function minutosDeLeitura(conteudo: string | null) {
  let blocos: unknown;
  try { blocos = JSON.parse(conteudo || "[]"); } catch { return null; }
  if (!Array.isArray(blocos)) return null;
  const palavras = blocos.reduce((total: number, bloco: { content?: string; caption?: string }) => {
    const texto = `${bloco?.content ?? ""} ${bloco?.caption ?? ""}`;
    return total + texto.split(/\s+/).filter(Boolean).length;
  }, 0);
  return palavras ? Math.max(1, Math.round(palavras / 200)) : null;
}

export const FOCO = "rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7259B5]";
export const TITULO_HOVER = "decoration-[#282525]/25 decoration-[0.06em] underline-offset-[0.18em] group-hover:underline";

export function Temas({ tags, className = "" }: { tags: string[] | null; className?: string }) {
  if (!tags?.length) return null;
  return <p className={`${ROTULO} text-[#684DB0] ${className}`}>{tags.join(" · ")}</p>;
}

export function Meta({ post, className = "" }: { post: PostResumo; className?: string }) {
  const minutos = minutosDeLeitura(post.conteudo);
  if (!post.publicado_em && !minutos) return null;
  return (
    <p className={`${ROTULO} text-black/45 ${className}`}>
      {post.publicado_em && <time dateTime={post.publicado_em}>{fmtData(post.publicado_em)}</time>}
      {post.publicado_em && minutos && " · "}
      {minutos && `${minutos} min de leitura`}
    </p>
  );
}

export function Capa({ post, className, prioridade = false }: { post: PostResumo; className: string; prioridade?: boolean }) {
  if (!post.imagem_capa) return <div className={`rounded bg-[#F7F7F5] ${className}`} aria-hidden="true" />;
  return (
    <div className={`overflow-hidden rounded bg-black/[.04] ${className}`}>
      <img
        src={post.imagem_capa}
        alt={post.imagem_alt ?? ""}
        loading={prioridade ? "eager" : "lazy"}
        fetchPriority={prioridade ? "high" : undefined}
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
      />
    </div>
  );
}
