"use client";

import { createContext, useContext } from "react";

interface OrganizationContextValue {
  organizationId: string | null;
}

export const OrganizationContext = createContext<OrganizationContextValue>({
  organizationId: null,
});

export function useOrganizationId(): string | null {
  return useContext(OrganizationContext).organizationId;
}
