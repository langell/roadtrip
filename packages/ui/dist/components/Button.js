import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
const toneClasses = {
    primary: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 focus-visible:ring-emerald-300',
    ghost: 'bg-transparent text-white ring-1 ring-white/40 hover:bg-white/10'
};
export const Button = ({ children, tone = 'primary', loading = false, className, disabled, ...props }) => (_jsxs("button", { className: clsx('inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60', toneClasses[tone], className), disabled: disabled || loading, ...props, children: [loading && (_jsx("span", { className: "h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white", "aria-hidden": true })), _jsx("span", { children: children })] }));
