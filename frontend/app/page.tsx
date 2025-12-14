'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, FileText, Upload, LogOut, ShieldCheck, PieChart, Activity, X, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import axios from 'axios';
import { useDocuments } from '@/context/DocumentsContext';

// Types
interface Document {
    id: string;
    title: string;
    status: string;
    extractedText?: string;
    createdAt: string;
}

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [loadingDefaults, setLoadingDefaults] = useState(true);

    // Dashboard State (Global Docs Context)
    const { docs, loading: loadingDocs, fetchDocuments, removeDocument } = useDocuments();
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false); // New state for delete loading
    const [uploadProgress, setUploadProgress] = useState(0);

    // Modal Visibility States
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [errorModal, setErrorModal] = useState<{ show: boolean, message: string }>({ show: false, message: '' });
    const [successModal, setSuccessModal] = useState(false);
    const [deleteSuccessModal, setDeleteSuccessModal] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ show: boolean, docId: string | null, docTitle: string }>({ show: false, docId: null, docTitle: '' });

    useEffect(() => {
        checkUser();

        // listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                await syncUser(session.user);
                fetchDocuments(session.user.id, true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Smart Polling: Refresh Documents if any are processing
    useEffect(() => {
        const hasProcessing = docs.some(d => d.status === 'PROCESSING');
        let interval: NodeJS.Timeout;

        if (hasProcessing && user) {
            interval = setInterval(() => {
                fetchDocuments(user.id, true);
            }, 5000); // Poll every 5 seconds
        }

        return () => clearInterval(interval);
    }, [docs, user]); // Re-run when docs change (to check if still processing) or user changes

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setUser(session.user);
            await syncUser(session.user);
            fetchDocuments(session.user.id);
        } else {
            setUser(null);
        }
        setLoadingDefaults(false);
    };

    const syncUser = async (u: User) => {
        try {
            await axios.post(`/api/users/sync`, {
                id: u.id,
                email: u.email
            });
        } catch (error) {
            console.error('Failed to sync user', error);
        }
    };


    const handleLogin = async () => {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            alert("Please configure Supabase keys in .env.local first.");
            return;
        }
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/` },
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setShowLogoutModal(false);
    };


    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || !user) return;
        setUploading(true);
        setUploadProgress(0);

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id);
        if (user.email) formData.append('email', user.email);

        try {
            await axios.post(`/api/documents/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(percentCompleted);
                    if (percentCompleted === 100) {
                        setProcessing(true);
                    }
                }
            });

            await fetchDocuments(user.id, true); // Force refresh after upload
            setSuccessModal(true);
        } catch (err) {
            console.error('Upload failed', err);
            setErrorModal({ show: true, message: 'Failed to upload document. Please try again or check your network connection.' });
        } finally {
            setUploading(false);
            setProcessing(false);
            setUploadProgress(0);
            e.target.value = '';
        }
    };

    const handleDeleteDocument = async () => {
        if (!deleteModal.docId || !user) return;
        setIsDeleting(true); // Start loading

        try {
            await axios.delete(`/api/documents/${deleteModal.docId}?userId=${user.id}`);
            // Optimistic update via Context
            removeDocument(deleteModal.docId);
            setDeleteModal({ show: false, docId: null, docTitle: '' });
            setIsDeleting(false); // Stop loading before success modal
            setDeleteSuccessModal(true);
        } catch (error) {
            console.error('Failed to delete document', error);
            setIsDeleting(false);
            alert("Failed to delete document.");
        }
    };

    if (loadingDefaults) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
                <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
            </div>
        );
    }

    // ... [Code omitted for brevity until DeleteModal section] ...

    // GUEST VIEW (Landing Page Style for Unauthenticated Users)
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-[#1e293b] rounded-full blur-[120px] opacity-20"></div>
                    <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900 rounded-full blur-[120px] opacity-10"></div>
                </div>

                <div className="z-10 max-w-2xl w-full">
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
                            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-2xl relative">
                                <FileText className="text-blue-400 w-10 h-10" />
                            </div>
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
                        Transform Your <span className="text-blue-500">Financial Documents</span>
                    </h1>

                    <p className="text-slate-400 text-lg mb-10 leading-relaxed max-w-lg mx-auto">
                        Secure, AI-powered invoice analysis for modern financial teams. Extract data, summarize context, and chat with your documents in real-time.
                    </p>

                    <div className="flex flex-col items-center space-y-6">
                        <div className="text-slate-400 text-sm mb-2 max-w-md text-center">
                            Please log in to upload documents and access your complete submission history.
                        </div>

                        <div className="w-full max-w-sm">
                            <button
                                onClick={handleLogin}
                                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-[#0a0f1e] font-bold py-4 px-6 rounded-lg transition-all duration-200 shadow-xl shadow-blue-900/10 hover:shadow-blue-500/10"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Sign in with Google
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // AUTHENTICATED USER DASHBOARD VIEW
    return (
        <div className="min-h-screen bg-slate-900 text-slate-50">
            {/* Navbar */}
            <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-md">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Paggo<span className="text-slate-500">.ai</span></span>
                    </div>

                    <button
                        onClick={() => setShowLogoutModal(true)}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-12">
                {/* Dashboard Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b border-slate-800 pb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Financial Documents</h2>
                        <p className="text-slate-400">Securely manage and analyze your organization's invoices.</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <label className={`
                cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-md transition-all font-medium text-sm
                ${uploading ? 'opacity-80 pointer-events-none' : ''}
            `}>
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            <span>{uploading ? `Uploading ${uploadProgress}%` : 'Upload'}</span>
                            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUpload} disabled={uploading} />
                        </label>
                        {/* Minimal Progress Bar below button */}
                        {uploading && (
                            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-400 transition-all duration-300 ease-out"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                {loadingDocs ? (
                    <div className="flex justify-center py-32"><Loader2 className="animate-spin text-slate-600 w-8 h-8" /></div>
                ) : docs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-slate-800 border border-dashed border-slate-800 rounded-lg relative">
                        {uploading && (
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white z-10 transition-all duration-300 bg-slate-800/90 rounded-lg">
                                {processing ? (
                                    <span className="flex items-center gap-1 animate-pulse">
                                        <Loader2 size={12} className="animate-spin" />
                                        Processing...
                                    </span>
                                ) : (
                                    `${uploadProgress}%`
                                )}
                            </div>
                        )}
                        <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center text-slate-500 mb-4">
                            <PieChart size={24} />
                        </div>
                        <h3 className="text-white font-medium mb-1">No documents found</h3>
                        <p className="text-slate-500 text-sm">Upload a new document to begin analysis.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {docs.map((doc) => (
                            <Link key={doc.id} href={`/documents/${doc.id}`} className="block group relative">
                                <div className="h-full bg-slate-800 border border-slate-700/50 rounded-lg hover:border-slate-500 transition-all p-6 flex flex-col group-hover:shadow-lg group-hover:shadow-blue-900/10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-10 h-10 bg-slate-900 rounded flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault(); // Prevent navigation
                                                setDeleteModal({ show: true, docId: doc.id, docTitle: doc.title });
                                            }}
                                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete Document"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <h3 className="font-semibold text-white mb-2 truncate group-hover:text-blue-400 transition-colors" title={doc.title}>
                                        {doc.title}
                                    </h3>


                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                        <Activity size={12} />
                                        <span>Processed {new Date(doc.createdAt).toLocaleDateString()}</span>
                                    </div>

                                    {doc.status === 'PROCESSING' && (
                                        <div className="absolute bottom-6 right-6 flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-semibold animate-pulse border border-blue-500/20 pointer-events-none">
                                            <Loader2 size={12} className="animate-spin" />
                                            processing
                                        </div>
                                    )}

                                    {doc.extractedText && (
                                        <p className="mt-auto text-sm text-slate-400 line-clamp-2 border-t border-slate-800 pt-4">
                                            {doc.extractedText}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            {/* Logout Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-slate-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Confirm Logout</h3>
                        <p className="text-slate-400 text-sm mb-6">Are you sure you want to end your session?</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="px-4 py-2 text-sm rounded bg-transparent hover:bg-slate-800 text-slate-300 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm rounded bg-white hover:bg-gray-200 text-black font-medium transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-slate-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex flex-col items-center text-center">
                            {isDeleting ? (
                                <>
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 text-blue-500">
                                        <Loader2 size={24} className="animate-spin" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Deleting...</h3>
                                    <p className="text-slate-400 text-sm mb-6">
                                        Removing document and associated memory.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                                        <Trash2 size={24} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Delete Document?</h3>
                                    <p className="text-slate-400 text-sm mb-6">
                                        Are you sure you want to delete <strong>{deleteModal.docTitle}</strong>? This action cannot be undone.
                                    </p>
                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => setDeleteModal({ show: false, docId: null, docTitle: '' })}
                                            className="flex-1 py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeleteDocument}
                                            className="flex-1 py-2 px-4 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {successModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-emerald-500/20 rounded-lg p-6 max-w-sm w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <button
                            onClick={() => setSuccessModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Upload Successful!</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Your document has been uploaded and is being processed by our AI.
                            </p>
                            <button
                                onClick={() => setSuccessModal(false)}
                                className="w-full py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {errorModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-red-500/20 rounded-lg p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <button
                            onClick={() => setErrorModal({ show: false, message: '' })}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-start gap-4 mb-4">
                            <div className="bg-red-500/10 p-3 rounded-full text-red-500">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">Upload Failed</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{errorModal.message}</p>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setErrorModal({ show: false, message: '' })}
                                className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Success Modal */}
            {
                deleteSuccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#111827] border border-emerald-500/20 rounded-lg p-6 max-w-sm w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <button
                                onClick={() => setDeleteSuccessModal(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Deleted Successfully</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    The document has been permanently removed.
                                </p>
                                <button
                                    onClick={() => setDeleteSuccessModal(false)}
                                    className="w-full py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-lg shadow-emerald-900/20"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
