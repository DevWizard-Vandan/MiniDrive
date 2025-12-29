import React from 'react';
import { Search, ChevronDown, Grid, List as ListIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Header = ({
                    searchQuery, setSearchQuery,
                    sortBy, setSortBy,
                    viewMode, setViewMode
                }) => {

    const { logout, getAvatar } = useAuth();

    return (
        <header className="h-20 px-8 flex items-center justify-between z-20 relative">
            <div className="flex-1 max-w-2xl mr-8">
                <div className="relative group">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        className="w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-all outline-none shadow-sm hover:shadow-md"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative group z-30">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur rounded-xl text-sm font-semibold text-slate-600 hover:bg-white/80 transition-all border border-white/20">
                        Sort: <span className="text-indigo-600 capitalize">{sortBy}</span> <ChevronDown size={16} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100">
                        {['date', 'name', 'size'].map(opt => (
                            <button key={opt} onClick={() => setSortBy(opt)} className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-indigo-50 first:rounded-t-xl last:rounded-b-xl capitalize font-medium">
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white/50 backdrop-blur rounded-xl p-1 flex border border-white/20">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Grid size={18} />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                        <ListIcon size={18} />
                    </button>
                </div>

                <button
                    onClick={logout}
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30 hover:scale-105 transition-transform"
                >
                    {getAvatar()}
                </button>
            </div>
        </header>
    );
};

export default Header;