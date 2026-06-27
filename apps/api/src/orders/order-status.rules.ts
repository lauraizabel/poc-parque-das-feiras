import { OrderStatus } from "@prisma/client";

export const OPERATIONAL_ORDER_STATUSES = [
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELED
] as const;

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: [OrderStatus.WAITING_PAYMENT, OrderStatus.CANCELED],
  WAITING_PAYMENT: [
    OrderStatus.PAYMENT_APPROVED,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELED
  ],
  PAYMENT_APPROVED: [OrderStatus.PROCESSING, OrderStatus.REFUNDED, OrderStatus.CANCELED],
  PAYMENT_FAILED: [OrderStatus.WAITING_PAYMENT, OrderStatus.CANCELED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELED, OrderStatus.REFUNDED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  DELIVERED: [OrderStatus.REFUNDED],
  CANCELED: [],
  REFUNDED: []
};

export function canTransitionOrderStatus(fromStatus: OrderStatus, toStatus: OrderStatus) {
  if (fromStatus === toStatus) {
    return true;
  }

  return ORDER_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function getAllowedOperationalOrderStatuses(fromStatus: OrderStatus) {
  return OPERATIONAL_ORDER_STATUSES.filter(
    (status) => status !== fromStatus && canTransitionOrderStatus(fromStatus, status)
  );
}
