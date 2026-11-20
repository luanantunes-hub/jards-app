"use client";

import { createContext, useContext } from "react";

interface OrganizationContextValue {
  organizationId: string | null;
  organizationName: string;
  /** Papel da pessoa na organização atual (admin, captador, proponente…). */
  papel: string | null;
  /** A pessoa usa a produção na organização atual (módulo ativo na organização e no vínculo). */
  usaProducao: boolean;
}

export const OrganizationContext = createContext<OrganizationContextValue>({
  organizationId: null,
  organizationName: "",
  papel: null,
  usaProducao: false,
});

export function useOrganizationId(): string | null {
  return useContext(OrganizationContext).organizationId;
}

export function useOrganizationName(): string {
  return useContext(OrganizationContext).organizationName;
}

export function useOrganizationRole(): string | null {
  return useContext(OrganizationContext).papel;
}

export function useUsaProducao(): boolean {
  return useContext(OrganizationContext).usaProducao;
}
