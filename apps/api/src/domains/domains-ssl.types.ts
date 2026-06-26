export type DomainProvisioningStatus = "pending" | "active" | "error";

export type DomainProvisioningResult = {
  externalId: string;
  status: DomainProvisioningStatus;
  payload?: Record<string, unknown>;
  errorMessage?: string | null;
};

export type DomainProvisioningStatusResult = {
  status: DomainProvisioningStatus;
  payload?: Record<string, unknown>;
  errorMessage?: string | null;
};
