"use client";
import { useEffect, useState } from "react";
import {
  FolderOpen, Music2, HeartHandshake, Landmark, Theater, GraduationCap, Leaf, Palette,
  Building2, Users, Globe, Megaphone, Trophy, Target, TrendingUp, Network, Medal, Handshake,
} from "lucide-react";

export type IdentityType = "padrao" | "icone" | "emoji" | "logo";
export type IdentityIconOption = { key: string; label: string; Icon: React.ElementType };

export const PROJECT_ICON_OPTIONS = [
  { key: "musica", label: "Música", Icon: Music2 },
  { key: "cultura", label: "Cultura", Icon: Theater },
  { key: "social", label: "Social", Icon: HeartHandshake },
  { key: "patrimonio", label: "Patrimônio", Icon: Landmark },
  { key: "educacao", label: "Educação", Icon: GraduationCap },
  { key: "ambiental", label: "Ambiental", Icon: Leaf },
  { key: "arte", label: "Arte", Icon: Palette },
] as const;

export const PROPONENTE_ICON_OPTIONS = [
  { key: "instituicao", label: "Instituição", Icon: Building2 },
  { key: "patrimonio", label: "Patrimônio", Icon: Landmark },
  { key: "educacao", label: "Educação", Icon: GraduationCap },
  { key: "social", label: "Social", Icon: HeartHandshake },
  { key: "ambiental", label: "Ambiental", Icon: Leaf },
  { key: "comunidade", label: "Comunidade", Icon: Users },
  { key: "global", label: "Global", Icon: Globe },
] as const;

export const CAPTADOR_ICON_OPTIONS = [
  { key: "agencia", label: "Agência", Icon: Megaphone },
  { key: "negociacao", label: "Negociação", Icon: Handshake },
  { key: "performance", label: "Performance", Icon: TrendingUp },
  { key: "metas", label: "Metas", Icon: Target },
  { key: "conquista", label: "Conquista", Icon: Trophy },
  { key: "rede", label: "Rede", Icon: Network },
  { key: "premiacao", label: "Premiação", Icon: Medal },
] as const;

export const PROJECT_ICON_COLORS = [
  { key: "roxo", label: "Roxo", cor: "#7259B5" },
  { key: "azul", label: "Azul", cor: "#2D72B0" },
  { key: "verde", label: "Verde", cor: "#1A8B7A" },
  { key: "verde_lima", label: "Verde lima", cor: "#2E8932" },
  { key: "ambar", label: "Âmbar", cor: "#B07A14" },
  { key: "laranja", label: "Laranja", cor: "#E2703A" },
  { key: "vermelho", label: "Vermelho", cor: "#D94E4E" },
  { key: "cinza", label: "Cinza", cor: "#555555" },
] as const;

export const IDENTITY_COLORS = PROJECT_ICON_COLORS;

type ProjectIdentityProps = {
  nome: string;
  tipo?: IdentityType | null;
  valor?: string | null;
  logoUrl?: string | null;
  cor?: string | null;
  size?: "sm" | "md" | "lg";
  iconOptions?: readonly IdentityIconOption[];
  defaultIcon?: React.ElementType;
  /** Em linhas de tabela: só o ícone na cor, sem o quadrado de fundo. */
  semFundo?: boolean;
};

function initials(nome: string) {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "P").toUpperCase();
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
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [logoUrl]);
  const dimensions = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-14 h-14" : "w-9 h-9";
  const iconSize = size === "sm" ? 13 : size === "lg" ? 24 : 16;
  const iconOption = iconOptions.find(option => option.key === valor);
  const Icon = iconOption?.Icon ?? DefaultIcon;
  const iconCor = cor ?? "#7259B5";

  if (tipo === "logo" && logoUrl && !logoFailed) {
    return (
      <div className={`${dimensions} rounded overflow-hidden bg-black/5 flex-shrink-0`}>
        <img src={logoUrl} alt={`Logotipo de ${nome}`} onError={() => setLogoFailed(true)} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (semFundo && !(tipo === "logo" && logoUrl && !logoFailed)) {
    const caixa = `${dimensions} flex items-center justify-center flex-shrink-0`;
    if (tipo === "emoji" && valor) return <div className={`${caixa} text-[1.125rem]`} aria-label={`Ícone ${valor}`}>{valor}</div>;
    if (tipo === "icone") return <div className={caixa} style={{ color: iconCor }}><Icon size={iconSize} /></div>;
    if (tipo === "logo") return <div className={`${caixa} text-[0.6875rem] font-bold`} style={{ color: iconCor }}>{initials(nome)}</div>;
    return <div className={`${caixa} text-black/35`}><DefaultIcon size={iconSize} /></div>;
  }

  if (tipo === "emoji" && valor) {
    return <div className={`${dimensions} rounded flex items-center justify-center text-[1.125rem] flex-shrink-0`} style={FUNDO_NEUTRO} aria-label={`Ícone ${valor}`}>{valor}</div>;
  }

  // Identidade escolhida é marca, como o logo de uma empresa: quadrado na cor,
  // com o símbolo em branco (nunca ícone solto colorido).
  if (tipo === "icone") {
    return <div className={`${dimensions} rounded flex items-center justify-center flex-shrink-0 text-white`} style={fundoNaCor(iconCor)}><Icon size={iconSize} /></div>;
  }

  if (tipo === "logo" && logoFailed) {
    return <div className={`${dimensions} rounded flex items-center justify-center text-[0.6875rem] font-bold flex-shrink-0 text-white`} style={fundoNaCor(iconCor)}>{initials(nome)}</div>;
  }

  return <div className={`${dimensions} rounded flex items-center justify-center text-black/40 flex-shrink-0`} style={FUNDO_NEUTRO}><DefaultIcon size={iconSize} /></div>;
}

/**
 * Fundo do quadrado de identidade: gradiente em tons claros da cor, com brilho
 * fino no alto e sombra curta na própria cor, para dar volume.
 */
function fundoNaCor(cor: string): React.CSSProperties {
  return {
    background: `linear-gradient(150deg, color-mix(in srgb, ${cor} 58%, #fff) 0%, color-mix(in srgb, ${cor} 92%, #fff) 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.4), inset 0 -1px 0 rgba(13,13,13,.06), 0 1px 2px rgba(13,13,13,.08), 0 4px 10px -4px color-mix(in srgb, ${cor} 55%, transparent)`,
  };
}

const FUNDO_NEUTRO: React.CSSProperties = {
  background: "linear-gradient(150deg, #FFFFFF 0%, #EEEDEA 100%)",
  boxShadow: "inset 0 1px 0 #fff, inset 0 0 0 1px rgba(13,13,13,.06), 0 1px 2px rgba(13,13,13,.06)",
};
