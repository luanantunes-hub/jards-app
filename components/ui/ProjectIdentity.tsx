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

  if (tipo === "emoji" && valor) {
    return <div className={`${dimensions} rounded bg-black/5 flex items-center justify-center text-[18px] flex-shrink-0`} aria-label={`Ícone ${valor}`}>{valor}</div>;
  }

  if (tipo === "icone") {
    return <div className={`${dimensions} rounded flex items-center justify-center flex-shrink-0`} style={{ color: iconCor }}><Icon size={iconSize} /></div>;
  }

  if (tipo === "logo" && logoFailed) {
    return <div className={`${dimensions} rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0`} style={{ color: iconCor }}>{initials(nome)}</div>;
  }

  return <div className={`${dimensions} rounded bg-black/5 flex items-center justify-center text-black/35 flex-shrink-0`}><DefaultIcon size={iconSize} /></div>;
}
