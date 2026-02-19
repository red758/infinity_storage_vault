
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StoredFile, FileType, StorageStats, VaultBackup, VaultProfile } from './types.ts';
import { 
  saveFile, 
  deleteFile, 
  requestPersistence, 
  checkPersistence,
  getVaultProfiles,
  saveVaultProfile,
  getFilesByVault,
  exportFullBackup,
  importFullBackup,
  deleteVaultProfile,
  updateFile
} from './services/storageService.ts';
import { encryptFile, decryptFile } from './services/cryptoService.ts';
import { 
  FolderIcon, 
  PhotoIcon, 
  VideoCameraIcon, 
  DocumentIcon, 
  CloudArrowUpIcon, 
  TrashIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  CameraIcon,
  XMarkIcon,
  InformationCircleIcon,
  CpuChipIcon,
  PlayIcon,
  CircleStackIcon,
  CheckBadgeIcon,
  LockClosedIcon,
  ArrowDownOnSquareIcon,
  ArrowUpOnSquareIcon,
  ArrowsPointingOutIcon,
  DevicePhoneMobileIcon,
  ArrowDownCircleIcon,
  EllipsisVerticalIcon,
  ShareIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

const AVATAR_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-purple-500', 'bg-sky-500'];

const InfinityLogo = ({ className = "w-12 h-12", color = "currentColor" }: { className?: string, color?: string }) => (
  <svg className={className} viewBox="0 0 320 400" fill={color}>
    <path d="M160 20 L270 380 L220 380 L160 160 L100 380 L50 380 L160 20 Z" />
    <path d="M 30 140 C 120 120, 180 140, 240 180 C 300 220, 320 280, 280 340 C 240 400, 180 360, 190 320 C 200 280, 260 260, 280 180 C 300 100, 150 80, 30 140 Z" />
  </svg>
);

export default function App() {
  const [activeProfile, setActiveProfile] = useState<VaultProfile | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [filter, setFilter] = useState<FileType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [vaultPin, setVaultPin] = useState('');
  const [loginName, setLoginName] = useState('');
  const [pinEntry, setPinEntry] = useState('');
  const [error, setError] = useState('');
  const [isPersistent, setIsPersistent] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [quota, setQuota] = useState<{used: number, total: number}>({used: 0, total: 0});
  const [showCamera, setShowCamera] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [fileToRename, setFileToRename] = useState<StoredFile | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isIOS = useMemo(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  useEffect(() => {
    updateQuota();
    checkPersistence().then(setIsPersistent);
    
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      setIsProcessing(true);
      setTimeout(async () => {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
        setIsProcessing(false);
      }, 800);
    } else {
      setShowInstallModal(true);
    }
  };

  const handleLockVault = () => {
    setActiveProfile(null);
    setIsUnlocked(false);
    setVaultPin('');
    setPinEntry('');
    setLoginName('');
    setFiles([]);
    window.scrollTo(0, 0);
  };

  const updateQuota = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      setQuota({
        used: estimate.usage || 0,
        total: estimate.quota || 0
      });
    }
  };

  const loadFiles = async () => {
    if (!activeProfile) return;
    const stored = await getFilesByVault(activeProfile.id);
    setFiles(stored);
    await updateQuota();
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const backup = await exportFullBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `infinity_vault_${new Date().toISOString().split('T')[0]}.vault`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setIsProcessing(true);
    try {
      const file = e.target.files[0];
      const text = await file.text();
      const backup: VaultBackup = JSON.parse(text);
      await importFullBackup(backup);
      alert('Import successful.');
      if (isUnlocked) await loadFiles();
    } catch (err) {
      alert('Import failed. Invalid format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredAndSortedFiles = useMemo(() => {
    return files
      .filter(f => (filter === 'all' || f.type === filter))
      .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (b.createdAt !== a.createdAt) {
          return b.createdAt - a.createdAt;
        }
        return a.name.localeCompare(b.name);
      });
  }, [files, filter, searchQuery]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);
    try {
      const profiles = await getVaultProfiles();
      const matchingProfiles = profiles.filter(p => p.name.toLowerCase() === loginName.toLowerCase());
      if (matchingProfiles.length === 0) throw new Error('NotFound');
      let authenticatedProfile: VaultProfile | null = null;
      for (const profile of matchingProfiles) {
        try {
          const v = profile.verification;
          await decryptFile(v.encryptedData, pinEntry, v.iv, v.salt);
          authenticatedProfile = profile;
          break;
        } catch (err) { continue; }
      }
      if (!authenticatedProfile) throw new Error('InvalidPIN');
      await requestPersistence();
      setVaultPin(pinEntry);
      setActiveProfile(authenticatedProfile);
      setIsUnlocked(true);
      await loadFiles();
    } catch (err) {
      setError('Incorrect ID or PIN.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginName.length < 2 || pinEntry.length < 4) return;
    setIsProcessing(true);
    try {
      const checkData = new TextEncoder().encode("VERIFIED");
      const { encryptedData, iv, salt } = await encryptFile(checkData, pinEntry);
      const newProfile: VaultProfile = {
        id: crypto.randomUUID(),
        name: loginName,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        verification: { encryptedData, iv, salt },
        createdAt: Date.now()
      };
      await saveVaultProfile(newProfile);
      setVaultPin(pinEntry);
      setActiveProfile(newProfile);
      setIsUnlocked(true);
      setFiles([]);
    } catch (err) {
      setError('Initialization failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setShowCamera(false);
      alert("Please allow camera access.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !activeProfile) return;
    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) return;
      const { encryptedData, iv, salt, compressedSize } = await encryptFile(await blob.arrayBuffer(), vaultPin);
      await saveFile({
        id: crypto.randomUUID(),
        vaultId: activeProfile.id,
        name: `INFINITY_SNAP_${Date.now()}.jpg`,
        type: 'image',
        mimeType: 'image/jpeg',
        size: blob.size,
        compressedSize,
        encryptedData,
        iv,
        salt,
        createdAt: Date.now()
      });
      stopCamera();
      await loadFiles();
    } catch (e) {
      alert("Storage error during capture.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeProfile) return;
    setIsProcessing(true);
    try {
      const uploadList = Array.from(e.target.files) as File[];
      for (const file of uploadList) {
        const { encryptedData, iv, salt, compressedSize } = await encryptFile(await file.arrayBuffer(), vaultPin);
        let type: FileType = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.includes('pdf')) type = 'document';
        await saveFile({
          id: crypto.randomUUID(),
          vaultId: activeProfile.id,
          name: file.name,
          type,
          mimeType: file.type,
          size: file.size,
          compressedSize,
          encryptedData,
          iv,
          salt,
          createdAt: Date.now()
        });
      }
      await loadFiles();
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    const id = fileToDelete;
    setIsProcessing(true);
    try {
      await deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      await updateQuota();
      setFileToDelete(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!fileToRename) return;
    setIsProcessing(true);
    try {
      const updated = { ...fileToRename, name: newName };
      await updateFile(updated);
      setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
      setFileToRename(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (file: StoredFile) => {
    setIsProcessing(true);
    try {
      const decrypted = await decryptFile(file.encryptedData, vaultPin, file.iv, file.salt);
      const url = URL.createObjectURL(new Blob([decrypted], { type: file.mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!confirm(`Restore all ${files.length} items?`)) return;
    setIsProcessing(true);
    try {
      for (const file of files) {
        const decrypted = await decryptFile(file.encryptedData, vaultPin, file.iv, file.salt);
        const url = URL.createObjectURL(new Blob([decrypted], { type: file.mimeType }));
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 800));
      }
      alert("All files restored.");
    } finally {
      setIsProcessing(false);
    }
  };

  const stats = useMemo<StorageStats>(() => {
    const originalSize = files.reduce((acc, f) => acc + f.size, 0);
    const compressedSize = files.reduce((acc, f) => acc + f.compressedSize, 0);
    return {
      used: compressedSize,
      total: quota.total,
      saved: Math.max(0, originalSize - compressedSize),
      imageCount: files.filter(f => f.type === 'image').length,
      videoCount: files.filter(f => f.type === 'video').length,
      docCount: files.filter(f => f.type === 'document').length
    };
  }, [files, quota]);

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start sm:justify-center p-6 text-white font-sans overflow-y-auto">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative my-auto">
          <div className="flex justify-center mb-6">
            <InfinityLogo className="w-20 h-20 text-indigo-400" />
          </div>
          <h1 className="text-5xl font-brand font-black text-center mb-1 tracking-tight text-white">infinity</h1>
          <p className="text-slate-500 text-center mb-10 text-[11px] font-black uppercase tracking-[0.2em] opacity-80">secure vault</p>
          <form onSubmit={authMode === 'login' ? handleLogin : handleCreateProfile} className="space-y-4">
            <input type="text" placeholder="Vault ID" className="w-full bg-slate-800 border-none rounded-2xl py-5 px-6 text-white font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none" value={loginName} onChange={(e) => setLoginName(e.target.value)} required />
            <input type="password" placeholder="PIN" maxLength={8} className="w-full bg-slate-800 border-none rounded-2xl py-5 text-center text-4xl tracking-[0.5em] font-black focus:ring-2 focus:ring-indigo-500 outline-none" value={pinEntry} onChange={(e) => setPinEntry(e.target.value)} required />
            {error && <div className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 p-4 rounded-2xl">{error}</div>}
            <button disabled={isProcessing} className="w-full bg-indigo-600 py-5 rounded-2xl font-black flex justify-center items-center gap-3 uppercase text-xs tracking-widest hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 active:scale-95">
              {isProcessing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Open Safe' : 'Register Profile')}
            </button>
          </form>
          <div className="mt-8 flex flex-col gap-4 text-center">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
              {authMode === 'login' ? 'Create New Profile' : 'Back to Login'}
            </button>
            <label className="text-indigo-400 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:underline opacity-80">
              Restore from Backup
              <input type="file" onChange={handleImport} className="hidden" accept=".vault" />
            </label>
          </div>
        </div>
        <div className="mt-8 mb-8 w-full max-w-sm">
           <button onClick={handleInstallApp} className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all text-white group">
              <div className="flex items-center gap-4">
                 <DevicePhoneMobileIcon className="w-6 h-6 text-indigo-400" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Install as App</span>
              </div>
              <ArrowDownTrayIcon className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
           </button>
        </div>
        {showInstallModal && <InstallInstructionModal isIOS={isIOS} onClose={() => setShowInstallModal(false)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <aside className="w-80 bg-white border-r border-slate-200 hidden lg:flex flex-col shadow-sm">
        <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-4 mb-12">
            <div className="bg-slate-900 p-2 rounded-xl">
              <InfinityLogo className="w-10 h-10 text-white" />
            </div>
            <div>
              <div className="text-3xl font-brand font-black tracking-tight leading-none">infinity</div>
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">secure vault</div>
            </div>
          </div>
          <nav className="space-y-2 mb-10">
            <SidebarItem icon={<FolderIcon />} label="All Safe Files" active={filter === 'all'} onClick={() => setFilter('all')} />
            <SidebarItem icon={<PhotoIcon />} label="Gallery" active={filter === 'image'} onClick={() => setFilter('image')} />
            <SidebarItem icon={<VideoCameraIcon />} label="Recordings" active={filter === 'video'} onClick={() => setFilter('video')} />
            <SidebarItem icon={<DocumentIcon />} label="Documents" active={filter === 'document'} onClick={() => setFilter('document')} />
          </nav>

          <div className="space-y-4">
             {/* Storage Card: Sidebar only */}
             <div className="bg-slate-900 text-white p-7 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity"><CircleStackIcon className="w-12 h-12" /></div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Local Capacity</div>
                <div className="text-3xl font-black mb-4">{formatSize(stats.used)}</div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-3">
                  <div className="bg-emerald-400 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (quota.used / (quota.total || 1)) * 100)}%` }}></div>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-bold text-slate-500">{Math.round((quota.used / (quota.total || 1)) * 100)}% Used</span>
                   <button onClick={() => setShowInfo(true)} className="text-slate-400 hover:text-white transition-colors"><InformationCircleIcon className="w-5 h-5" /></button>
                </div>
             </div>

             <button onClick={handleInstallApp} className="w-full flex items-center justify-between p-5 bg-indigo-50 border border-indigo-100 rounded-3xl hover:bg-indigo-100 transition-all text-indigo-600 shadow-sm">
                <div className="flex items-center gap-3">
                   <DevicePhoneMobileIcon className="w-5 h-5" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Shortcut Guide</span>
                </div>
                <ArrowDownTrayIcon className="w-4 h-4" />
             </button>

             <button onClick={() => setShowMaintenance(true)} className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:bg-slate-50 transition-all text-slate-600 shadow-sm">
                <div className="flex items-center gap-3">
                   <CpuChipIcon className="w-6 h-6 text-indigo-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Vault Settings</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             </button>
          </div>
        </div>
        <div className="p-8 border-t border-slate-100 flex flex-col gap-3">
           <button onClick={handleLockVault} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-colors">Lock Down</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative overflow-hidden">
        <header className="header-safe h-auto min-h-[5rem] px-6 lg:px-12 py-4 flex items-center justify-between border-b border-slate-200 bg-white sticky top-0 z-40 gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
             <div className="bg-slate-900 p-2 rounded-xl lg:hidden"><InfinityLogo className="w-8 h-8 text-white" /></div>
             <div className="hidden sm:block">
                <h2 className="font-brand font-black text-3xl tracking-tight">infinity</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">secure vault</p>
             </div>
          </div>

          <div className="flex-1 max-w-md relative group">
             <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
             <input 
                type="text" 
                placeholder="Search safe..." 
                className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {isProcessing && <ArrowPathIcon className="w-6 h-6 animate-spin text-indigo-600" />}
            <button onClick={startCamera} title="Camera Snap" className="p-3 bg-slate-100 rounded-2xl transition-all hover:bg-slate-200 active:scale-95"><CameraIcon className="w-6 h-6 text-slate-600" /></button>
            <label title="Upload Files" className="bg-indigo-600 text-white font-black p-3 lg:px-6 lg:py-4 rounded-2xl cursor-pointer shadow-xl shadow-indigo-600/20 flex items-center gap-3 text-sm hover:bg-indigo-700 transition-all active:scale-95">
              <CloudArrowUpIcon className="w-6 h-6" /> <span className="hidden lg:inline">Add</span>
              <input type="file" multiple onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-12 scrollbar-hide pb-32">
          {filteredAndSortedFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <div className="p-10 bg-white rounded-[4rem] border border-slate-100 shadow-sm flex flex-col items-center max-w-xs text-center">
                 <InfinityLogo className="w-24 h-24 mb-6 opacity-10" />
                 <p className="font-brand font-black uppercase tracking-widest text-[14px] opacity-40 leading-relaxed text-center">
                    {searchQuery ? 'No results found.' : 'Your safe is empty.'}
                 </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
              {filteredAndSortedFiles.map(file => (
                <FileCard 
                  key={file.id} 
                  file={file} 
                  vaultPin={vaultPin} 
                  onDelete={() => setFileToDelete(file.id)} 
                  onDownload={() => handleDownload(file)} 
                  onPreview={() => setPreviewFile(file)} 
                  onRename={() => setFileToRename(file)}
                  isProcessing={isProcessing} 
                />
              ))}
            </div>
          )}
        </div>

        <nav className="mobile-nav lg:hidden fixed bottom-0 inset-x-0 h-20 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around px-6 z-40">
            <MobileNavItem icon={<FolderIcon />} active={filter === 'all'} onClick={() => setFilter('all')} />
            <MobileNavItem icon={<PhotoIcon />} active={filter === 'image'} onClick={() => setFilter('image')} />
            <MobileNavItem icon={<VideoCameraIcon />} active={filter === 'video'} onClick={() => setFilter('video')} />
            <MobileNavItem icon={<CpuChipIcon />} active={showMaintenance} onClick={() => setShowMaintenance(true)} />
            <MobileNavItem icon={<LockClosedIcon />} active={false} onClick={handleLockVault} />
        </nav>
      </main>

      {showInfo && <InfoModal stats={stats} onClose={() => setShowInfo(false)} />}
      {showMaintenance && <MaintenanceModal files={files} handleDownloadAll={handleDownloadAll} handleInstallApp={handleInstallApp} handleExport={handleExport} handleImport={handleImport} deleteVaultProfile={deleteVaultProfile} activeProfile={activeProfile} handleLockVault={handleLockVault} onClose={() => setShowMaintenance(false)} isProcessing={isProcessing} setIsProcessing={setIsProcessing} />}
      {previewFile && <PreviewModal file={previewFile} vaultPin={vaultPin} onClose={() => setPreviewFile(null)} onDownload={() => handleDownload(previewFile)} />}
      {showCamera && <CameraLens videoRef={videoRef} onCapture={capturePhoto} isProcessing={isProcessing} onClose={stopCamera} />}
      {fileToDelete && <DeleteConfirmModal onClose={() => setFileToDelete(null)} onConfirm={confirmDeleteFile} />}
      {fileToRename && <RenameModal file={fileToRename} onClose={() => setFileToRename(null)} onConfirm={handleRename} />}
      {showInstallModal && <InstallInstructionModal isIOS={isIOS} onClose={() => setShowInstallModal(false)} />}
    </div>
  );
}

function CameraLens({ videoRef, onCapture, isProcessing, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-slate-950 z-[500] flex flex-col items-center justify-center animate-in fade-in duration-300">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-10 pb-12">
        <button onClick={onClose} className="p-5 bg-white/10 text-white rounded-full backdrop-blur-xl border border-white/20 active:scale-95 transition-all"><XMarkIcon className="w-8 h-8" /></button>
        <button onClick={onCapture} disabled={isProcessing} className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-8 border-slate-200">
          {isProcessing ? <ArrowPathIcon className="w-10 h-10 text-indigo-600 animate-spin" /> : <div className="w-16 h-16 rounded-full border-4 border-slate-900" />}
        </button>
        <div className="w-16" />
      </div>
    </div>
  );
}

function FileCard({ file, vaultPin, onDelete, onDownload, onPreview, onRename, isProcessing }: any) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (file.type === 'image') {
      decryptFile(file.encryptedData, vaultPin, file.iv, file.salt).then(decrypted => {
        url = URL.createObjectURL(new Blob([decrypted], { type: file.mimeType }));
        setThumbnailUrl(url);
      });
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file.id, vaultPin]);

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  const savedPercent = Math.round(((file.size - file.compressedSize) / (file.size || 1)) * 100);

  return (
    <div className={`group bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
      <div onClick={onPreview} className="aspect-[5/4] bg-slate-100 relative flex items-center justify-center overflow-hidden cursor-pointer group/card">
        {file.type === 'image' && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover transition-transform duration-1000 lg:group-hover/card:scale-110" />
        ) : file.type === 'video' ? (
          <div className="relative w-full h-full flex items-center justify-center bg-indigo-50">
             <VideoCameraIcon className="w-16 h-16 text-indigo-200" />
             <PlayIcon className="w-12 h-12 text-white absolute fill-indigo-600 drop-shadow-xl" />
          </div>
        ) : (
          <div className="bg-slate-50 w-full h-full flex items-center justify-center text-slate-300">
             <DocumentIcon className="w-16 h-16" />
          </div>
        )}
        <div className="absolute inset-0 bg-slate-950/70 opacity-0 lg:group-hover/card:opacity-100 transition-opacity hidden lg:flex items-center justify-center gap-3 backdrop-blur-sm pointer-events-auto">
          <button onClick={(e) => { e.stopPropagation(); onPreview(); }} className="p-3 bg-white rounded-2xl text-slate-900 hover:scale-110 active:scale-95 transition-transform"><ArrowsPointingOutIcon className="w-5 h-5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="p-3 bg-white rounded-2xl text-slate-900 hover:scale-110 active:scale-95 transition-transform"><PencilSquareIcon className="w-5 h-5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="p-3 bg-emerald-500 rounded-2xl text-white hover:scale-110 active:scale-95 transition-transform"><ArrowDownTrayIcon className="w-5 h-5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-3 bg-rose-500 rounded-2xl text-white hover:scale-110 active:scale-95 transition-transform"><TrashIcon className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-sm font-black text-slate-800 truncate mb-1 lg:group-hover/card:text-indigo-600 transition-colors">{file.name}</h3>
        
        <div className="flex flex-col gap-1 mb-4">
           <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>{file.type}</span>
              <span className="text-slate-500 line-through opacity-40 font-black">{formatSize(file.size)}</span>
           </div>
           <div className="flex justify-between items-center mt-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-black uppercase tracking-widest">
                 <CalendarDaysIcon className="w-3 h-3 text-slate-200" />
                 <span>{formatDate(file.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded-full">
                 <BoltIcon className="w-3 h-3" />
                 <span>{formatSize(file.compressedSize)} ({savedPercent}% saved)</span>
              </div>
           </div>
        </div>

        <div className="mt-auto flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all hover:bg-emerald-700">
               <ArrowDownTrayIcon className="w-4 h-4" /> Restore
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="lg:hidden p-3 bg-slate-100 text-slate-600 rounded-2xl active:scale-95 transition-all"><PencilSquareIcon className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="lg:hidden p-3 bg-rose-50 text-rose-500 rounded-2xl active:scale-95 transition-all"><TrashIcon className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function MobileNavItem({ icon, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl transition-all active:scale-90 ${active ? 'text-indigo-600 bg-indigo-50 shadow-sm' : 'text-slate-400'}`}>
      {React.cloneElement(icon, { className: "w-6 h-6" })}
    </button>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl text-[14px] font-bold transition-all ${active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
      {React.cloneElement(icon, { className: "w-6 h-6 flex-shrink-0" })}
      <span className="tracking-tight">{label}</span>
    </button>
  );
}

function ModalWrapper({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-slate-950/90 z-[500] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative text-slate-900 border-t-8 border-indigo-600 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"><XMarkIcon className="w-7 h-7" /></button>
                {children}
            </div>
        </div>
    );
}

function InfoModal({ stats, onClose }: any) {
    return (
        <ModalWrapper onClose={onClose}>
            <div className="text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-8 mx-auto"><CheckBadgeIcon className="w-10 h-10 text-emerald-600" /></div>
                <h2 className="text-4xl font-brand font-black mb-6 tracking-tight">vault stats</h2>
                <div className="bg-slate-50 p-6 rounded-[2rem] mb-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Space Saved</p>
                    <p className="text-4xl font-black text-emerald-600">{formatSize(stats.saved)}</p>
                </div>
                <button onClick={onClose} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Understood</button>
            </div>
        </ModalWrapper>
    );
}

function MaintenanceModal({ files, handleDownloadAll, handleInstallApp, handleExport, handleImport, deleteVaultProfile, activeProfile, handleLockVault, onClose, isProcessing, setIsProcessing }: any) {
    const handleWipe = async () => {
        if(confirm('⚠️ Permanent wipe: proceed?')) {
            setIsProcessing(true);
            try { await deleteVaultProfile(activeProfile!.id); handleLockVault(); } catch(e) { alert('Error.'); } finally { setIsProcessing(false); }
        }
    };
    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in zoom-in-95 duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl relative text-slate-900 max-h-[90vh] overflow-y-auto scrollbar-hide">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900"><XMarkIcon className="w-7 h-7" /></button>
                <h2 className="text-4xl font-brand font-black mb-8 tracking-tight">vault control</h2>
                <div className="space-y-4">
                    <button onClick={handleDownloadAll} disabled={files.length === 0 || isProcessing} className="w-full flex items-center justify-between p-7 bg-emerald-600 text-white rounded-[2rem] shadow-xl active:scale-95 transition-all">
                       <div className="flex items-center gap-5">
                          <ArrowDownCircleIcon className="w-8 h-8" />
                          <div className="text-left"><p className="text-sm font-black font-brand">Restore Everything</p></div>
                       </div>
                       <span className="font-brand font-black text-2xl">{files.length}</span>
                    </button>
                    
                    <button onClick={handleInstallApp} className="w-full flex items-center justify-between p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] hover:bg-indigo-100 transition-all text-indigo-600 shadow-sm active:scale-95">
                        <div className="flex items-center gap-5">
                            <DevicePhoneMobileIcon className="w-8 h-8" />
                            <p className="text-sm font-black font-brand">Shortcut Guide</p>
                        </div>
                        <ArrowDownTrayIcon className="w-6 h-6" />
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleExport} className="flex flex-col items-center gap-2 p-6 bg-slate-100 rounded-[2rem] hover:bg-slate-200 active:scale-95 transition-all">
                            <ArrowUpOnSquareIcon className="w-8 h-8 text-indigo-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Backup</span>
                        </button>
                        <label className="flex flex-col items-center gap-2 p-6 bg-slate-100 rounded-[2rem] hover:bg-slate-200 active:scale-95 cursor-pointer transition-all">
                            <ArrowDownOnSquareIcon className="w-8 h-8 text-indigo-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Restore</span>
                            <input type="file" onChange={handleImport} className="hidden" accept=".vault" />
                        </label>
                    </div>

                    <button onClick={handleWipe} className="w-full flex items-center gap-3 justify-center text-rose-500 font-black uppercase text-[10px] tracking-widest pt-6 border-t mt-4 active:scale-95 transition-all">
                        <TrashIcon className="w-4 h-4" /> Permanent Reset
                    </button>
                </div>
                <button onClick={onClose} className="w-full mt-10 bg-slate-950 text-white py-5 rounded-2xl font-black uppercase text-xs font-brand active:scale-95">Close Settings</button>
            </div>
        </div>
    );
}

function PreviewModal({ file, vaultPin, onClose, onDownload }: any) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(true);

  useEffect(() => {
    let url: string | null = null;
    decryptFile(file.encryptedData, vaultPin, file.iv, file.salt)
      .then(decrypted => {
        url = URL.createObjectURL(new Blob([decrypted], { type: file.mimeType }));
        setDataUrl(url);
      })
      .finally(() => setIsDecrypting(false));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file.id, vaultPin]);

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[500] flex flex-col items-center justify-center p-6 sm:p-10 animate-in fade-in duration-300 backdrop-blur-xl">
      <div className="w-full h-full max-w-7xl flex flex-col bg-slate-900/40 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="px-8 py-6 flex justify-between items-center bg-slate-900/80 border-b border-white/5 z-20">
            <h2 className="text-sm font-black text-white truncate max-w-[50%]">{file.name}</h2>
            <div className="flex gap-3">
              <button onClick={onDownload} className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-xl">Restore</button>
              <button onClick={onClose} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 active:scale-95"><XMarkIcon className="w-7 h-7" /></button>
            </div>
        </div>
        <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden text-white">
            {isDecrypting ? (
                <div className="flex flex-col items-center gap-6">
                   <ArrowPathIcon className="w-12 h-12 text-indigo-500 animate-spin" />
                   <p className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500">Unlocking Safe...</p>
                </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {file.type === 'image' && dataUrl && <img src={dataUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />}
                {file.type === 'video' && dataUrl && <video src={dataUrl} controls autoPlay className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />}
                {(file.type === 'document' || file.type === 'other') && (
                  <div className="text-center p-12 bg-slate-900/80 rounded-[3rem] border border-white/5 max-w-sm text-white shadow-2xl">
                    <DocumentIcon className="w-20 h-20 text-indigo-400 mx-auto mb-6" />
                    <button onClick={onDownload} className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95">Download to View</button>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ onClose, onConfirm }: any) {
  return (
    <ModalWrapper onClose={onClose}>
       <div className="text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8 mx-auto"><ExclamationTriangleIcon className="w-10 h-10 text-rose-600" /></div>
          <h2 className="text-2xl font-brand font-black mb-4 tracking-tight">Delete Forever?</h2>
          <p className="text-slate-500 text-sm mb-10 leading-relaxed font-bold">This file will be completely wiped from your secure safe storage.</p>
          <div className="grid grid-cols-2 gap-4">
             <button onClick={onClose} className="bg-slate-100 text-slate-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95">Cancel</button>
             <button onClick={onConfirm} className="bg-rose-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95">Delete</button>
          </div>
       </div>
    </ModalWrapper>
  );
}

function RenameModal({ file, onClose, onConfirm }: any) {
    const [name, setName] = useState(file.name);
    return (
        <ModalWrapper onClose={onClose}>
           <div className="text-center">
              <h2 className="text-2xl font-brand font-black mb-6 tracking-tight">Rename Item</h2>
              <input type="text" autoFocus className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none mb-8" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={onClose} className="bg-slate-100 text-slate-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95">Cancel</button>
                 <button onClick={() => onConfirm(name)} className="bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95">Save</button>
              </div>
           </div>
        </ModalWrapper>
    );
}

function InstallInstructionModal({ isIOS, onClose }: { isIOS: boolean, onClose: () => void }) {
  return (
    <ModalWrapper onClose={onClose}>
        <div className="text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-8 mx-auto"><DevicePhoneMobileIcon className="w-10 h-10 text-indigo-600" /></div>
            <h2 className="text-3xl font-brand font-black mb-4 tracking-tight">Install Infinity</h2>
            <p className="text-slate-500 text-sm mb-10 font-bold leading-relaxed">Pin to home screen to use it as your default device storage.</p>
            <div className="space-y-8 text-left">
               <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black flex-shrink-0 font-brand">1</div>
                  <p className="text-xs text-slate-600 mt-2 font-bold leading-tight">Tap the <ShareIcon className="w-4 h-4 inline text-indigo-600 mx-1" /> icon in Safari/Chrome toolbar.</p>
               </div>
               <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black flex-shrink-0 font-brand">2</div>
                  <p className="text-xs text-slate-600 mt-2 font-bold leading-tight">Choose <span className="text-indigo-600">"Add to Home Screen"</span> from the list.</p>
               </div>
            </div>
            <button onClick={onClose} className="w-full mt-10 bg-slate-950 text-white py-5 rounded-2xl font-black uppercase text-xs font-brand active:scale-95 transition-all">Got it</button>
        </div>
    </ModalWrapper>
  );
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
};
