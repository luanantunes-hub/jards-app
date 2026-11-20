"use client";
import { useEffect, useMemo, useState } from "react";
import { LOGOS_HISTORICOS } from "@/lib/logos-historicos";

const TOKEN = process.env.NEXT_PUBLIC_LOGODEV_TOKEN ?? process.env.NEXT_PUBLIC_LOGODOTDEV_TOKEN ?? "";

export function resolveCompanyDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0] || null;
  }
}

interface Props {
  nome: string;
  /** Preferred CRM domain (usually `empresas_crm.domain_key`). */
  domain?: string | null;
  site?: string | null;
  logo_url?: string | null;
  size?: number;
  className?: string;
}

export function CompanyLogo({ nome, domain: domainProp, site, logo_url, size = 32, className = "" }: Props) {
  const domain = useMemo(() => resolveCompanyDomain(domainProp ?? site), [domainProp, site]);
  const historico = domain ? LOGOS_HISTORICOS[domain] ?? null : null;
  const logodotdev = domain && !historico
    ? `https://img.logo.dev/${domain}?${new URLSearchParams({ ...(TOKEN ? { token: TOKEN } : {}), size: String(size * 2), format: "png" })}`
    : null;
  const initial = historico ?? logodotdev ?? logo_url ?? null;
  const [src, setSrc] = useState<string | null>(initial);

  useEffect(() => setSrc(initial), [initial]);

  function handleError() {
    if (src === logodotdev && logo_url && logo_url !== logodotdev) {
      setSrc(logo_url);
    } else {
      setSrc(null);
    }
  }

  const letter = nome.trim().charAt(0).toUpperCase();
  // size em px na base de 16px; em rem, o logo acompanha a fonte base em telas grandes.
  const lado = `${size / 16}rem`;

  if (src) {
    return (
      <img
        src={src}
        alt={nome}
        width={size}
        height={size}
        className={`object-contain bg-white rounded ${className}`}
        style={{ width: lado, height: lado }}
        onError={handleError}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Logo indisponível de ${nome}`}
      className={`flex items-center justify-center font-semibold select-none rounded ${className}`}
      style={{
        width: lado,
        height: lado,
        fontSize: `${Math.round(size * 0.38) / 16}rem`,
        background: "linear-gradient(145deg, #f8f8fb 0%, #d4d4dc 100%)",
        color: "#9e9ea8",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      {letter}
    </div>
  );
}
