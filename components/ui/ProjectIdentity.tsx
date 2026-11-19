"use client";
import { useState } from "react";
import {
  FolderOpen, Music2, HeartHandshake, Landmark, Theater, GraduationCap, Leaf, Palette,
  Building2, Users, Globe, Megaphone, Trophy, Target, TrendingUp, Network, Medal, Handshake,
  Drama, Film, Clapperboard, BookOpen, Library, Mic, Camera, Brush, PenTool, Guitar, Piano,
  Sprout, TreePine, Sun, Bike, Footprints, Dumbbell, Volleyball, Baby, Accessibility, HandHeart,
  Heart, Smile, Sparkles, Star, Flag, Tent, Feather,
} from "lucide-react";

export type IdentityType = "padrao" | "icone" | "emoji" | "logo";
export type IdentityIconOption = { key: string; label: string; Icon: React.ElementType };

// As chaves ficam gravadas no banco (`identidade_valor`): nunca renomear, só acrescentar.
export const PROJECT_ICON_OPTIONS = [
  { key: "musica", label: "Música", Icon: Music2 },
  { key: "cultura", label: "Cultura", Icon: Theater },
  { key: "social", label: "Social", Icon: HeartHandshake },
  { key: "patrimonio", label: "Patrimônio", Icon: Landmark },
  { key: "educacao", label: "Educação", Icon: GraduationCap },
  { key: "ambiental", label: "Ambiental", Icon: Leaf },
  { key: "arte", label: "Arte", Icon: Palette },
  { key: "teatro", label: "Teatro", Icon: Drama },
  { key: "cinema", label: "Cinema", Icon: Clapperboard },
  { key: "audiovisual", label: "Audiovisual", Icon: Film },
  { key: "literatura", label: "Literatura", Icon: BookOpen },
  { key: "biblioteca", label: "Biblioteca", Icon: Library },
  { key: "voz", label: "Voz e podcast", Icon: Mic },
  { key: "fotografia", label: "Fotografia", Icon: Camera },
  { key: "artes_visuais", label: "Artes visuais", Icon: Brush },
  { key: "design", label: "Design", Icon: PenTool },
  { key: "violao", label: "Violão", Icon: Guitar },
  { key: "piano", label: "Piano", Icon: Piano },
  { key: "danca", label: "Dança", Icon: Sparkles },
  { key: "festival", label: "Festival", Icon: Tent },
  { key: "esporte", label: "Esporte", Icon: Trophy },
  { key: "corrida", label: "Corrida", Icon: Footprints },
  { key: "ciclismo", label: "Ciclismo", Icon: Bike },
  { key: "academia", label: "Academia", Icon: Dumbbell },
  { key: "volei", label: "Vôlei", Icon: Volleyball },
  { key: "infancia", label: "Infância", Icon: Baby },
  { key: "inclusao", label: "Inclusão", Icon: Accessibility },
  { key: "cuidado", label: "Cuidado", Icon: HandHeart },
  { key: "saude", label: "Saúde", Icon: Heart },
  { key: "comunidade", label: "Comunidade", Icon: Users },
  { key: "brotar", label: "Brotar", Icon: Sprout },
  { key: "floresta", label: "Floresta", Icon: TreePine },
  { key: "sol", label: "Sol", Icon: Sun },
  { key: "alegria", label: "Alegria", Icon: Smile },
  { key: "poesia", label: "Poesia", Icon: Feather },
  { key: "destaque", label: "Destaque", Icon: Star },
  { key: "bandeira", label: "Bandeira", Icon: Flag },
  { key: "mundo", label: "Mundo", Icon: Globe },
] as const;

export const PROPONENTE_ICON_OPTIONS = [
  { key: "instituicao", label: "Instituição", Icon: Building2 },
  { key: "patrimonio", label: "Patrimônio", Icon: Landmark },
  { key: "educacao", label: "Educação", Icon: GraduationCap },
  { key: "social", label: "Social", Icon: HeartHandshake },
  { key: "ambiental", label: "Ambiental", Icon: Leaf },
  { key: "comunidade", label: "Comunidade", Icon: Users },
  { key: "global", label: "Global", Icon: Globe },
  { key: "cultura", label: "Cultura", Icon: Theater },
  { key: "musica", label: "Música", Icon: Music2 },
  { key: "cinema", label: "Cinema", Icon: Clapperboard },
  { key: "arte", label: "Arte", Icon: Palette },
  { key: "biblioteca", label: "Biblioteca", Icon: Library },
  { key: "esporte", label: "Esporte", Icon: Trophy },
  { key: "infancia", label: "Infância", Icon: Baby },
  { key: "inclusao", label: "Inclusão", Icon: Accessibility },
  { key: "cuidado", label: "Cuidado", Icon: HandHeart },
  { key: "brotar", label: "Brotar", Icon: Sprout },
  { key: "destaque", label: "Destaque", Icon: Star },
] as const;

export const CAPTADOR_ICON_OPTIONS = [
  { key: "agencia", label: "Agência", Icon: Megaphone },
  { key: "negociacao", label: "Negociação", Icon: Handshake },
  { key: "performance", label: "Performance", Icon: TrendingUp },
  { key: "metas", label: "Metas", Icon: Target },
  { key: "conquista", label: "Conquista", Icon: Trophy },
  { key: "rede", label: "Rede", Icon: Network },
  { key: "premiacao", label: "Premiação", Icon: Medal },
  { key: "destaque", label: "Destaque", Icon: Star },
  { key: "alegria", label: "Alegria", Icon: Smile },
  { key: "brilho", label: "Brilho", Icon: Sparkles },
  { key: "bandeira", label: "Bandeira", Icon: Flag },
  { key: "mundo", label: "Mundo", Icon: Globe },
] as const;

/**
 * Cinco cores de identidade, alegres e que conversam com o roxo do Jards.
 * O ícone aparece solto, só o traço na cor — sem quadrado, degradê ou sombra.
 */
export const PROJECT_ICON_COLORS = [
  { key: "lavanda", label: "Lavanda", cor: "#7C5CD6" },
  { key: "coral", label: "Coral", cor: "#E8665A" },
  { key: "mel", label: "Mel", cor: "#DFA024" },
  { key: "folha", label: "Folha", cor: "#3DA86A" },
  { key: "ceu", label: "Céu", cor: "#3B8BE0" },
] as const;

export const IDENTITY_COLORS = PROJECT_ICON_COLORS;

/** Paleta antiga (8 cores) → a mais parecida da nova. Assim nada muda no banco. */
const CORES_ANTIGAS: Record<string, string> = {
  "#7259b5": "#7C5CD6", // roxo
  "#2d72b0": "#3B8BE0", // azul
  "#1a8b7a": "#3DA86A", // verde
  "#2e8932": "#3DA86A", // verde lima
  "#b07a14": "#DFA024", // âmbar
  "#e2703a": "#E8665A", // laranja
  "#d94e4e": "#E8665A", // vermelho
  "#555555": "#7C5CD6", // cinza
};

/** Cor de identidade já na paleta nova (cores antigas são convertidas; sem cor, lavanda). */
export function corDaIdentidade(cor: string | null | undefined): string {
  if (!cor) return PROJECT_ICON_COLORS[0].cor;
  return CORES_ANTIGAS[cor.toLowerCase()] ?? cor;
}

type ProjectIdentityProps = {
  nome: string;
  tipo?: IdentityType | null;
  valor?: string | null;
  logoUrl?: string | null;
  cor?: string | null;
  size?: "sm" | "md" | "lg";
  iconOptions?: readonly IdentityIconOption[];
  defaultIcon?: React.ElementType;
  /** Em linhas de tabela: traço um pouco menor, para acompanhar o texto da linha. */
  semFundo?: boolean;
};

function initials(nome: string) {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "P").toUpperCase();
}

/** Procura o ícone em todas as listas, para uma chave gravada por outra entidade não cair no padrão. */
function acharIcone(valor: string | null | undefined, opcoes: readonly IdentityIconOption[]) {
  return opcoes.find(option => option.key === valor)
    ?? PROJECT_ICON_OPTIONS.find(option => option.key === valor)
    ?? PROPONENTE_ICON_OPTIONS.find(option => option.key === valor)
    ?? CAPTADOR_ICON_OPTIONS.find(option => option.key === valor);
}

export function ProjectIdentity({
  nome,
  tipo = "padrao",
  valor,
  logoUrl,
  cor,
  size = "md",
  iconOptions = PROJECT_ICON_OPTIONS,
  defaultIcon: DefaultIcon = FolderOpen,
  semFundo = false,
}: ProjectIdentityProps) {
  // Guarda qual logo falhou: trocar o logo volta a tentar, sem efeito extra.
  const [logoQueFalhou, setLogoQueFalhou] = useState<string | null>(null);
  const logoFailed = !!logoUrl && logoQueFalhou === logoUrl;
  const dimensions = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-14 h-14" : "w-9 h-9";
  const iconSize = semFundo
    ? (size === "sm" ? 15 : size === "lg" ? 28 : 18)
    : (size === "sm" ? 19 : size === "lg" ? 38 : 24);
  const emojiSize = size === "sm" ? "text-[1.125rem]" : size === "lg" ? "text-[2.25rem]" : "text-[1.5rem]";
  const Icon = acharIcone(valor, iconOptions)?.Icon ?? DefaultIcon;
  const iconCor = corDaIdentidade(cor);
  const caixa = `${dimensions} flex items-center justify-center flex-shrink-0`;

  if (tipo === "logo" && logoUrl && !logoFailed) {
    return (
      <div className={`${dimensions} rounded overflow-hidden flex-shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={`Logotipo de ${nome}`} onError={() => setLogoQueFalhou(logoUrl)} className="w-full h-full object-cover" />
      </div>
    );
  }
  if (tipo === "emoji" && valor) {
    return <div className={`${caixa} ${emojiSize} leading-none`} aria-label={`Ícone ${valor}`}>{valor}</div>;
  }
  if (tipo === "icone") {
    return <div className={caixa} style={{ color: iconCor }}><Icon size={iconSize} strokeWidth={1.8} aria-hidden /></div>;
  }
  if (tipo === "logo") {
    return <div className={`${caixa} font-semibold tracking-[-.01em] ${size === "lg" ? "text-[1.25rem]" : size === "sm" ? "text-[0.75rem]" : "text-[0.9375rem]"}`} style={{ color: iconCor }}>{initials(nome)}</div>;
  }
  return <div className={`${caixa} text-black/30`}><DefaultIcon size={iconSize} strokeWidth={1.6} aria-hidden /></div>;
}
