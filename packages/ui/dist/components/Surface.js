import { jsx as _jsx } from "react/jsx-runtime";
import clsx from 'clsx';
const paddingMap = {
    none: 'p-0',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
};
export const Surface = ({ children, padding = 'md', elevation = 'flat', className, }) => {
    const classes = clsx('rounded-3xl bg-[#f4f4ef] text-stone-900', elevation === 'raised' && 'shadow-[0_12px_28px_rgba(0,0,0,0.08)]', paddingMap[padding], className);
    return _jsx("section", { className: classes, children: children });
};
