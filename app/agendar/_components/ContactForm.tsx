"use client";

export interface ContactValues {
  full_name: string;
  email: string;
  phone: string;
  terms: boolean;
}

export type ContactField = keyof ContactValues;
export type FieldErrors = Partial<Record<ContactField, string>>;

interface Props {
  values: ContactValues;
  errors: FieldErrors;
  disabled: boolean;
  termsUrl: string;
  onChange: (values: ContactValues) => void;
}

const inputBase =
  "mt-1 block w-full rounded-lg border bg-surface-2 px-3 py-2.5 text-base text-white placeholder:text-muted/60 outline-none transition focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

export function ContactForm({
  values,
  errors,
  disabled,
  termsUrl,
  onChange,
}: Props) {
  const set = <K extends ContactField>(key: K, value: ContactValues[K]) =>
    onChange({ ...values, [key]: value });

  const border = (field: ContactField) =>
    errors[field] ? "border-red-400" : "border-line focus:border-accent";

  return (
    <section
      aria-labelledby="contact-title"
      className="rounded-2xl border bg-surface p-5 sm:p-6 border-line"
    >
      <h2 id="contact-title" className="font-display text-xl font-bold uppercase tracking-wide text-white">
        2. Tus datos
      </h2>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="full_name" className="text-sm font-medium text-fg">
            Nombre completo
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            disabled={disabled}
            value={values.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            aria-invalid={!!errors.full_name}
            aria-describedby={errors.full_name ? "full_name-error" : undefined}
            className={`${inputBase} ${border("full_name")}`}
          />
          <FieldError id="full_name-error" message={errors.full_name} />
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium text-fg">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            disabled={disabled}
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`${inputBase} ${border("email")}`}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div>
          <label htmlFor="phone" className="text-sm font-medium text-fg">
            Teléfono
          </label>
          <div className="flex items-stretch gap-2">
            <span className="mt-1 flex items-center rounded-lg border border-line bg-surface-2 px-3 text-muted">
              +56
            </span>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              placeholder="9 1234 5678"
              required
              disabled={disabled}
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              className={`${inputBase} ${border("phone")}`}
            />
          </div>
          <FieldError id="phone-error" message={errors.phone} />
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              name="terms"
              disabled={disabled}
              checked={values.terms}
              onChange={(e) => set("terms", e.target.checked)}
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? "terms-error" : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-accent"
            />
            <span>
              Acepto los{" "}
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline"
              >
                términos y condiciones
              </a>
            </span>
          </label>
          <FieldError id="terms-error" message={errors.terms} />
        </div>
      </div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-300">
      {message}
    </p>
  );
}
