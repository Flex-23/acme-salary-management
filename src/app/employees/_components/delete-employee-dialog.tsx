"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EmployeeDto } from "@/server/services/dto";
import { deleteEmployee } from "../_lib/employees-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The employee to delete. Kept while the dialog animates closed. */
  employee: EmployeeDto | null;
  /** Called after the employee is gone so the list can be refreshed. */
  onDeleted: () => void;
};

export function DeleteEmployeeDialog({ open, onOpenChange, employee, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  const close = (next: boolean) => {
    if (deleting) return;
    if (!next) setError(undefined);
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!employee) return;
    setDeleting(true);
    setError(undefined);
    const result = await deleteEmployee(employee.id);
    setDeleting(false);

    // Someone else may have removed them already: the goal (they are gone) is met either way.
    if (result.ok || result.error.code === "NOT_FOUND") {
      toast.success(result.ok ? `Deleted ${employee.fullName}` : `${employee.fullName} was already deleted`);
      onDeleted();
      onOpenChange(false);
      return;
    }
    setError("The employee could not be deleted. Please try again.");
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {employee?.fullName ?? "employee"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes {employee ? `${employee.fullName} (${employee.email})` : "this employee"} and their salary
            record. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
