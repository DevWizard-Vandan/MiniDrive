import React from 'react';
import { HardDrive, Clock, Star, Trash2, UploadCloud, FolderPlus } from 'lucide-react';
import { formatBytes } from '../../utils/helpers'; // Make sure path is correct based on folder structure
import logo from '../../assets/logo.png'; // ✅ Logo Import

const Sidebar = ({
                     currentView,
                     setCurrentView,
                     setCurrentFolder,
                     setBreadcrumbs,
                     stats,
                     onUpload,
                     onCreateFolder
                 }) => {

    const navClass = (view) => `w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${currentView === view ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`;

    // Calculate Storage Percentage
    const quotaLimit = stats.count <= 1 ? (1024*1024*1024*1024) : (5*1024*1024*1024); // 1TB vs 5GB
    const quotaPercent = Math.min(100, (stats.used / quotaLimit) * 100);

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-20">
            <div className="p-6">
                {/* --- LOGO SECTION --- */}
                <div className="flex items-center gap-3 mb-8">
                    <img src={logo} alt="SanchayCloud" className="w-10 h-10 object-contain" />
                    <h1 className="text-xl font-bold tracking-tight text-indigo-900">SanchayCloud</h1>
                </div>

                {/* --- ACTION BUTTONS --- */}
                <button onClick={onUpload} className="w-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-4 active:scale-95 transition-all">
                    <UploadCloud size={20} /> Upload File
                </button>
                <button onClick={onCreateFolder} className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-6 active:scale-95 transition-all">
                    <FolderPlus size={20} /> New Folder
                </button>

                {/* --- NAVIGATION --- */}
                <nav className="space-y-1">
                    <button
                        onClick={() => {
                            setCurrentView('drive');
                            setCurrentFolder(null);
                            setBreadcrumbs([{id:null, name:'My Drive'}]);
                        }}
                        className={navClass('drive')}
                    >
                        <HardDrive size={18} /> My Drive
                    </button>
                    <button onClick={() => setCurrentView('recent')} className={navClass('recent')}><Clock size={18} /> Recent</button>
                    <button onClick={() => setCurrentView('starred')} className={navClass('starred')}><Star size={18} /> Starred</button>
                    <button onClick={() => setCurrentView('trash')} className={navClass('trash')}><Trash2 size={18} /> Trash</button>
                </nav>
            </div>

            {/* --- STORAGE METER --- */}
            <div className="mt-auto px-6 mb-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                        <span>Storage</span>
                        <span>{Math.round(quotaPercent)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-2">
                        <div
                            className={`h-full ${quotaPercent > 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${quotaPercent}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-400">
                        {formatBytes(stats.used || 0)} used of {stats.count <= 1 ? "1 TB" : "5 GB"}
                    </p>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;