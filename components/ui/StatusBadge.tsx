import {
  Eye, Phone, Send, MessageSquare, Check, X, RotateCcw,
  Pencil, AlertTriangle, Archive, Search, UserCheck, UserX,
  Clock, FileText, AlertCircle, Zap, Star, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { CINZA_ETIQUETA, corDeEtiqueta } from "@/lib/etiquetas-padrao";

type BadgeDef = { label: string; bg: string; icon: LucideIcon };

export const STATUS_BADGE: Record<string, BadgeDef> = {
  // Captação
  prospeccao:        { label: "Prospecção",       bg: "#666666",  icon: Eye },
  primeiro_contato:  { label: "1º Contato",        bg: "#7259B5",  icon: Phone },
  proposta_enviada:  { label: "Proposta",          bg: "#2D72B0",  icon: Send },
  em_negociacao:     { label: "Negociação",        bg: "#B07A14",  icon: MessageSquare },
  aprovado:          { label: "Aprovado",          bg: "#2E8932",  icon: Check },
  recusado:          { label: "Recusado",          bg: "#D94E4E",  icon: X },
  renovacao:         { label: "Renovação",         bg: "#2D72B0",  icon: RotateCcw },

  // Prestação de contas
  rascunho:          { label: "Rascunho",          bg: "#666666",  icon: Pencil },
  revisao_interna:   { label: "Revisão interna",   bg: "#2D72B0",  icon: Eye },
  enviado:           { label: "Enviado",           bg: "#B07A14",  icon: Send },
  ajuste_solicitado: { label: "Ajuste solicitado", bg: "#D94E4E",  icon: AlertTriangle },
  arquivado:         { label: "Arquivado",         bg: "#666666",  icon: Archive },

  // Edital inscrito
  inscrito:          { label: "Inscrito",          bg: "#7259B5",  icon: FileText },
  em_analise:        { label: "Em análise",        bg: "#B07A14",  icon: Clock },
  reprovado:         { label: "Reprovado",         bg: "#D94E4E",  icon: X },
  desclassificado:   { label: "Desclassificado",   bg: "#D94E4E",  icon: X },
  habilitado:        { label: "Habilitado",        bg: "#2D72B0",  icon: Check },
  classificado:      { label: "Classificado",      bg: "#2D72B0",  icon: Star },

  // Etiquetas de empresa CRM (prospect / cliente / ex-cliente)
  prospect:          { label: "Prospect",          bg: "#7259B5",  icon: Search },
  cliente_ativo:     { label: "Cliente",           bg: "#2E8932",  icon: UserCheck },
  ex_cliente:        { label: "Ex-Cliente",        bg: "#D94E4E",  icon: UserX },

  // Risco glosa
  baixo:             { label: "Risco baixo",       bg: "#2E8932",  icon: Check },
  medio:             { label: "Risco médio",       bg: "#B07A14",  icon: AlertCircle },
  alto:              { label: "Risco alto",        bg: "#D94E4E",  icon: AlertTriangle },

  // Edital inscrito extras
  interesse:         { label: "Interesse",         bg: "#666666",  icon: Eye },
  cancelado:         { label: "Cancelado",         bg: "#666666",  icon: X },
  aguardando:        { label: "Aguardando",        bg: "#B07A14",  icon: Clock },
  enviada:           { label: "Enviada",           bg: "#2D72B0",  icon: Send },
  visualizada:       { label: "Visualizada",       bg: "#2D72B0",  icon: Eye },
  aceita:            { label: "Aceita",            bg: "#2E8932",  icon: Check },
  recusada:          { label: "Recusada",          bg: "#D94E4E",  icon: X },
  expirada:          { label: "Expirada",          bg: "#666666",  icon: Clock },
  arquivada:         { label: "Arquivada",         bg: "#666666",  icon: Archive },

  // Genérico
  ativo:             { label: "Ativo",             bg: "#2E8932",  icon: Zap },
  inativo:           { label: "Inativo",           bg: "#666666",  icon: X },
};

type Props = {
  status: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
  withChevron?: boolean;
  bg?: string;
  iconName?: string;
  variant?: "solid" | "outline";
};

export default function StatusBadge({ status, label, size = "md", className = "", withChevron = false, bg, iconName, variant = "solid" }: Props) {
  const def = STATUS_BADGE[status];
  const Icon = (iconName ? (Icons as any)[iconName] as LucideIcon | undefined : undefined) ?? def?.icon ?? FileText;
  const color = corDeEtiqueta(bg) ?? def?.bg ?? CINZA_ETIQUETA;
  const text = label ?? def?.label ?? status;

  const iconSize = size === "sm" ? 9 : 11;
  const chevronSize = size === "sm" ? 10 : 12;
  const textSize = size === "sm" ? "text-[0.5625rem]" : "text-[0.6875rem]";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  const style = variant === "outline"
    ? { background: "white", border: `1.5px solid ${color}`, color }
    : { background: color };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-semibold flex-shrink-0 ${variant === "solid" ? "text-white" : ""} ${padding} ${textSize} ${className}`}
      style={style}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
      {text}
      {withChevron && <ChevronDown size={chevronSize} strokeWidth={2.5} className="opacity-75 -mr-0.5" />}
    </span>
  );
}
