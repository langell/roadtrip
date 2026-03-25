import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
type ButtonTone = 'primary' | 'ghost';
type ButtonProps = PropsWithChildren<{
    tone?: ButtonTone;
    loading?: boolean;
}> & ButtonHTMLAttributes<HTMLButtonElement>;
export declare const Button: ({ children, tone, loading, className, disabled, ...props }: ButtonProps) => import("react/jsx-runtime").JSX.Element;
export {};
