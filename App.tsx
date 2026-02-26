
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  BoltIcon,
  CheckIcon,
  SquaresPlusIcon,
  Bars3Icon,
  ListBulletIcon,
  Squares2X2Icon,
  ClipboardIcon
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
  const [showHelp, setShowHelp] = useState(false);
  const [showSecurityNotice, setShowSecurityNotice] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isUnlocked) {
        handleLockVault();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked]);

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
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setShowMobileSidebar(false);
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

  const loadFiles = async (forceVaultId?: string) => {
    const id = forceVaultId || activeProfile?.id;
    if (!id) return;
    setIsProcessing(true);
    try {
      const stored = await getFilesByVault(id);
      setFiles([...stored]); // Fresh copy to trigger UI
      await updateQuota();
    } catch (err) {
      console.error("Failed to load files", err);
    } finally {
      setIsProcessing(false);
    }
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
      if (isUnlocked && activeProfile) await loadFiles(activeProfile.id);
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

  const groupedFiles = useMemo(() => {
    const groups: { [key: string]: StoredFile[] } = {};
    filteredAndSortedFiles.forEach(file => {
      const date = new Date(file.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let label = '';
      if (date.toDateString() === today.toDateString()) label = 'Today';
      else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else {
        label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(file);
    });
    return groups;
  }, [filteredAndSortedFiles]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);
    try {
      const profiles = await getVaultProfiles();
      const cleanName = loginName.trim().toLowerCase();
      const matchingProfiles = profiles.filter(p => p.name.toLowerCase() === cleanName);
      
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
      
      const persisted = await requestPersistence();
      setIsPersistent(persisted);

      setVaultPin(pinEntry);
      setActiveProfile(authenticatedProfile);
      setIsUnlocked(true);
      await loadFiles(authenticatedProfile.id);
    } catch (err) {
      setError('Incorrect ID or PIN.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginName.trim().length < 2 || pinEntry.length < 4) return;
    setIsProcessing(true);
    try {
      const checkData = new TextEncoder().encode("VERIFIED");
      const { encryptedData, iv, salt } = await encryptFile(checkData, pinEntry);
      const newProfile: VaultProfile = {
        id: crypto.randomUUID(),
        name: loginName.trim(),
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        verification: { encryptedData, iv, salt },
        createdAt: Date.now()
      };
      await saveVaultProfile(newProfile);
      
      const persisted = await requestPersistence();
      setIsPersistent(persisted);

      setVaultPin(pinEntry);
      setActiveProfile(newProfile);
      setIsUnlocked(true);
      setFiles([]);
    } catch (err) {
      setError('Vault creation failed.');
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
    setProcessingStatus('Securing Photo...');
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
      await loadFiles(activeProfile.id);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        alert("Storage Full! Please delete some files to make space.");
      } else {
        alert("Capture error. Storage might be full.");
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let uploadList: File[] = [];
    if ('files' in e.target && e.target.files) {
      uploadList = Array.from(e.target.files);
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      uploadList = Array.from(e.dataTransfer.files);
    }
    
    if (uploadList.length === 0 || !activeProfile) return;

    // Check for extremely large files (> 500MB)
    const tooLarge = uploadList.some(f => f.size > 500 * 1024 * 1024);
    if (tooLarge && !confirm("Some files are very large (>500MB). Browsers may crash due to memory limits. Continue?")) return;

    setIsProcessing(true);
    try {
      let count = 0;
      for (const file of uploadList) {
        count++;
        setProcessingStatus(`Encrypting ${count}/${uploadList.length}: ${file.name}`);
        
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        const isLarge = file.size > 15 * 1024 * 1024; // 15MB threshold for media

        // Smart Compression: 
        // - Always compress documents/text (high gain)
        // - Skip compression for large videos/images (low gain, high crash risk)
        const skipCompression = (isVideo || isImage) && isLarge;

        const { encryptedData, iv, salt, compressedSize } = await encryptFile(await file.arrayBuffer(), vaultPin, skipCompression);
        
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
      await loadFiles(activeProfile.id);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        alert("Storage Full! Some files could not be saved.");
      } else {
        console.error(e);
        alert("Upload failed. This usually happens with very large files on mobile devices due to memory limits.");
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      setIsDragging(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} items forever?`)) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await deleteFile(id);
      }
      setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      await updateQuota();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const selectedFiles = files.filter(f => selectedIds.has(f.id));
      for (const file of selectedFiles) {
        await handleDownload(file);
        await new Promise(r => setTimeout(r, 600));
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectAll = () => {
    if (selectedIds.size === filteredAndSortedFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedFiles.map(f => f.id)));
    }
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete || !activeProfile) return;
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
    const saved = Math.max(0, originalSize - compressedSize);
    const percent = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0;
    
    return {
      used: compressedSize,
      total: quota.total,
      saved,
      savedPercent: percent,
      imageCount: files.filter(f => f.type === 'image').length,
      videoCount: files.filter(f => f.type === 'video').length,
      docCount: files.filter(f => f.type === 'document').length
    };
  }, [files, quota]);

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative"
        >
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
            >
              <InfinityLogo className="w-20 h-20 text-indigo-400" />
            </motion.div>
          </div>
          <h1 className="text-5xl font-brand font-black text-center mb-1 tracking-tight text-white">infinity</h1>
          <p className="text-slate-500 text-center mb-10 text-[11px] font-black uppercase tracking-[0.2em] opacity-80">secure vault</p>
          
          {authMode === 'register' && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Security Notice</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold leading-tight">
                This vault is 100% local. We never store your PIN. If you forget it or clear browser data, your files are lost forever.
              </p>
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleCreateProfile} className="space-y-4">
            <input type="text" placeholder="Vault ID" className="w-full bg-slate-800 border-none rounded-2xl py-5 px-6 text-white font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none" value={loginName} onChange={(e) => setLoginName(e.target.value)} required />
            <input type="password" placeholder="PIN" maxLength={8} className="w-full bg-slate-800 border-none rounded-2xl py-5 text-center text-4xl tracking-[0.5em] font-black focus:ring-2 focus:ring-indigo-500 outline-none" value={pinEntry} onChange={(e) => setPinEntry(e.target.value)} required />
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 p-4 rounded-2xl"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
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
        </motion.div>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 mb-8 w-full max-w-sm"
        >
           <button onClick={handleInstallApp} className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all text-white group">
              <div className="flex items-center gap-4">
                 <DevicePhoneMobileIcon className="w-6 h-6 text-indigo-400" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Install as App</span>
              </div>
              <ArrowDownTrayIcon className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
           </button>
        </motion.div>
        {showInstallModal && <InstallInstructionModal isIOS={isIOS} onClose={() => setShowInstallModal(false)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans relative">
      <AnimatePresence>
        {showMobileSidebar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileSidebar(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed inset-y-0 left-0 z-[101] w-80 bg-white border-r border-slate-200 flex flex-col shadow-2xl transition-transform duration-500 ease-in-out
        md:relative md:translate-x-0 md:shadow-sm md:z-auto
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 p-2 rounded-xl">
                <InfinityLogo className="w-10 h-10 text-white" />
              </div>
              <div>
                <div className="text-3xl font-brand font-black tracking-tight leading-none">infinity</div>
                <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">secure vault</div>
              </div>
            </div>
            <button onClick={() => setShowMobileSidebar(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-900">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <nav className="space-y-2 mb-10">
            <SidebarItem icon={<FolderIcon />} label="All Safe Files" active={filter === 'all'} onClick={() => { setFilter('all'); setShowMobileSidebar(false); }} />
            <SidebarItem icon={<PhotoIcon />} label="Gallery" active={filter === 'image'} onClick={() => { setFilter('image'); setShowMobileSidebar(false); }} />
            <SidebarItem icon={<VideoCameraIcon />} label="Recordings" active={filter === 'video'} onClick={() => { setFilter('video'); setShowMobileSidebar(false); }} />
            <SidebarItem icon={<DocumentIcon />} label="Documents" active={filter === 'document'} onClick={() => { setFilter('document'); setShowMobileSidebar(false); }} />
            <SidebarItem icon={<InformationCircleIcon />} label="Help & FAQ" active={false} onClick={() => { setShowHelp(true); setShowMobileSidebar(false); }} />
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
                {isPersistent ? <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-amber-500" />}
             </button>
          </div>
        </div>
        <div className="p-8 border-t border-slate-100 flex flex-col gap-3">
           <button onClick={handleLockVault} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-colors">Lock Down</button>
        </div>
      </aside>

      <main 
        className="flex-1 flex flex-col min-w-0 bg-slate-50 relative overflow-hidden"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); handleFileUpload(e); }}
      >
        <header className="header-safe h-auto min-h-[4rem] sm:min-h-[5rem] px-4 sm:px-12 py-3 sm:py-4 flex items-center justify-between border-b border-slate-200 bg-white sticky top-0 z-40 gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
             <button onClick={() => setShowMobileSidebar(true)} className="p-2 bg-slate-100 rounded-xl md:hidden text-slate-600 active:scale-95 transition-all">
                <Bars3Icon className="w-6 h-6" />
             </button>
             <div className="hidden sm:block">
                <h2 className="font-brand font-black text-2xl sm:text-3xl tracking-tight leading-none">
                  {isSelectionMode ? `${selectedIds.size} Selected` : 'infinity'}
                </h2>
                <div className="flex items-center gap-1.5">
                   <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     {isSelectionMode ? 'Batch Actions' : 'secure vault'}
                   </p>
                   {!isSelectionMode && <CheckBadgeIcon className="w-3 h-3 text-emerald-500" />}
                </div>
             </div>
          </div>

          <div className="flex-1 max-w-md relative group">
             <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
             </div>
             <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-slate-100 border-none rounded-xl sm:rounded-2xl py-2 sm:py-3 pl-10 sm:pl-12 pr-4 text-xs sm:text-sm font-bold placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {isProcessing && (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-[9px] font-black uppercase tracking-widest text-indigo-600 animate-pulse">{processingStatus}</span>
                <ArrowPathIcon className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-indigo-600" />
              </div>
            )}
            
            {isSelectionMode ? (
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="p-2 sm:p-3 bg-slate-100 rounded-xl sm:rounded-2xl transition-all hover:bg-slate-200 active:scale-95 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {selectedIds.size === filteredAndSortedFiles.length ? 'None' : 'All'}
                </button>
                <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="p-2 sm:p-3 bg-slate-100 rounded-xl sm:rounded-2xl transition-all hover:bg-slate-200 active:scale-95 text-slate-600">
                  <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex bg-slate-100 p-1 rounded-xl sm:rounded-2xl mr-1 sm:mr-2">
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><Squares2X2Icon className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><ListBulletIcon className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                </div>
                <button onClick={() => setIsSelectionMode(true)} title="Select Mode" className="p-2 sm:p-3 bg-slate-100 rounded-xl sm:rounded-2xl transition-all hover:bg-slate-200 active:scale-95"><CheckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" /></button>
                <button onClick={startCamera} title="Camera Snap" className="p-2 sm:p-3 bg-slate-100 rounded-xl sm:rounded-2xl transition-all hover:bg-slate-200 active:scale-95"><CameraIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" /></button>
                <label title="Upload Files" className="bg-indigo-600 text-white font-black p-2 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl cursor-pointer shadow-xl shadow-indigo-600/20 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm hover:bg-indigo-700 transition-all active:scale-95">
                  <CloudArrowUpIcon className="w-5 h-5 sm:w-6 sm:h-6" /> <span className="hidden md:inline">Add</span>
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                </label>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-12 scrollbar-hide pb-32 md:pb-12">
          <AnimatePresence mode="wait">
            {filteredAndSortedFiles.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="h-full flex flex-col items-center justify-center text-slate-300"
              >
                <div className="p-8 sm:p-10 bg-white rounded-[3rem] sm:rounded-[4rem] border border-slate-100 shadow-sm flex flex-col items-center max-w-xs text-center">
                   <InfinityLogo className="w-16 h-16 sm:w-24 sm:h-24 mb-6 opacity-10" />
                   <p className="font-brand font-black uppercase tracking-widest text-[12px] sm:text-[14px] opacity-40 leading-relaxed text-center">
                      {searchQuery ? 'No results found.' : 'Your secure safe is empty.'}
                   </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={viewMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12"
              >
                {Object.entries(groupedFiles).map(([label, groupFiles]) => (
                  <div key={label} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">{label}</h3>
                      <div className="h-px w-full bg-slate-200/60" />
                    </div>
                    <div className={viewMode === 'grid' 
                      ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6" 
                      : "flex flex-col gap-2"
                    }>
                      {(groupFiles as StoredFile[]).map(file => (
                        <FileCard 
                          key={file.id} 
                          file={file} 
                          vaultPin={vaultPin} 
                          onDelete={() => setFileToDelete(file.id)} 
                          onDownload={() => handleDownload(file)} 
                          onPreview={() => setPreviewFile(file)} 
                          onRename={() => setFileToRename(file)}
                          isProcessing={isProcessing} 
                          isSelected={selectedIds.has(file.id)}
                          isSelectionMode={isSelectionMode}
                          onSelect={() => toggleSelection(file.id)}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isSelectionMode && selectedIds.size > 0 && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected</span>
                <span className="text-xl font-black font-brand">{selectedIds.size} Items</span>
              </div>
              <div className="h-8 w-px bg-white/10 mx-2" />
              <div className="flex items-center gap-3">
                <button onClick={handleBatchDownload} className="p-3 bg-emerald-600 rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20">
                  <ArrowDownTrayIcon className="w-6 h-6" />
                </button>
                <button onClick={handleBatchDelete} className="p-3 bg-rose-600 rounded-2xl hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-600/20">
                  <TrashIcon className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDragging && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-indigo-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-10 pointer-events-none"
            >
              <div className="p-10 border-4 border-dashed border-white/30 rounded-[4rem] flex flex-col items-center gap-8">
                <CloudArrowUpIcon className="w-32 h-32 animate-bounce" />
                <div className="text-center">
                  <h2 className="text-4xl font-brand font-black mb-2">Drop to Secure</h2>
                  <p className="text-indigo-200 font-bold uppercase tracking-widest text-sm">Release to encrypt and store files</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showInfo && <InfoModal stats={stats} onClose={() => setShowInfo(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showMaintenance && <MaintenanceModal files={files} handleDownloadAll={handleDownloadAll} handleInstallApp={handleInstallApp} handleExport={handleExport} handleImport={handleImport} deleteVaultProfile={deleteVaultProfile} activeProfile={activeProfile} handleLockVault={handleLockVault} onClose={() => setShowMaintenance(false)} isProcessing={isProcessing} setIsProcessing={setIsProcessing} isPersistent={isPersistent} />}
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
        <button onClick={onClose} className="p-4 sm:p-5 bg-white/10 text-white rounded-full backdrop-blur-xl border border-white/20 active:scale-95 transition-all"><XMarkIcon className="w-7 h-7 sm:w-8 sm:h-8" /></button>
        <button onClick={onCapture} disabled={isProcessing} className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-8 border-slate-200">
          {isProcessing ? <ArrowPathIcon className="w-10 h-10 text-indigo-600 animate-spin" /> : <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-slate-900" />}
        </button>
        <div className="w-14 sm:w-16" />
      </div>
    </div>
  );
}

function FileCard({ file, vaultPin, onDelete, onDownload, onPreview, onRename, isProcessing, isSelected, isSelectionMode, onSelect, viewMode }: any) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  const handleCopyName = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(file.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
  };

  if (viewMode === 'list') {
    return (
      <motion.div 
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => isSelectionMode ? onSelect() : onPreview()}
        className={`group flex items-center gap-4 p-3 bg-white rounded-2xl border-2 transition-all cursor-pointer relative ${isSelected ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 hover:border-slate-200'} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {file.type === 'image' && thumbnailUrl ? (
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <DocumentIcon className="w-6 h-6 text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-black text-slate-800 truncate">{file.name}</h3>
          <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <span>{file.type}</span>
            <span>{formatSize(file.size)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSelectionMode ? (
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
              {isSelected && <CheckIcon className="w-4 h-4 stroke-[4]" />}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={handleCopyName} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 active:scale-90 transition-all">
                {copied ? <CheckIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardIcon className="w-4 h-4" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 active:scale-90 transition-all"><PencilSquareIcon className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 active:scale-90 transition-all"><ArrowDownTrayIcon className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 active:scale-90 transition-all"><TrashIcon className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: isSelectionMode ? 0 : -5 }}
      onClick={() => isSelectionMode ? onSelect() : onPreview()}
      className={`group bg-white rounded-[1.8rem] sm:rounded-[2.5rem] border-2 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col cursor-pointer relative ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-600/10' : 'border-slate-200'} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {isSelectionMode && (
        <div className={`absolute top-3 right-3 z-20 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/50 border-slate-300 backdrop-blur-sm'}`}>
          {isSelected && <CheckIcon className="w-4 h-4 stroke-[4]" />}
        </div>
      )}

      {!isSelectionMode && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMobileMenu(!showMobileMenu); }}
          className="absolute top-3 right-3 z-20 p-2 bg-white/80 backdrop-blur-md rounded-xl text-slate-600 lg:hidden shadow-sm active:scale-90 transition-all"
        >
          <EllipsisVerticalIcon className="w-5 h-5" />
        </button>
      )}

      <AnimatePresence>
        {showMobileMenu && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-14 right-3 z-30 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 flex flex-col gap-1 lg:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <MobileMenuBtn icon={<ArrowsPointingOutIcon />} label="View" onClick={() => { onPreview(); setShowMobileMenu(false); }} />
            <MobileMenuBtn icon={<ClipboardIcon />} label="Copy Name" onClick={(e: any) => { handleCopyName(e); setShowMobileMenu(false); }} />
            <MobileMenuBtn icon={<PencilSquareIcon />} label="Rename" onClick={() => { onRename(); setShowMobileMenu(false); }} />
            <MobileMenuBtn icon={<ArrowDownTrayIcon />} label="Restore" color="text-emerald-600" onClick={() => { onDownload(); setShowMobileMenu(false); }} />
            <MobileMenuBtn icon={<TrashIcon />} label="Delete" color="text-rose-600" onClick={() => { onDelete(); setShowMobileMenu(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="aspect-square bg-slate-100 relative flex items-center justify-center overflow-hidden group/card">
        {file.type === 'image' && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover transition-transform duration-1000 lg:group-hover/card:scale-110" />
        ) : file.type === 'video' ? (
          <div className="relative w-full h-full flex items-center justify-center bg-indigo-50">
             <VideoCameraIcon className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-200" />
             <PlayIcon className="w-6 h-6 sm:w-10 sm:h-10 text-white absolute fill-indigo-600 drop-shadow-xl" />
          </div>
        ) : (
          <div className="bg-slate-50 w-full h-full flex items-center justify-center text-slate-300">
             <DocumentIcon className="w-8 h-8 sm:w-12 sm:h-12" />
          </div>
        )}
        
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-slate-950/70 opacity-0 lg:group-hover/card:opacity-100 transition-opacity hidden lg:flex items-center justify-center gap-2 backdrop-blur-sm pointer-events-auto">
            <button onClick={(e) => { e.stopPropagation(); onPreview(); }} className="p-2.5 bg-white rounded-xl text-slate-900 hover:scale-110 active:scale-95 transition-transform"><ArrowsPointingOutIcon className="w-4 h-4" /></button>
            <button onClick={handleCopyName} className="p-2.5 bg-white rounded-xl text-slate-900 hover:scale-110 active:scale-95 transition-transform">
              {copied ? <CheckIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardIcon className="w-4 h-4" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="p-2.5 bg-white rounded-xl text-slate-900 hover:scale-110 active:scale-95 transition-transform"><PencilSquareIcon className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="p-2.5 bg-emerald-500 rounded-xl text-white hover:scale-110 active:scale-95 transition-transform"><ArrowDownTrayIcon className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2.5 bg-rose-500 rounded-xl text-white hover:scale-110 active:scale-95 transition-transform"><TrashIcon className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <h3 className="text-[10px] sm:text-xs font-black text-slate-800 truncate mb-1 lg:group-hover/card:text-indigo-600 transition-colors">{file.name}</h3>
        
        <div className="flex flex-col gap-0.5">
           <div className="flex justify-between items-center text-[7px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              <span>{file.type}</span>
              <span className="text-slate-500 line-through opacity-40 font-black">{formatSize(file.size)}</span>
           </div>
           <div className="flex justify-between items-center mt-0.5">
              <div className="flex items-center gap-0.5 sm:gap-1 text-[7px] sm:text-[9px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-1.5 py-0.5 rounded-full">
                 <BoltIcon className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                 <span>{formatSize(file.compressedSize)}</span>
              </div>
           </div>
        </div>

        {!isSelectionMode && (
          <div className="mt-3 flex items-center gap-1.5">
              <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-emerald-600 text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all hover:bg-emerald-700">
                 <ArrowDownTrayIcon className="w-3 h-3" /> <span className="hidden sm:inline">Restore</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="md:hidden p-2 bg-rose-50 text-rose-500 rounded-lg active:scale-95 transition-all"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MobileMenuBtn({ icon, label, onClick, color = "text-slate-600" }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 active:scale-95 transition-all ${color}`}>
      {React.cloneElement(icon, { className: "w-4 h-4" })}
      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
    </button>
  );
}

function HelpModal({ onClose }: any) {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 mx-auto">
            <InformationCircleIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-brand font-black tracking-tight">help center</h2>
        </div>

        <div className="space-y-6">
          <HelpItem 
            title="Is my data in the cloud?" 
            desc="No. Infinity is 100% offline. Your files never leave your device. They are stored in your browser's internal database." 
          />
          <HelpItem 
            title="What if I forget my PIN?" 
            desc="There is no 'Forgot Password' button. Since we don't have your data, we cannot reset your PIN. Keep it safe!" 
          />
          <HelpItem 
            title="How do I free up space?" 
            desc="Once a file is secured in Infinity, you can safely delete the original from your phone's gallery to reclaim storage." 
          />
          <HelpItem 
            title="How do I move to a new phone?" 
            desc="Use the 'Backup' feature in Settings to export a .vault file, then 'Restore' it on your new device." 
          />
        </div>

        <button onClick={onClose} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Close Help</button>
      </div>
    </ModalWrapper>
  );
}

function HelpItem({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="border-b border-slate-100 pb-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-2">{title}</h4>
      <p className="text-xs text-slate-500 font-bold leading-relaxed">{desc}</p>
    </div>
  );
}
function MobileNavItem({ icon, active, onClick }: any) {
  return (
    <motion.button 
      whileTap={{ scale: 0.8 }}
      onClick={onClick} 
      className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all ${active ? 'text-indigo-600 bg-indigo-50 shadow-sm' : 'text-slate-400'}`}
    >
      {React.cloneElement(icon, { className: "w-6 h-6" })}
    </motion.button>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <motion.button 
      whileHover={{ x: 5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl text-[14px] font-bold transition-all ${active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
    >
      {React.cloneElement(icon, { className: "w-6 h-6 flex-shrink-0" })}
      <span className="tracking-tight">{label}</span>
    </motion.button>
  );
}

function ModalWrapper({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) {
    return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/90 z-[500] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl"
        >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-md p-6 sm:p-10 shadow-2xl relative text-slate-900 border-t-8 border-indigo-600 max-h-[90vh] overflow-y-auto"
            >
                <button onClick={onClose} className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"><XMarkIcon className="w-6 h-6 sm:w-7 sm:h-7" /></button>
                {children}
            </motion.div>
        </motion.div>
    );
}

function InfoModal({ stats, onClose }: any) {
    return (
        <ModalWrapper onClose={onClose}>
            <div className="text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6 sm:mb-8 mx-auto"><CheckBadgeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" /></div>
                <h2 className="text-3xl sm:text-4xl font-brand font-black mb-4 sm:mb-6 tracking-tight text-center">vault stats</h2>
                
                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Space Saved</p>
                      <p className="text-4xl font-black text-emerald-400">{formatSize(stats.saved)}</p>
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-emerald-400/10 text-emerald-400 rounded-full text-[10px] font-black">
                        <BoltIcon className="w-3 h-3" />
                        {stats.savedPercent}% Efficiency
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <StatMini label="Images" count={stats.imageCount} />
                    <StatMini label="Videos" count={stats.videoCount} />
                    <StatMini label="Docs" count={stats.docCount} />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-bold mb-8 leading-relaxed">
                  Tip: To save physical storage on your device, delete the original files from your gallery after they are secured in the vault.
                </p>

                <button onClick={onClose} className="w-full bg-slate-900 text-white py-4 sm:py-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Understood</button>
            </div>
        </ModalWrapper>
    );
}

function StatMini({ label, count }: { label: string, count: number }) {
  return (
    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">{label}</p>
      <p className="text-lg font-black text-slate-900">{count}</p>
    </div>
  );
}

function MaintenanceModal({ files, handleDownloadAll, handleInstallApp, handleExport, handleImport, deleteVaultProfile, activeProfile, handleLockVault, onClose, isProcessing, setIsProcessing, isPersistent }: any) {
    const handleWipe = async () => {
        if(confirm('⚠️ Permanent wipe: proceed?')) {
            setIsProcessing(true);
            try { await deleteVaultProfile(activeProfile!.id); handleLockVault(); } catch(e) { alert('Error.'); } finally { setIsProcessing(false); }
        }
    };
    return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6"
        >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-lg p-6 sm:p-10 shadow-2xl relative text-slate-900 max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
                <button onClick={onClose} className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 text-slate-400 hover:text-slate-900"><XMarkIcon className="w-6 h-6 sm:w-7 sm:h-7" /></button>
                <h2 className="text-3xl sm:text-4xl font-brand font-black mb-6 sm:mb-8 tracking-tight text-center">vault control</h2>
                
                {/* Persistence Status Badge */}
                <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between gap-4 border ${isPersistent ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                   <div className="flex items-center gap-3">
                      <ShieldCheckIcon className={`w-6 h-6 ${isPersistent ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest">Storage Status</p>
                         <p className="text-xs font-bold">{isPersistent ? 'Protected & Permanent' : 'Temporary (Unprotected)'}</p>
                      </div>
                   </div>
                   {!isPersistent && <InformationCircleIcon className="w-5 h-5 opacity-50" />}
                </div>

                <div className="space-y-3 sm:space-y-4">
                    <button onClick={handleDownloadAll} disabled={files.length === 0 || isProcessing} className="w-full flex items-center justify-between p-5 sm:p-7 bg-emerald-600 text-white rounded-[1.5rem] sm:rounded-[2rem] shadow-xl active:scale-95 transition-all">
                       <div className="flex items-center gap-3 sm:gap-5">
                          <ArrowDownCircleIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                          <div className="text-left"><p className="text-xs sm:text-sm font-black font-brand leading-none">Restore Everything</p></div>
                       </div>
                       <span className="font-brand font-black text-lg sm:text-2xl">{files.length}</span>
                    </button>
                    
                    <button onClick={handleInstallApp} className="w-full flex items-center justify-between p-5 sm:p-6 bg-indigo-50 border border-indigo-100 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-indigo-100 transition-all text-indigo-600 shadow-sm active:scale-95">
                        <div className="flex items-center gap-3 sm:gap-5">
                            <DevicePhoneMobileIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                            <p className="text-xs sm:text-sm font-black font-brand leading-none">Shortcut Guide</p>
                        </div>
                        <ArrowDownTrayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <button onClick={handleExport} className="flex flex-col items-center gap-2 p-4 sm:p-6 bg-slate-100 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-slate-200 active:scale-95 transition-all">
                            <ArrowUpOnSquareIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Backup</span>
                        </button>
                        <label className="flex flex-col items-center gap-2 p-4 sm:p-6 bg-slate-100 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-slate-200 active:scale-95 cursor-pointer transition-all">
                            <ArrowDownOnSquareIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Restore</span>
                            <input type="file" onChange={handleImport} className="hidden" accept=".vault" />
                        </label>
                    </div>

                    <button onClick={handleWipe} className="w-full flex items-center gap-2 justify-center text-rose-500 font-black uppercase text-[8px] sm:text-[10px] tracking-widest pt-4 sm:pt-6 border-t mt-3 sm:mt-4 active:scale-95 transition-all">
                        <TrashIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Permanent Reset
                    </button>
                </div>
                <button onClick={onClose} className="w-full mt-8 sm:mt-10 bg-slate-950 text-white py-4 sm:py-5 rounded-2xl font-black uppercase text-[10px] sm:text-xs font-brand active:scale-95">Close Settings</button>
            </motion.div>
        </motion.div>
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/95 z-[500] flex flex-col items-center justify-center p-3 sm:p-10 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full h-full max-w-7xl flex flex-col bg-slate-900/40 rounded-[2rem] sm:rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl"
      >
        <div className="px-5 sm:px-8 py-4 sm:py-6 flex justify-between items-center bg-slate-900/80 border-b border-white/5 z-20">
            <h2 className="text-xs sm:text-sm font-black text-white truncate max-w-[40%]">{file.name}</h2>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={onDownload} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-4 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[8px] sm:text-[10px] tracking-widest active:scale-95 shadow-xl">Restore</button>
              <button onClick={onClose} className="p-2.5 sm:p-4 bg-white/5 text-white rounded-xl sm:rounded-2xl hover:bg-white/10 active:scale-95"><XMarkIcon className="w-5 h-5 sm:w-7 sm:h-7" /></button>
            </div>
        </div>
        <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden text-white">
            {isDecrypting ? (
                <div className="flex flex-col items-center gap-4 sm:gap-6">
                   <ArrowPathIcon className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-500 animate-spin" />
                   <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500 text-center">Unlocking Safe...</p>
                </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {file.type === 'image' && dataUrl && <img src={dataUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg sm:rounded-xl shadow-2xl" />}
                {file.type === 'video' && dataUrl && <video src={dataUrl} controls autoPlay className="max-w-full max-h-full object-contain rounded-lg sm:rounded-xl shadow-2xl" />}
                {(file.type === 'document' || file.type === 'other') && (
                  <div className="text-center p-8 sm:p-12 bg-slate-900/80 rounded-[2rem] sm:rounded-[3rem] border border-white/5 max-w-sm text-white shadow-2xl">
                    <DocumentIcon className="w-16 h-16 sm:w-20 sm:h-20 text-indigo-400 mx-auto mb-4 sm:mb-6" />
                    <button onClick={onDownload} className="w-full bg-white text-slate-950 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[11px] tracking-widest active:scale-95">Download to View</button>
                  </div>
                )}
              </div>
            )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeleteConfirmModal({ onClose, onConfirm }: any) {
  return (
    <ModalWrapper onClose={onClose}>
       <div className="text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 mx-auto"><ExclamationTriangleIcon className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600" /></div>
          <h2 className="text-xl sm:text-2xl font-brand font-black mb-3 tracking-tight text-center">Delete Forever?</h2>
          <p className="text-slate-500 text-xs sm:text-sm mb-8 sm:mb-10 leading-relaxed font-bold">This file will be completely wiped from your secure safe storage.</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
             <button onClick={onClose} className="bg-slate-100 text-slate-600 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest active:scale-95">Cancel</button>
             <button onClick={onConfirm} className="bg-rose-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest active:scale-95">Delete</button>
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
              <h2 className="text-xl sm:text-2xl font-brand font-black mb-6 tracking-tight text-center">Rename Item</h2>
              <input type="text" autoFocus className="w-full bg-slate-100 border-none rounded-xl sm:rounded-2xl py-3 sm:py-4 px-5 sm:px-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none mb-6 sm:mb-8" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                 <button onClick={onClose} className="bg-slate-100 text-slate-600 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest active:scale-95">Cancel</button>
                 <button onClick={() => onConfirm(name)} className="bg-indigo-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest shadow-xl active:scale-95">Save</button>
              </div>
           </div>
        </ModalWrapper>
    );
}

function InstallInstructionModal({ isIOS, onClose }: { isIOS: boolean, onClose: () => void }) {
  return (
    <ModalWrapper onClose={onClose}>
        <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 mx-auto"><DevicePhoneMobileIcon className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" /></div>
            <h2 className="text-2xl sm:text-3xl font-brand font-black mb-4 tracking-tight text-center">Install Infinity</h2>
            <p className="text-slate-500 text-xs sm:text-sm mb-8 font-bold leading-relaxed">Pin to home screen to use it as your default device storage.</p>
            <div className="space-y-6 sm:space-y-8 text-left">
               <div className="flex gap-3 sm:gap-4 items-start">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-900 text-white flex items-center justify-center font-black flex-shrink-0 font-brand">1</div>
                  <p className="text-[10px] sm:text-xs text-slate-600 mt-1.5 sm:mt-2 font-bold leading-tight">Tap the <ShareIcon className="w-3.5 h-3.5 inline text-indigo-600 mx-1" /> icon in Safari/Chrome toolbar.</p>
               </div>
               <div className="flex gap-3 sm:gap-4 items-start">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black flex-shrink-0 font-brand">2</div>
                  <p className="text-[10px] sm:text-xs text-slate-600 mt-1.5 sm:mt-2 font-bold leading-tight">Choose <span className="text-indigo-600">"Add to Home Screen"</span> from the list.</p>
               </div>
            </div>
            <button onClick={onClose} className="w-full mt-8 sm:mt-10 bg-slate-950 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs font-brand active:scale-95 transition-all">Got it</button>
        </div>
    </ModalWrapper>
  );
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
};
