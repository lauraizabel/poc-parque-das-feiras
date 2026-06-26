export type HostResolution =
  | {
      kind: "dashboard";
      matchedHost: string;
    }
  | {
      kind: "api";
      matchedHost: string;
    }
  | {
      kind: "storefront-root";
      matchedHost: string;
    }
  | {
      kind: "storefront-store";
      matchedHost: string;
      storeId: string;
      storeSlug: string;
      source: "subdomain" | "custom-domain";
    }
  | {
      kind: "unknown";
      matchedHost: string;
    };
