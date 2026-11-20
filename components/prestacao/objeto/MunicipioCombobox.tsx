"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PortalMenu, usePortalPosition } from "@/components/ui/ComboboxPortalMenu";
import { acharMunicipio, buscarMunicipios, CAMINHO_MUNICIPIOS, type Municipio, type TabelaMunicipios } from "@/lib/prestacao/municipios";

let carregando: Promise<TabelaMunicipios> | null = null;

/** A tabela de municípios, baixada uma vez por sessão do navegador. */
export function carregarMunicipios(): Promise<TabelaMunicipios> {
  carregando ??= fetch(CAMINHO_MUNICIPIOS).then(r => {
    if (!r.ok) throw new Error(`municípios: ${r.status}`);
    return r.json() as Promise<TabelaMunicipios>;
  }).catch(erro => { carregando = null; throw erro; });
  return carregando;
}

export type MunicipioEscolhido = { nome: string; ibge: string | null; latitude: number | null; longitude: number | null };

const doMunicipio = (m: Municipio): MunicipioEscolhido => ({ nome: m[1], ibge: m[0], latitude: m[3], longitude: m[4] });

/**
 * Município da UF: a pessoa digita e escolhe da lista do IBGE, que traz o
 * código e as coordenadas da sede. Sem a lista (fora do ar), o nome digitado vale.
 */
export function MunicipioCombobox({ uf, valor, onChange, id }: {
  uf: string;
  valor: MunicipioEscolhido;
  onChange: (municipio: MunicipioEscolhido) => void;
  id?: string;
}) {
  const [tabela, setTabela] = useState<TabelaMunicipios | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const campoRef = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const posicao = usePortalPosition(campoRef, aberto);

  useEffect(() => {
    let ativo = true;
    carregarMunicipios().then(t => { if (ativo) setTabela(t); }).catch(() => { if (ativo) setFalhou(true); });
    return () => { ativo = false; };
  }, []);

  const opcoes = useMemo(() => (tabela && uf ? buscarMunicipios(tabela, uf, valor.nome, 40) : []), [tabela, uf, valor.nome]);

  function digitar(texto: string) {
    // O nome igual ao de um município da UF já traz o código e as coordenadas.
    const exato = tabela && uf ? acharMunicipio(tabela, uf, texto) : null;
    onChange(exato ? { ...doMunicipio(exato), nome: texto } : { nome: texto, ibge: null, latitude: null, longitude: null });
    setAberto(true);
    setDestaque(0);
  }

  function escolher(m: Municipio) {
    onChange(doMunicipio(m));
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setDestaque(d => Math.min(d + 1, opcoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque(d => Math.max(d - 1, 0)); }
    else if (e.key === "Enter" && aberto && opcoes[destaque]) { e.preventDefault(); escolher(opcoes[destaque]); }
    else if (e.key === "Escape" && aberto) { e.preventDefault(); setAberto(false); }
  }

  const semUf = !uf;
  return (
    <div ref={campoRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={aberto && opcoes.length > 0}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label="Município"
        value={valor.nome}
        disabled={semUf}
        placeholder={semUf ? "Escolha a UF primeiro" : "Digite o município"}
        maxLength={120}
        onChange={e => digitar(e.target.value)}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={aoTeclar}
        className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:bg-black/[.02]"
      />
      {valor.nome.trim() && !semUf && (
        <span className="mt-1 block text-[0.625rem] text-black/40">
          {valor.ibge ? `IBGE ${valor.ibge}` : falhou ? "Lista do IBGE indisponível; o nome digitado vale" : "Escolha da lista para gravar o código do IBGE"}
        </span>
      )}
      {aberto && opcoes.length > 0 && (
        <PortalMenu position={posicao}>
          <ul id={listaId} role="listbox" aria-label="Municípios">
            {opcoes.map((m, i) => (
              <li key={m[0]} role="option" aria-selected={m[0] === valor.ibge}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => escolher(m)}
                  onMouseEnter={() => setDestaque(i)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[0.75rem] text-black/80 transition ${i === destaque ? "bg-black/[.04]" : ""}`}
                >
                  {m[1]}
                  <span className="text-[0.625rem] tabular-nums text-black/35">{m[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </PortalMenu>
      )}
    </div>
  );
}
