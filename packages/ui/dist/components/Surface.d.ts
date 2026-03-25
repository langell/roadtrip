import type { PropsWithChildren } from 'react';
type SurfaceProps = PropsWithChildren<{
    padding?: 'none' | 'sm' | 'md' | 'lg';
    elevation?: 'flat' | 'raised';
    className?: string;
}>;
export declare const Surface: ({ children, padding, elevation, className }: SurfaceProps) => import("react/jsx-runtime").JSX.Element;
export {};
