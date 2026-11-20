import Image from "next/image";
import { caminhoDoDesenho, corDoAvatar, desenhoDoAvatar, iniciaisDe, type EstadoDoAvatar } from "@/lib/conversas/avatar";

const TAMANHOS = {
  pequeno: { classe: "h-7 w-7 text-[0.5625rem]", px: 28 },
  medio: { classe: "h-9 w-9 text-[0.6875rem]", px: 36 },
  grande: { classe: "h-11 w-11 text-[0.75rem]", px: 44 },
  maior: { classe: "h-14 w-14 text-[0.875rem]", px: 56 },
} as const;

/**
 * Quem é a pessoa, no lugar da foto. Com `comDesenho`, mostra o tamanduá que conta o que está acontecendo na
 * conversa (esperando resposta, respondeu, só você vê…), sobre um roxo bem claro. Sem ele, um círculo com as
 * iniciais na cor da identidade da pessoa. Decorativo: o nome aparece escrito ao lado.
 */
export function AvatarDaPessoa({ nome, endereco, estado, comDesenho = false, tamanho = "medio", className = "" }: {
  nome?: string | null;
  endereco?: string | null;
  /** O estado da conversa, quando há um. Só vale com `comDesenho`. */
  estado?: EstadoDoAvatar | null;
  /** Mostra o tamanduá em vez das iniciais. Em tamanho pequeno o desenho não lê: deixe as iniciais. */
  comDesenho?: boolean;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  const { classe, px } = TAMANHOS[tamanho];

  if (comDesenho) {
    const desenho = desenhoDoAvatar(estado, endereco || nome);
    return (
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7259B5]/[.10] ${classe} ${className}`}>
        <Image src={caminhoDoDesenho(desenho)} alt="" width={px} height={px} className="h-[94%] w-[94%] object-contain" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white ${classe} ${className}`}
      style={{ backgroundColor: corDoAvatar(endereco || nome) }}
    >
      {iniciaisDe(nome, endereco)}
    </span>
  );
}
