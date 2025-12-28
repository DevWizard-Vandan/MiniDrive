import React from 'react';
import { motion } from 'framer-motion';
import { formatBytes } from '../../utils/helpers';

const StorageMeter = ({ used, total = 5 * 1024 * 1024 * 1024 }) => { // Default 5GB
    const percentage = Math.min(100, (used / total) * 100);

    return (
        <div className="mt-auto p-4 bg-white/30 rounded-xl border border-white/20 backdrop-blur-sm">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                <span>Storage</span>
                <span>{Math.round(percentage)}%</span>
            </div>

            {/* Meter Background */}
            <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden mb-2">
                {/* Animated Fill */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${percentage > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                />
            </div>

            <p className="text-xs text-slate-500 font-medium">
                {formatBytes(used)} used of {formatBytes(total)}
            </p>
        </div>
    );
};

export default StorageMeter;