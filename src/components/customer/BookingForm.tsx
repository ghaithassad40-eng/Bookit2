import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BookingRulesJson } from "@/lib/database.types";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  rules: BookingRulesJson;
  initial: { name: string; phone: string; email: string; notes: string };
  submitting?: boolean;
  onSubmit: (values: { name: string; phone: string; email: string; notes: string }) => void;
}

export function BookingForm({ rules, initial, submitting, onSubmit }: Props) {
  const { t } = useI18n();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = t("form.nameRequired");
    if (rules.requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) e.email = t("form.emailRequired");
    if (rules.requirePhone && values.phone.replace(/\D/g, "").length < 7) e.phone = t("form.phoneRequired");
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
        <Label htmlFor="name">{t("form.fullName")}</Label>
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
          <Label htmlFor="email">{t("form.email")}</Label>
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
          <Label htmlFor="phone">{t("form.phone")}</Label>
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
          <Label htmlFor="notes">{t("form.notes")}</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })}
          />
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t("form.reviewing") : t("form.continue")}
      </Button>
    </form>
  );
}
