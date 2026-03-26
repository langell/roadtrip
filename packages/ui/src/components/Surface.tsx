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
    'rounded-3xl bg-[#f4f4ef] text-stone-900',
    elevation === 'raised' && 'shadow-[0_12px_28px_rgba(0,0,0,0.08)]',
    paddingMap[padding],
    className,
  );

  return <section className={classes}>{children}</section>;
};
