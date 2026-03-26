import type { PropsWithChildren } from 'react';
import clsx from 'clsx';

type SurfaceProps = PropsWithChildren<{
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'raised';
  className?: string;
}>;

const paddingMap: Record<NonNullable<SurfaceProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export const Surface = ({
  children,
  padding = 'md',
  elevation = 'flat',
  className,
}: SurfaceProps) => {
  const classes = clsx(
    'rounded-2xl border border-white/10 bg-slate-900/80 text-white shadow-lg backdrop-blur',
    elevation === 'raised' && 'shadow-xl shadow-slate-900/40',
    paddingMap[padding],
    className,
  );

  return <section className={classes}>{children}</section>;
};
