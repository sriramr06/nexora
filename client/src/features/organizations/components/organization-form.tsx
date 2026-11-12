import { useId, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  INDUSTRIES,
  ORG_SIZES,
  ORG_TYPES,
  organizationDetailsSchema,
  type Organization,
  type OrganizationDetailsInput,
} from "@nexora/shared";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyServerErrors } from "@/lib/form-errors";
import { Field, FormError, SubmitButton } from "@/features/auth/components/form-parts";
import {
  browserTimezone,
  COUNTRY_OPTIONS,
  INDUSTRY_LABELS,
  ORG_SIZE_LABELS,
  ORG_TYPE_LABELS,
  timezoneOptions,
} from "../labels";

const FIELDS = [
  "name",
  "type",
  "size",
  "industry",
  "country",
  "timezone",
  "website",
  "description",
] as const;

const toFormValues = (org?: Organization): OrganizationDetailsInput => ({
  name: org?.name ?? "",
  type: org?.type ?? ("" as never),
  size: org?.size ?? ("" as never),
  industry: org?.industry ?? ("" as never),
  country: org?.country ?? "",
  // FR-ORG-01: pre-filled from the browser, editable.
  timezone: org?.timezone ?? browserTimezone(),
  website: org?.website ?? "",
  description: org?.description ?? "",
});

interface SelectFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  registration: ReturnType<ReturnType<typeof useForm<OrganizationDetailsInput>>["register"]>;
}

function SelectField({ label, error, children, registration }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        className="w-full"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      >
        {children}
      </NativeSelect>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface OrganizationFormProps {
  organization?: Organization;
  submitLabel: string;
  onSubmit: (values: OrganizationDetailsInput) => Promise<unknown>;
}

// FR-ORG-01 fields, shared by registration, settings and "fix a rejection".
export function OrganizationForm({ organization, submitLabel, onSubmit }: OrganizationFormProps) {
  const form = useForm<OrganizationDetailsInput>({
    resolver: zodResolver(organizationDetailsSchema) as never,
    defaultValues: toFormValues(organization),
  });
  const { errors, isSubmitting } = form.formState;
  const descriptionId = useId();

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyServerErrors(error, form.setError, FIELDS);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field
        label="Organization name"
        autoComplete="organization"
        error={errors.name?.message}
        {...form.register("name")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" error={errors.type?.message} registration={form.register("type")}>
          <NativeSelectOption value="" disabled>
            Select…
          </NativeSelectOption>
          {ORG_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {ORG_TYPE_LABELS[t]}
            </NativeSelectOption>
          ))}
        </SelectField>
        <SelectField
          label="Company size"
          error={errors.size?.message}
          registration={form.register("size")}
        >
          <NativeSelectOption value="" disabled>
            Select…
          </NativeSelectOption>
          {ORG_SIZES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {ORG_SIZE_LABELS[s]}
            </NativeSelectOption>
          ))}
        </SelectField>
      </div>

      <SelectField
        label="Industry"
        error={errors.industry?.message}
        registration={form.register("industry")}
      >
        <NativeSelectOption value="" disabled>
          Select…
        </NativeSelectOption>
        {INDUSTRIES.map((i) => (
          <NativeSelectOption key={i} value={i}>
            {INDUSTRY_LABELS[i]}
          </NativeSelectOption>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Country"
          error={errors.country?.message}
          registration={form.register("country")}
        >
          <NativeSelectOption value="" disabled>
            Select…
          </NativeSelectOption>
          {COUNTRY_OPTIONS.map((c) => (
            <NativeSelectOption key={c.code} value={c.code}>
              {c.name}
            </NativeSelectOption>
          ))}
        </SelectField>
        <SelectField
          label="Timezone"
          error={errors.timezone?.message}
          registration={form.register("timezone")}
        >
          {timezoneOptions(organization?.timezone).map((z) => (
            <NativeSelectOption key={z} value={z}>
              {z.replaceAll("_", " ")}
            </NativeSelectOption>
          ))}
        </SelectField>
      </div>

      <Field
        label="Website (optional)"
        type="url"
        placeholder="https://"
        autoComplete="url"
        error={errors.website?.message}
        {...form.register("website")}
      />

      <div className="grid gap-1.5">
        <Label htmlFor={descriptionId}>Description (optional)</Label>
        <Textarea
          id={descriptionId}
          rows={3}
          aria-invalid={errors.description ? true : undefined}
          {...form.register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <FormError message={errors.root?.message} />
      <div className="sm:w-48">
        <SubmitButton pending={isSubmitting}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
