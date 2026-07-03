import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button (UI/UX §2.5): primary (ink-900), secondary (outline), destructive
 * (accent-alert). Visible focus-ring is inherited from the global :focus-visible
 * rule, so we never strip the outline.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-card font-sans font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink-900 text-surface-0 hover:opacity-90',
        secondary: 'border border-neutral-200 bg-surface-0 text-ink-900 hover:bg-paper-50',
        destructive: 'bg-accent-alert text-surface-0 hover:opacity-90',
        ghost: 'text-ink-900 hover:bg-neutral-200/60',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
