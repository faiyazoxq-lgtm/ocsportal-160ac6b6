import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteWorkOrder } from "@/hooks/useWorkOrders";
import { toast } from "sonner";

/**
 * Reusable destructive-delete dialog for work orders. Requires the user to
 * literally type `delete` (case-insensitive) before the action button enables,
 * so accidental clicks can't drop a job. Use this everywhere a work order
 * can be removed — keeps the confirmation UX consistent site-wide.
 */
export function DeleteWorkOrderDialog({
  open,
  onOpenChange,
  workOrderId,
  orderNo,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string | null;
  orderNo?: string | null;
  onDeleted?: () => void;
}) {
  const [typed, setTyped] = useState("");
  const del = useDeleteWorkOrder();
  const canDelete = typed.trim().toLowerCase() === "delete" && !!workOrderId;

  const handleOpen = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  const handleDelete = () => {
    if (!workOrderId) return;
    del.mutate(workOrderId, {
      onSuccess: () => {
        toast.success(`Deleted work order ${orderNo ?? ""}`.trim());
        setTyped("");
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (e) => toast.error(`Couldn't delete: ${(e as Error).message}`),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete work order {orderNo ?? ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the work order and all its assignments,
            events, expenses, files, and related records. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete-input" className="text-sm">
            Type <span className="font-mono font-semibold">delete</span> to
            confirm
          </Label>
          <Input
            id="confirm-delete-input"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="delete"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canDelete && !del.isPending) {
                e.preventDefault();
                handleDelete();
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)} disabled={del.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canDelete || del.isPending}
            onClick={handleDelete}
          >
            {del.isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}