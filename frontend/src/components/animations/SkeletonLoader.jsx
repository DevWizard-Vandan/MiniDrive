import React from 'react';
import { motion } from 'framer-motion';

/**
 * Loading skeleton with shimmer effect.
 * Provides elegant loading placeholders for content.
 */

// File card skeleton
export const FileCardSkeleton = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
            {/* Icon placeholder */}
            <div className="w-10 h-10 rounded-lg shimmer dark:bg-slate-700" />

            <div className="flex-1 space-y-2">
                {/* Title */}
                <div className="h-4 w-3/4 rounded shimmer dark:bg-slate-700" />
                {/* Subtitle */}
                <div className="h-3 w-1/2 rounded shimmer dark:bg-slate-700" />
            </div>
        </div>
    </div>
);

// Grid skeleton (multiple file cards)
export const FileGridSkeleton = ({ count = 8 }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: count }).map((_, i) => (
            <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
            >
                <FileCardSkeleton />
            </motion.div>
        ))}
    </div>
);

// Sidebar skeleton
export const SidebarSkeleton = () => (
    <div className="space-y-4 p-4">
        {/* Logo */}
        <div className="h-8 w-32 rounded-lg shimmer dark:bg-slate-700 mb-6" />

        {/* Nav items */}
        {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-5 h-5 rounded shimmer dark:bg-slate-700" />
                <div className="h-4 w-20 rounded shimmer dark:bg-slate-700" />
            </div>
        ))}

        {/* Storage */}
        <div className="mt-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-900">
            <div className="h-3 w-16 rounded shimmer dark:bg-slate-700 mb-2" />
            <div className="h-2 w-full rounded-full shimmer dark:bg-slate-700" />
        </div>
    </div>
);

// Activity log skeleton
export const ActivitySkeleton = ({ count = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
            <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
            >
                <div className="w-8 h-8 rounded-full shimmer dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded shimmer dark:bg-slate-700" />
                    <div className="h-2 w-1/3 rounded shimmer dark:bg-slate-700" />
                </div>
            </motion.div>
        ))}
    </div>
);

// Generic text skeleton
export const TextSkeleton = ({ lines = 3, className = '' }) => (
    <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
            <div
                key={i}
                className="h-3 rounded shimmer dark:bg-slate-700"
                style={{ width: `${Math.random() * 40 + 60}%` }}
            />
        ))}
    </div>
);

// Full page loading skeleton
export const PageSkeleton = () => (
    <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-700">
            <SidebarSkeleton />
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="h-8 w-48 rounded-lg shimmer dark:bg-slate-700" />
                <div className="h-10 w-64 rounded-xl shimmer dark:bg-slate-700" />
            </div>

            {/* Grid */}
            <FileGridSkeleton count={12} />
        </div>
    </div>
);

export default {
    FileCardSkeleton,
    FileGridSkeleton,
    SidebarSkeleton,
    ActivitySkeleton,
    TextSkeleton,
    PageSkeleton
};
