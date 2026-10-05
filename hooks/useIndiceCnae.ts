"use client";

import { useEffect, useState } from "react";
import { indexarCnaes, type IndiceCnae, type TabelaCnae } from "@/lib/prestacao/cnae";

// Uma carga por aba: o arquivo tem 1,1 MB (cerca de 220 KB comprimido) e só
// vem quando alguém abre a escolha de CNAE.
let carga: Promise<IndiceCnae> | null = null;

function carregar(): Promise<IndiceCnae> {
  carga ??= fetch("/dados/cnae-subclasses.json")
    .then(resposta => {
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      return resposta.json() as Promise<TabelaCnae>;
    })
    .then(indexarCnaes)
    .catch(erro => {
      carga = null;
      throw erro;
    });
  return carga;
}

/** Tabela da CNAE do IBGE pronta para busca e sugestão; null enquanto carrega. */
export function useIndiceCnae(ativo = true): { indice: IndiceCnae | null; erro: boolean } {
  const [estado, setEstado] = useState<{ indice: IndiceCnae | null; erro: boolean }>({ indice: null, erro: false });
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    carregar()
      .then(indice => { if (vivo) setEstado({ indice, erro: false }); })
      .catch(() => { if (vivo) setEstado({ indice: null, erro: true }); });
    return () => { vivo = false; };
  }, [ativo]);
  return estado;
}
