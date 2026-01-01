import React from 'react';
import { motion } from 'framer-motion';

/**
 * Neumorphic button with soft shadows and press animations.
 * Creates a tactile, modern interface feel.
 */
const NeumorphicButton = ({
    children,
    onClick,
    variant = 'default',
    size = 'md',
    icon,
    className = '',
    disabled = false
}) => {
    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2.5',
        lg: 'px-6 py-3 text-lg',
        xl: 'px-8 py-4 text-xl'
    };

    const variants = {
        default: {
            base: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
            shadow: 'shadow-[6px_6px_12px_#c5c5c5,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#1e293b,-6px_-6px_12px_#334155]',
            hover: 'hover:shadow-[4px_4px_8px_#c5c5c5,-4px_-4px_8px_#ffffff] dark:hover:shadow-[4px_4px_8px_#1e293b,-4px_-4px_8px_#334155]',
            pressed: 'shadow-[inset_4px_4px_8px_#c5c5c5,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#1e293b,inset_-4px_-4px_8px_#334155]'
        },
        primary: {
            base: 'bg-indigo-500 text-white',
            shadow: 'shadow-[6px_6px_12px_#4338ca,-6px_-6px_12px_#818cf8]',
            hover: 'hover:shadow-[4px_4px_8px_#4338ca,-4px_-4px_8px_#818cf8]',
            pressed: 'shadow-[inset_4px_4px_8px_#4338ca,inset_-4px_-4px_8px_#818cf8]'
        },
        success: {
            base: 'bg-emerald-500 text-white',
            shadow: 'shadow-[6px_6px_12px_#059669,-6px_-6px_12px_#34d399]',
            hover: 'hover:shadow-[4px_4px_8px_#059669,-4px_-4px_8px_#34d399]',
            pressed: 'shadow-[inset_4px_4px_8px_#059669,inset_-4px_-4px_8px_#34d399]'
        },
        danger: {
            base: 'bg-red-500 text-white',
            shadow: 'shadow-[6px_6px_12px_#dc2626,-6px_-6px_12px_#f87171]',
            hover: 'hover:shadow-[4px_4px_8px_#dc2626,-4px_-4px_8px_#f87171]',
            pressed: 'shadow-[inset_4px_4px_8px_#dc2626,inset_-4px_-4px_8px_#f87171]'
        }
    };

    const v = variants[variant] || variants.default;

    return (
        <motion.button
            onClick={onClick}
            disabled={disabled}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
                ${sizes[size]}
                ${v.base}
                ${v.shadow}
                ${v.hover}
                active:${v.pressed}
                rounded-xl font-medium
                transition-all duration-200
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}
            `}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
        </motion.button>
    );
};

/**
 * Neumorphic input field with inset shadow.
 */
export const NeumorphicInput = ({
    placeholder,
    value,
    onChange,
    type = 'text',
    icon,
    className = ''
}) => (
    <div className={`relative ${className}`}>
        {icon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                {icon}
            </span>
        )}
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`
                w-full ${icon ? 'pl-12' : 'pl-4'} pr-4 py-3
                bg-slate-100 dark:bg-slate-800
                text-slate-700 dark:text-slate-200
                rounded-xl border-none outline-none
                shadow-[inset_4px_4px_8px_#d1d5db,inset_-4px_-4px_8px_#ffffff]
                dark:shadow-[inset_4px_4px_8px_#1e293b,inset_-4px_-4px_8px_#334155]
                focus:shadow-[inset_6px_6px_12px_#d1d5db,inset_-6px_-6px_12px_#ffffff]
                dark:focus:shadow-[inset_6px_6px_12px_#1e293b,inset_-6px_-6px_12px_#334155]
                transition-shadow duration-200
                placeholder:text-slate-400
            `}
        />
    </div>
);

/**
 * Neumorphic toggle switch.
 */
export const NeumorphicToggle = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-3 cursor-pointer">
        <motion.div
            onClick={() => onChange(!checked)}
            className={`
                relative w-14 h-8 rounded-full
                ${checked ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}
                shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]
                transition-colors duration-200
            `}
        >
            <motion.div
                animate={{ x: checked ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`
                    absolute top-1 left-1 w-6 h-6 rounded-full
                    bg-white shadow-md
                `}
            />
        </motion.div>
        {label && <span className="text-slate-700 dark:text-slate-200">{label}</span>}
    </label>
);

export default NeumorphicButton;
