"use client";

import { useId, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES } from "@/server/domain/countries";
import type { FilterOptions } from "@/server/repositories/employee-repository";
import type { EmployeeDto } from "@/server/services/dto";
import {
  EMPTY_VALUES,
  mapServerError,
  salaryHint,
  toRequestBody,
  validateEmployeeForm,
  valuesFromEmployee,
  type FormValues,
} from "../_lib/employee-form";
import { createEmployee, updateEmployee } from "../_lib/employees-api";
import { FormField } from "./form-field";

const COUNTRY_ITEMS = COUNTRIES.map((country) => ({ value: country.code, label: `${country.name} (${country.currency})` }));

const utcToday = () => new Date().toISOString().slice(0, 10);

/** Runs the shared domain schema; the same rules the API applies. */
const resolver: Resolver<FormValues> = async (values) => {
  const errors = validateEmployeeForm(values, utcToday());
  if (errors.length === 0) return { values, errors: {} };
  return {
    values: {},
    errors: Object.fromEntries(errors.map(({ name, message }) => [name, { type: "validation", message }])),
  };
};

/** "85,000" and " 85000 " are fine; an empty box means "no value yet". */
function parseSalary(raw: unknown): number | undefined {
  const text = String(raw ?? "").trim().replaceAll(",", "");
  return text === "" ? undefined : Number(text);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The employee being edited, or null to create a new one. */
  employee: EmployeeDto | null;
  filterOptions: FilterOptions;
  /** Called after a successful save so the list can be refreshed. */
  onSaved: () => void;
};

export function EmployeeFormDialog({ open, onOpenChange, ...rest }: Props) {
  const nameInput = useRef<HTMLInputElement>(null);
  const title = rest.employee ? "Edit employee" : "Add employee";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" initialFocus={nameInput}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {rest.employee ? "Update this employee's record." : "Create a new employee record."} All fields are required.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from the right values. */}
        <EmployeeForm {...rest} nameInput={nameInput} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type FormProps = Omit<Props, "open" | "onOpenChange"> & { nameInput: React.RefObject<HTMLInputElement | null>; close: () => void };

function EmployeeForm({ employee, filterOptions, onSaved, nameInput, close }: FormProps) {
  const formId = useId();
  const [formError, setFormError] = useState<string>();
  const [today] = useState(utcToday);
  const initialCountry = employee?.countryCode ?? "";

  const form = useForm<FormValues>({
    resolver,
    defaultValues: employee ? valuesFromEmployee(employee) : EMPTY_VALUES,
    mode: "onBlur",
  });
  const { register, control, formState, handleSubmit, setError, trigger } = form;
  const countryCode = useWatch({ control, name: "countryCode" });
  const { currency, hint } = salaryHint(countryCode);
  const currencyChanged = Boolean(employee) && countryCode !== initialCountry;
  const nameField = register("fullName");

  const save = handleSubmit(async () => {
    setFormError(undefined);
    // The form's own values go to the API unchanged; the server validates them again and does the conversion.
    const body = toRequestBody(form.getValues());
    const result = employee ? await updateEmployee(employee.id, body) : await createEmployee(body);

    if (result.ok) {
      toast.success(employee ? `Saved changes to ${result.data.fullName}` : `Added ${result.data.fullName}`);
      onSaved();
      close();
      return;
    }
    const { fields, formMessage } = mapServerError(result.error);
    fields.forEach(({ name, message }, index) => setError(name, { type: "server", message }, { shouldFocus: index === 0 }));
    setFormError(formMessage);
  });

  const error = (name: keyof FormValues) => formState.errors[name]?.message;

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${formId}-fullName`} label="Full name" error={error("fullName")}>
          {(control) => (
            <Input
              {...control}
              {...nameField}
              ref={(element) => {
                nameField.ref(element);
                nameInput.current = element;
              }}
              autoComplete="off"
            />
          )}
        </FormField>

        <FormField id={`${formId}-email`} label="Email" error={error("email")}>
          {(control) => <Input {...control} {...register("email")} type="email" autoComplete="off" />}
        </FormField>

        <FormField id={`${formId}-jobTitle`} label="Job title" error={error("jobTitle")}>
          {(control) => <Input {...control} {...register("jobTitle")} list={`${formId}-jobTitles`} autoComplete="off" />}
        </FormField>

        <FormField id={`${formId}-department`} label="Department" error={error("department")}>
          {(control) => <Input {...control} {...register("department")} list={`${formId}-departments`} autoComplete="off" />}
        </FormField>

        <FormField id={`${formId}-countryCode`} label="Country" error={error("countryCode")}>
          {(field) => (
            <Controller
              control={control}
              name="countryCode"
              render={({ field: { value, onChange, onBlur } }) => (
                <Select
                  items={COUNTRY_ITEMS}
                  value={value || null}
                  onValueChange={(next) => {
                    onChange(next ?? "");
                    // A different currency can make an amount that was fine invalid (for example decimals for yen).
                    if (formState.dirtyFields.salary || formState.isSubmitted) void trigger("salary");
                  }}
                >
                  <SelectTrigger id={field.id} aria-invalid={field["aria-invalid"]} aria-describedby={field["aria-describedby"]} onBlur={onBlur} className="w-full">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>

        <FormField
          id={`${formId}-salary`}
          label={currency ? `Annual gross salary (${currency})` : "Annual gross salary"}
          error={error("salary")}
          hint={hint}
        >
          {(control) => (
            <Input
              {...control}
              {...register("salary", { setValueAs: parseSalary })}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={currency ? `Amount in ${currency}` : "Amount"}
              className="tabular-nums"
            />
          )}
        </FormField>

        <FormField id={`${formId}-hireDate`} label="Hire date" error={error("hireDate")}>
          {(control) => <Input {...control} {...register("hireDate")} type="date" max={today} />}
        </FormField>
      </div>

      {currencyChanged && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Changing the country changes the salary&apos;s currency. Enter the salary again in {currency ?? "the new currency"}; the amount is
          not converted.
        </p>
      )}

      <datalist id={`${formId}-jobTitles`}>
        {filterOptions.jobTitles.map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>
      <datalist id={`${formId}-departments`}>
        {filterOptions.departments.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={formState.isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Saving…" : employee ? "Save changes" : "Add employee"}
        </Button>
      </DialogFooter>
    </form>
  );
}
