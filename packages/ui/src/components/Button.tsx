import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

type ButtonTone = 'primary' | 'ghost';

type ButtonProps = PropsWithChildren<{
  tone?: ButtonTone;
  loading?: boolean;
}> &
  ButtonHTMLAttributes<HTMLButtonElement>;

const toneClasses: Record<ButtonTone, string> = {
  primary:
    'bg-wayfarer-primary text-white hover:opacity-90 focus-visible:ring-wayfarer-primary-light',
  ghost:
    'bg-transparent text-wayfarer-primary ring-1 ring-wayfarer-accent hover:bg-wayfarer-bg',
};

export const Button = ({
  children,
  tone = 'primary',
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps) => (
  <button
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-body text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-wayfarer-bg disabled:opacity-60',
      toneClasses[tone],
      className,
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading && (
      <span
        className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
        aria-hidden
      />
    )}
    <span>{children}</span>
  </button>
);
