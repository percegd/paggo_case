'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, ArrowLeft, Loader2, Bot, User, AlertTriangle, X, Heading, ChevronDown, ChevronUp, Download, Trash2, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';

interface Message {
    id: string;
    role: 'USER' | 'AI';
    content: string;
    createdAt: string;
}

interface Document {
    id: string;
    title: string;
    fileUrl: string;
    extractedText?: string;
    aiSummary?: string;
    chatMessages: Message[];
}

export default function DocumentDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [doc, setDoc] = useState<Document | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [expandedData, setExpandedData] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [showRateLimitModal, setShowRateLimitModal] = useState(false);

    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                console.log('[DocumentDetail] No user found, redirecting...');
                router.push('/'); // redirect to login if not authenticated
                return;
            }
            console.log('[DocumentDetail] User authenticated:', session.user.id);
            setUser(session.user);
            // fetch document ONLY after we have the user
            if (id) fetchDocument(session.user.id);
        };
        checkAuth();
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchDocument = async (currentUserId: string) => {
        console.log(`[DocumentDetail] Fetching document ${id} for user ${currentUserId}...`);
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/documents/${id}?userId=${currentUserId}`);
            console.log(`[DocumentDetail] Response status: ${res.status}`);

            if (!res.ok) {
                const text = await res.text();
                // If 404, it might be truly not found OR not belonging to this user
                if (res.status === 404) throw new Error("Document not found or access denied.");
                throw new Error(`Failed to load document (${res.status}): ${text}`);
            }

            const data = await res.json();
            console.log('[DocumentDetail] Data received:', data);

            if (!data) throw new Error('Document data is empty');

            setDoc(data);
            setMessages(data.chatMessages || []);
        } catch (e: any) {
            console.error('[DocumentDetail] Fetch Error:', e);
            setError(e.message || 'An unexpected error occurred while loading the document.');
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        const originalInput = input;
        setInput('');
        setSending(true);

        // Optimistic UI
        const tempId = Date.now().toString();
        const tempMsg: Message = { id: tempId, role: 'USER', content: originalInput, createdAt: new Date().toISOString() };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const res = await fetch(`/api/chat/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: originalInput, userId: user?.id }),
            });

            if (!res.ok) {
                if (res.status === 429) {
                    setShowRateLimitModal(true);
                    setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove optimistic message on rate limit
                    return;
                }
                throw new Error('Failed to send message');
            }

            const data = await res.json();
            setMessages(prev => [...prev.filter(m => m.id !== tempId), tempMsg, data]);
        } catch (e) {
            console.error('[DocumentDetail] Chat Error:', e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInput(originalInput);
            setInput(originalInput);
            setActionError("Failed to send message. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleDelete = async () => {
        if (!user || !id) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/documents/${id}?userId=${user.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete document');

            setShowDeleteModal(false);
            setShowSuccessModal(true);
        } catch (e) {
            console.error('Delete Error:', e);
            setActionError("Failed to delete document.");
            setDeleting(false);
        }
    };

    /**
     * handleDownloadPDF
     * Generates a PDF report combining:
     * 1. The original uploaded file (prepended)
     * 2. Extracted text (OCR)
     * 3. AI Summary
     * 4. Chat History
     */
    const handleDownloadPDF = async () => {
        if (!doc) return;
        setDownloading(true);

        try {
            // 1. Fetch Original File (Supabase or Legacy Local)
            const fetchUrl = doc.fileUrl.startsWith('http') ? doc.fileUrl : `/api/${doc.fileUrl}`;
            const fileRes = await fetch(fetchUrl);
            const fileBlob = await fileRes.blob();
            const fileArrayBuffer = await fileBlob.arrayBuffer();

            // 2. Create Content PDF (Summary, Data, Chat) using jsPDF
            const reportDoc = new jsPDF();
            const pageWidth = reportDoc.internal.pageSize.getWidth();

            // Title
            reportDoc.setFontSize(18);
            reportDoc.text("Document Report - Paggo.ai", 14, 20);

            reportDoc.setFontSize(10);
            reportDoc.setTextColor(100);
            reportDoc.text(`File: ${doc.title}`, 14, 28);
            reportDoc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 33);
            reportDoc.setTextColor(0);

            let currentY = 45;

            // Extracted Data Section
            reportDoc.setFontSize(14);
            reportDoc.text("1. Extracted Data (OCR)", 14, currentY);
            currentY += 8;
            reportDoc.setFontSize(10);
            const splitText = reportDoc.splitTextToSize(doc.extractedText || "No text extracted.", pageWidth - 28);
            reportDoc.text(splitText, 14, currentY);
            currentY += (splitText.length * 5) + 10;

            // Summary Section
            if (currentY + 30 > reportDoc.internal.pageSize.getHeight()) { reportDoc.addPage(); currentY = 20; }
            reportDoc.setFontSize(14);
            reportDoc.text("2. AI Summary", 14, currentY);
            currentY += 8;
            reportDoc.setFontSize(10);
            const splitSummary = reportDoc.splitTextToSize(doc.aiSummary || "No summary available.", pageWidth - 28);
            reportDoc.text(splitSummary, 14, currentY);
            currentY += (splitSummary.length * 5) + 10;

            // Chat History Section
            if (currentY + 30 > reportDoc.internal.pageSize.getHeight()) { reportDoc.addPage(); currentY = 20; }
            reportDoc.setFontSize(14);
            reportDoc.text("3. Chat History", 14, currentY);
            currentY += 10;

            autoTable(reportDoc, {
                startY: currentY,
                head: [['Sender', 'Message']],
                body: messages.map(m => [m.role === 'USER' ? 'You' : 'AI', m.content]),
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59] }, // Slate 800
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' } }
            });

            const reportPdfBytes = reportDoc.output('arraybuffer');

            // 3. Merge PDFs using pdf-lib
            const mergedPdf = await PDFDocument.create();

            // Embed Original File if PDF
            const isPdf = doc.fileUrl.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                const originalPdf = await PDFDocument.load(fileArrayBuffer);
                const copiedPages = await mergedPdf.copyPages(originalPdf, originalPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            } else {
                // If Image, add to a blank page at start
                const page = mergedPdf.addPage();
                const { width, height } = page.getSize();

                let image;
                if (doc.fileUrl.toLowerCase().endsWith('.png')) {
                    image = await mergedPdf.embedPng(fileArrayBuffer);
                } else if (doc.fileUrl.toLowerCase().match(/\.(jpg|jpeg)$/)) {
                    image = await mergedPdf.embedJpg(fileArrayBuffer);
                }

                if (image) {
                    const imgDims = image.scale(1);
                    const maxWidth = width - 40;
                    const maxHeight = height - 40;

                    // Calculate scale to fit
                    const scaleWidth = maxWidth / imgDims.width;
                    const scaleHeight = maxHeight / imgDims.height;
                    const scale = Math.min(scaleWidth, scaleHeight, 1); // Don't upscale, only downscale

                    const drawWidth = imgDims.width * scale;
                    const drawHeight = imgDims.height * scale;

                    page.drawImage(image, {
                        x: (width - drawWidth) / 2, // Center horizontally
                        y: (height - drawHeight) / 2, // Center vertically
                        width: drawWidth,
                        height: drawHeight,
                    });
                }

            }


            // Embed Report Pages (Common for both)
            const reportPdf = await PDFDocument.load(reportPdfBytes);
            const reportPages = await mergedPdf.copyPages(reportPdf, reportPdf.getPageIndices());
            reportPages.forEach((page) => mergedPdf.addPage(page));

            // 4. Save and Download (Common for both)
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            const safeTitle = doc.title.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_');
            link.download = `Report_${safeTitle}.pdf`;
            link.click();
        } catch (e) {
            console.error('Download PDF Error:', e);
            console.error('Download PDF Error:', e);
            setActionError("Error generating PDF. Please check if the original file is accessible.");
        } finally {
            setDownloading(false);
        }
    };

    // --- RENDER HELPERS ---

    // Action Error Modal Component
    const ActionErrorModal = () => {
        if (!actionError) return null;
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#111827] border border-red-500/30 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Error</h3>
                        <p className="text-slate-400 text-sm mb-6">{actionError}</p>
                        <button
                            onClick={() => setActionError(null)}
                            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Rate Limit Modal
    const RateLimitModal = () => {
        if (!showRateLimitModal) return null;
        return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#111827] border border-orange-500/30 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500 animate-pulse">
                            <Clock size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">High Traffic</h3>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                            We are experiencing high demand with our AI provider. Please wait a few seconds before sending another message.
                        </p>
                        <button
                            onClick={() => setShowRateLimitModal(false)}
                            className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors shadow-lg shadow-orange-900/20"
                        >
                            I'll wait
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // --- RENDER HELPERS ---

    // Loading State View
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f1e] text-slate-400 gap-4">
                <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
                <p className="animate-pulse">Loading document...</p>
            </div>
        );
    }

    // Error Modal (Full Screen Overlay if specific document fails to load)
    if (error || !doc) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-6">
                <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-md w-full p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
                        <p className="text-slate-400 mb-8">{error || "Document not found."}</p>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => router.push('/')}
                                className="flex-1 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={() => user && fetchDocument(user.id)}
                                className="flex-1 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="h-screen flex flex-col bg-slate-900 text-slate-50 overflow-hidden">
            {/* Main Centered Container */}
            {/* Main Centered Container */}
            <div className="w-full md:max-w-[90%] lg:max-w-[60%] mx-auto h-full flex flex-col bg-slate-900 shadow-2xl border-x border-slate-700/50">

                {/* Header */}
                <header className="bg-slate-800 border-b border-slate-700 px-4 md:px-6 py-4 flex items-center shadow-lg z-10">
                    <Link href="/" className="mr-4 text-slate-400 hover:text-white transition p-2 hover:bg-slate-800 rounded-full">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-blue-900/30 p-2 rounded text-blue-400">
                            <FileTextIcon />
                        </div>
                        <h1 className="text-lg font-bold text-white truncate">{doc.title}</h1>
                    </div>
                    <div className="ml-auto flex items-center gap-2">

                        <button
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {downloading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Generating PDF...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>Download PDF</span>
                                </>
                            )}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col">

                    {/* Main Content Area: Analysis & Chat */}
                    <div className="h-full flex flex-col bg-slate-900">

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                            {/* Extracted Data (Collapsible) */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => setExpandedData(!expandedData)}
                                    className="w-full flex items-center justify-between px-5 py-3 bg-slate-800/80 hover:bg-slate-700/80 transition-colors border-b border-slate-700/50"
                                >
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 font-bold">
                                        <FileTextIcon size={14} /> Extracted Data
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${expandedData ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:scale-105'}`}>
                                        {expandedData ? (
                                            <>
                                                <span>Collapse</span>
                                                <ChevronUp size={12} strokeWidth={3} />
                                            </>
                                        ) : (
                                            <>
                                                <span>Expand</span>
                                                <ChevronDown size={12} strokeWidth={3} />
                                            </>
                                        )}
                                    </div>
                                </button>

                                <div className={`transition-all duration-300 ease-in-out ${expandedData ? 'max-h-[500px] opacity-100' : 'max-h-20 opacity-80'}`}>
                                    <pre
                                        onClick={() => !expandedData && setExpandedData(true)}
                                        className={`text-xs text-slate-400 bg-slate-900 p-4 font-mono whitespace-pre-wrap overflow-y-auto custom-scrollbar border-none w-full cursor-pointer ${expandedData ? 'h-auto max-h-[400px]' : 'h-20 overflow-hidden relative'}`}
                                    >
                                        {!expandedData && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10 pointer-events-none" />
                                        )}
                                        {doc.extractedText || "Processing OCR..."}
                                    </pre>
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                                <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/80 flex items-center gap-2">
                                    <Bot size={16} className="text-blue-400" />
                                    <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">AI Summary</h2>
                                </div>
                                <div className="p-5 text-slate-300 text-sm leading-relaxed">
                                    {doc.aiSummary ? (
                                        doc.aiSummary
                                    ) : (
                                        <div className="flex items-center gap-2 text-slate-500 italic">
                                            <Loader2 size={14} className="animate-spin" />
                                            Generating summary...
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Chat History */}
                            <div className="pt-6 border-t border-slate-800">
                                <h3 className="text-sm font-semibold text-slate-200 mb-4">Chat History</h3>
                                <div className="space-y-4">
                                    {messages.length === 0 && (
                                        <p className="text-center text-slate-600 text-sm py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
                                            Ask a question to start chatting with this document.
                                        </p>
                                    )}
                                    {messages.map((m) => (
                                        <div key={m.id} className={`flex gap-3 ${m.role === 'USER' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${m.role === 'USER'
                                                ? 'bg-blue-600 text-white border-blue-500'
                                                : 'bg-emerald-600 text-white border-emerald-500'
                                                }`}>
                                                {m.role === 'USER' ? <User size={14} /> : <Bot size={14} />}
                                            </div>
                                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed overflow-hidden ${m.role === 'USER'
                                                ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20'
                                                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                                }`}>
                                                <ReactMarkdown
                                                    components={{
                                                        // Override basic elements to fit chat style
                                                        p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
                                                        strong: ({ children }) => <strong className="font-bold text-white/90">{children}</strong>,
                                                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                                        li: ({ children }) => <li>{children}</li>,
                                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">{children}</a>
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                    {sending && (
                                        <div className="flex gap-3 animate-pulse">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border bg-emerald-600 text-white border-emerald-500">
                                                <Bot size={14} />
                                            </div>
                                            <div className="bg-slate-800 text-slate-400 p-3 rounded-2xl rounded-tl-none border border-slate-700 text-sm flex items-center gap-2">
                                                <Loader2 size={14} className="animate-spin" />
                                                <span className="italic">Thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Chat Input */}
                        <div className="p-4 border-t border-slate-700 bg-slate-800">
                            <div className="relative flex items-center">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    placeholder="Ask about this document..."
                                    className={`w-full pl-5 pr-14 py-4 bg-slate-800 rounded-xl border text-slate-200 placeholder:text-slate-500 focus:bg-slate-800 focus:ring-1 transition resize-none text-sm shadow-inner ${input.length >= 1000 ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/50'}`}
                                    rows={1}
                                    maxLength={1000}
                                    disabled={sending}
                                />
                                <div className={`absolute bottom-2 right-14 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${input.length >= 900 ? 'text-red-400 bg-red-400/10' : 'text-slate-600'}`}>
                                    {input.length}/1000
                                </div>
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20"
                                >
                                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Simple Error Modal for Actions */}
            <ActionErrorModal />
            <RateLimitModal />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-slate-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Delete Document?</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Are you sure you want to delete this document? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-2 px-4 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50"
                                >
                                    {deleting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-emerald-500/20 rounded-lg p-6 max-w-sm w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Deleted Successfully</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Redirecting to dashboard...
                            </p>
                            <button
                                onClick={() => router.push('/')}
                                className="w-full py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple Icon Component
function FileTextIcon({ size = 20, className = "" }: { size?: number, className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    );
}
