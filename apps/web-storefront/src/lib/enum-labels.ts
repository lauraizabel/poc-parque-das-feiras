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

export function formatOrderStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(ORDER_STATUS_LABELS, value);
}

export function formatPaymentStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(PAYMENT_STATUS_LABELS, value);
}

export function formatShipmentStatusLabel(value: string | null | undefined) {
  return formatEnumLabel(SHIPMENT_STATUS_LABELS, value);
}
