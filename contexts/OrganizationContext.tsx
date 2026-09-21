"use client";

import { createContext, useContext } from "react";

interface OrganizationContextValue {
  organizationId: string | null;
  organizationName: string;
}

export const OrganizationContext = createContext<OrganizationContextValue>({
  organizationId: null,
  organizationName: "",
});

export function useOrganizationId(): string | null {
  return useContext(OrganizationContext).organizationId;
}

export function useOrganizationName(): string {
  return useContext(OrganizationContext).organizationName;
}
