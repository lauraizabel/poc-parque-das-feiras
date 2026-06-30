const STORE_ROLE_LABELS: Record<string, string> = {
  STORE_OWNER: "Proprietária",
  STORE_MANAGER: "Gerente",
  STORE_SUPPORT: "Suporte"
};

const PLATFORM_ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Administrador da plataforma",
  CUSTOMER: "Cliente"
};

const STORE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  TRIALING: "Em teste",
  PAST_DUE: "Pagamento pendente",
  SUSPENDED: "Suspensa"
};

const DOMAIN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Cadastro recebido",
  AWAITING_DNS: "Aguardando DNS",
  VERIFYING: "Verificando DNS",
  SSL_PENDING: "Emitindo SSL",
  ACTIVE: "Ativo",
  ERROR: "Requer atenção",
  REMOVED: "Removido"
};

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Publicado",
  INACTIVE: "Inativo",
  OUT_OF_STOCK: "Sem estoque",
  ARCHIVED: "Arquivado"
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: "Criado",
  WAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PAYMENT_FAILED: "Pagamento recusado",
  PROCESSING: "Em preparo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado"
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CREATED: "Criado",
  PENDING: "Pendente",
  AUTHORIZED: "Autorizado",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado"
};

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  READY_TO_SHIP: "Pronto para envio",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  RETURNED: "Devolvido"
};

const SHIPPING_METHOD_TYPE_LABELS: Record<string, string> = {
  FIXED_PRICE: "Preço fixo",
  LOCAL_PICKUP: "Retirada local"
};

const SHIPPING_METHOD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo"
};

const PROVIDER_LABELS: Record<string, string> = {
  STRIPE_CONNECT: "Stripe Connect",
  PAGARME: "Pagar.me",
  MERCADO_PAGO: "Mercado Pago",
  ASAAS: "Asaas"
};

const TRANSACTION_KIND_LABELS: Record<string, string> = {
  INTENT: "Intenção",
  AUTHORIZATION: "Autorização",
  CAPTURE: "Captura",
  CANCELLATION: "Cancelamento",
  REFUND: "Reembolso",
  WEBHOOK: "Webhook"
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  SUCCEEDED: "Concluída",
  FAILED: "Falhou",
  CANCELED: "Cancelada"
};

function formatEnumFallback(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEnumLabel(labels: Record<string, string>, value: string | null | undefined) {
  return value ? labels[value] ?? formatEnumFallback(value) : "n/a";
}

export function formatStoreRoleLabel(value: string | null | undefined) {
  return formatEnumLabel(STORE_ROLE_LABELS, value);
}

export function formatPlatformRoleLabel(value: string | null | undefined) {
  return formatEnumLabel(PLATFORM_ROLE_LABELS, value);
}

export function formatStoreStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(STORE_STATUS_LABELS, value);
}

export function formatDomainStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(DOMAIN_STATUS_LABELS, value);
}

export function formatProductStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(PRODUCT_STATUS_LABELS, value);
}

export function formatOrderStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(ORDER_STATUS_LABELS, value);
}

export function formatPaymentStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(PAYMENT_STATUS_LABELS, value);
}

export function formatShipmentStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(SHIPMENT_STATUS_LABELS, value);
}

export function formatShippingMethodTypeLabel(value: string | null | undefined) {
  return formatEnumLabel(SHIPPING_METHOD_TYPE_LABELS, value);
}

export function formatShippingMethodStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(SHIPPING_METHOD_STATUS_LABELS, value);
}

export function formatProviderLabel(value: string | null | undefined) {
  return formatEnumLabel(PROVIDER_LABELS, value);
}

export function formatTransactionKindLabel(value: string | null | undefined) {
  return formatEnumLabel(TRANSACTION_KIND_LABELS, value);
}

export function formatTransactionStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(TRANSACTION_STATUS_LABELS, value);
}
