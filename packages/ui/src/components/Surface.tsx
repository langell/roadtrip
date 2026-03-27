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
    'rounded-3xl bg-wayfarer-surface text-wayfarer-text-main',
    elevation === 'raised' && 'shadow-wayfarer-ambient',
    paddingMap[padding],
    className,
  );

  return <section className={classes}>{children}</section>;
};
