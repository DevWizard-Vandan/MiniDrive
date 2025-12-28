import React from 'react';
import { UploadCloud, FolderPlus, HardDrive, Clock, Star, Trash2 } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import StorageMeter from './StorageMeter';

const Sidebar = ({
                     currentView, setCurrentView,
                     setCurrentFolder, setBreadcrumbs,
                     stats, onUpload, onCreateFolder
                 }) => {

    const NavItem = ({ view, icon: Icon, label, onClick }) => (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300
                ${currentView === view
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-600 hover:bg-white/50 hover:text-indigo-600'
            }
            `}
        >
            <Icon size={20} />
            <span>{label}</span>
        </button>
    );

    return (
        <aside className="w-72 p-4 hidden md:flex flex-col h-full z-20">
            <GlassCard className="h-full flex flex-col p-6 !bg-white/60">
                {/* Brand */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                        <HardDrive size={20} />
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-purple-600 bg-clip-text text-transparent">
                        SanchayCloud
                    </h1>
                </div>

                {/* Main Actions */}
                <button onClick={onUpload} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-3 transition-all hover:-translate-y-0.5 active:scale-95">
                    <UploadCloud size={20} /> Upload File
                </button>
                <button onClick={onCreateFolder} className="w-full bg-white/50 border border-indigo-100 text-indigo-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-8 hover:bg-white transition-all active:scale-95">
                    <FolderPlus size={20} /> New Folder
                </button>

                {/* Navigation Links */}
                <nav className="space-y-2 flex-1">
                    <NavItem
                        view="drive" icon={HardDrive} label="My Drive"
                        onClick={() => { setCurrentView('drive'); setCurrentFolder(null); setBreadcrumbs([{id:null, name:'My Drive'}]); }}
                    />
                    <NavItem view="recent" icon={Clock} label="Recent" onClick={() => setCurrentView('recent')} />
                    <NavItem view="starred" icon={Star} label="Starred" onClick={() => setCurrentView('starred')} />
                    <NavItem view="trash" icon={Trash2} label="Trash" onClick={() => setCurrentView('trash')} />
                </nav>

                {/* Storage Meter */}
                <StorageMeter used={stats.used} total={stats.count <= 1 ? (1024**4) : (5 * 1024**3)} />
            </GlassCard>
        </aside>
    );
};

export default Sidebar;