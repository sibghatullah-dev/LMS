import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const fieldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink-900">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn(
            'h-10 rounded-md border border-neutral-200 bg-surface-0 px-3 text-sm text-ink-900 outline-none placeholder:text-neutral-500 focus:border-ink-900',
            error && 'border-accent-alert',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${fieldId}-error`} className="text-caption text-accent-alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Field.displayName = 'Field';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, id, className, children, ...props }, ref) => {
    const fieldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink-900">
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          className={cn(
            'h-10 rounded-md border border-neutral-200 bg-surface-0 px-3 text-sm text-ink-900 outline-none focus:border-ink-900',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
SelectField.displayName = 'SelectField';
