import { OrderStatus } from "./db-types";

export interface StatusDefinition {
  label: string;
  colorClass: string;
  bgClass: string;
}

export const statusMap: Record<OrderStatus, StatusDefinition> = {
  pending: {
    label: "Đang chờ xác nhận",
    colorClass: "text-yellow-600 dark:text-yellow-400 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20",
    bgClass: "bg-yellow-500",
  },
  shipping: {
    label: "Đang giao",
    colorClass: "text-blue-600 dark:text-blue-400 border-blue-200 bg-blue-50 dark:bg-blue-950/20",
    bgClass: "bg-blue-500",
  },
  completed: {
    label: "Hoàn thành",
    colorClass: "text-green-600 dark:text-green-400 border-green-200 bg-green-50 dark:bg-green-950/20",
    bgClass: "bg-green-500",
  },
  failed: {
    label: "Thất bại",
    colorClass: "text-red-600 dark:text-red-400 border-red-200 bg-red-50 dark:bg-red-950/20",
    bgClass: "bg-red-500",
  },
};

export function getStatusLabel(status: OrderStatus | string): string {
  return statusMap[status as OrderStatus]?.label ?? status;
}

export function getStatusStyles(status: OrderStatus | string): string {
  return statusMap[status as OrderStatus]?.colorClass ?? "text-muted-foreground border-muted bg-muted/20";
}
