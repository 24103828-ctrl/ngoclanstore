import { cn } from "@/lib/utils";
import { getStatusLabel, getStatusStyles } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/db-types";

interface StatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        getStatusStyles(status),
        className,
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
