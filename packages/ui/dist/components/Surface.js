import { jsx as _jsx } from "react/jsx-runtime";
import clsx from 'clsx';
const paddingMap = {
    none: 'p-0',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
};
export const Surface = ({ children, padding = 'md', elevation = 'flat', className, }) => {
    const classes = clsx('rounded-2xl border border-white/10 bg-slate-900/80 text-white shadow-lg backdrop-blur', elevation === 'raised' && 'shadow-xl shadow-slate-900/40', paddingMap[padding], className);
    return _jsx("section", { className: classes, children: children });
};
