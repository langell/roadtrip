import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

type ButtonTone = 'primary' | 'ghost';

type ButtonProps = PropsWithChildren<{
  tone?: ButtonTone;
  loading?: boolean;
}> &
  ButtonHTMLAttributes<HTMLButtonElement>;

const toneClasses: Record<ButtonTone, string> = {
  primary: 'bg-[#1B4332] text-white hover:opacity-90 focus-visible:ring-[#a5d0b9]',
  ghost: 'bg-transparent text-[#1B4332] ring-1 ring-[#c1c8c2] hover:bg-[#fafaf5]',
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
      'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf5] disabled:opacity-60',
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
