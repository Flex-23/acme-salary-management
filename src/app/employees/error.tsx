"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function EmployeesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 rounded-lg border bg-background p-6 text-center">
      <h2 className="text-base font-semibold">Employees could not be loaded</h2>
      <p className="text-sm text-muted-foreground">
        Something went wrong while loading the list. Your data is safe; try again in a moment.
        {error.digest ? ` (Reference: ${error.digest})` : null}
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
