import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BookingRulesJson } from "@/lib/database.types";

interface Props {
  rules: BookingRulesJson;
  initial: { name: string; phone: string; email: string; notes: string };
  submitting?: boolean;
  onSubmit: (values: { name: string; phone: string; email: string; notes: string }) => void;
}

export function BookingForm({ rules, initial, submitting, onSubmit }: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Name is required";
    if (rules.requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = "Valid email required";
    if (rules.requirePhone && values.phone.replace(/\D/g, "").length < 7) e.phone = "Valid phone required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        if (validate()) onSubmit(values);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
      </div>

      {rules.requireEmail && (
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
          />
          {errors.email && <p className="text-xs text-rose-500">{errors.email}</p>}
        </div>
      )}

      {rules.requirePhone && (
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
          />
          {errors.phone && <p className="text-xs text-rose-500">{errors.phone}</p>}
        </div>
      )}

      {rules.allowNotes && (
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })}
          />
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Reviewing..." : "Continue"}
      </Button>
    </form>
  );
}
