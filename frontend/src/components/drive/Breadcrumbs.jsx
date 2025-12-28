import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs = ({ breadcrumbs, onNavigate }) => {
    return (
        <div className="px-8 py-2 flex items-center gap-2 text-sm relative z-10">
            {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center">
                    <button
                        onClick={() => onNavigate(idx)}
                        className={`
                            flex items-center gap-1 transition-all px-2 py-1 rounded-lg
                            ${idx === breadcrumbs.length - 1
                            ? 'font-bold text-slate-800 bg-white/50 shadow-sm border border-white/20'
                            : 'text-slate-500 hover:bg-white/40 hover:text-indigo-600'
                        }
                        `}
                    >
                        {idx === 0 && <Home size={14} />}
                        {crumb.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && (
                        <ChevronRight size={14} className="text-slate-300 mx-1" />
                    )}
                </div>
            ))}
        </div>
    );
};

export default Breadcrumbs;