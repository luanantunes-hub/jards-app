import { Landmark, Trophy, Clapperboard, HeartHandshake, Building2, MapPin, Tag, Minus } from "lucide-react";

export const LEI_OPTIONS = [
  { status: "",            label: "Sem lei",     bg: "rgba(13,13,13,.4)",  icon: Minus,          iconName: "Minus" },
  { status: "rouanet",     label: "Rouanet",     bg: "#7259B5",            icon: Landmark,       iconName: "Landmark" },
  { status: "esporte",     label: "Esporte",     bg: "#2D72B0",            icon: Trophy,         iconName: "Trophy" },
  { status: "audiovisual", label: "Audiovisual", bg: "#1A8B7A",            icon: Clapperboard,    iconName: "Clapperboard" },
  { status: "fia",         label: "FIA",         bg: "#C2517F",            icon: HeartHandshake, iconName: "HeartHandshake" },
  { status: "icms",        label: "ICMS",        bg: "#5B7C99",            icon: Building2,      iconName: "Building2" },
  { status: "iss",         label: "ISS",         bg: "#8B6F47",            icon: MapPin,         iconName: "MapPin" },
  { status: "outros",      label: "Patrocínio direto", bg: "rgba(13,13,13,.55)", icon: Tag,         iconName: "Tag" },
];
