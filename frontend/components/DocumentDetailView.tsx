'use client';
import { useEffect, useState, useRef } from 'react';
import { Send, ArrowLeft, Loader2, Bot, User, AlertTriangle, X, Heading, ChevronDown, ChevronUp, Download, Trash2, CheckCircle, Clock, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useDocuments } from '@/context/DocumentsContext';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';

interface DocumentDetailViewProps {
    docId: string;
    onBack: () => void;
}

export default function DocumentDetailView({ docId, onBack }: DocumentDetailViewProps) {
    const { getDocumentDetails, removeDocument, docs } = useDocuments();

    // 1. Try to initialize from Context Cache immediately
    const cachedDoc = docs.find(d => d.id === docId);

    const [doc, setDoc] = useState<any | null>(cachedDoc || null);
    const [messages, setMessages] = useState<any[]>(cachedDoc?.chatMessages || []);

    // 2. Only show full loading if we have absolutely nothing
    const [loading, setLoading] = useState(!cachedDoc);

    // 3. Local state
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [expandedData, setExpandedData] = useState(false);
    const [showRateLimitModal, setShowRateLimitModal] = useState(false);

    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                loadDocument(session.user.id);
            }
        };
        checkAuth();
    }, [docId]);

    const loadDocument = async (userId: string) => {
        try {
            // If we don't have even basic data, we must show loader.
            // If we have basic data (title), we stay interactive and just fill in details.
            if (!doc) setLoading(true);

            const detailedDoc = await getDocumentDetails(docId, userId);

            if (detailedDoc) {
                setDoc(detailedDoc);
                setMessages(detailedDoc.chatMessages || []);
            } else {
                setError("Document not found.");
            }
        } catch (err) {
            setError("Failed to load document.");
        } finally {
            setLoading(false);
        }
    };

    // Polling for status updates if Processing
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (doc?.status === 'PROCESSING' && user) {
            interval = setInterval(async () => {
                // Fetch fresh details for status update
                // We use axios directly here or use a force-refetch param if we added it?
                // Providing the getDocumentDetails implementation uses caching, we might need a way to bypass it for polling?
                // Actually the requirement is "load only once" for the VIEW.
                // But for polling status, we DO need to hit the server.
                // Let's call the API directly for polling to avoid messing with the big cache logic 
                // OR better, update `getDocumentDetails`?
                // Since this is specific polling, let's just hit the endpoint lightly or just re-call getDocumentDetails but we need to ensure it fetches.
                // The current `getDocumentDetails` returns cached if present.
                // So we can't use it for polling updates easily without a flag.
                // Whatever, I'll just hit the endpoint directly to check status, and if changed, update context.
                try {
                    const res = await axios.get(`/api/documents/${docId}?userId=${user.id}&t=${new Date().getTime()}`);
                    if (res.data.status !== 'PROCESSING') {
                        // Update local state and context (re-calling loadDocument effectively updates context via getDocumentDetails internal logic? No)
                        // We should manually update local state and context.
                        // Actually `getDocumentDetails` updates context state.
                        // But it returns cached.
                        // So we should manually update context:
                        // Ideally we expose `updateDocument` in context.
                        // For now let's just reload the whole thing by bypassing cache? No user wanted CACHE.
                        // Let's just update local state and maybe context if possible.
                        setDoc(res.data);
                        setMessages(res.data.chatMessages || []);
                    }
                } catch (e) { console.error("Polling error", e); }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [doc?.status, user, docId]);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending || !user || !doc) return;
        setSending(true);

        const newUserMsg = {
            id: Date.now().toString(),
            role: 'USER',
            content: input.trim(),
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, newUserMsg]);
        setInput('');

        try {
            const res = await fetch(`/api/chat/${doc.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: newUserMsg.content,
                    userId: user.id
                })
            });

            if (res.status === 429) {
                setShowRateLimitModal(true);
                setMessages(prev => prev.filter(m => m.id !== newUserMsg.id));
                return;
            }

            if (!res.ok) throw new Error('Failed to send message');

            const data = await res.json();
            const newAiMsg = {
                id: Date.now().toString() + 'ai',
                role: 'AI',
                content: data.content, // Fixed: Backend returns 'content', not 'reply'
                createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, newAiMsg]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'error',
                role: 'AI',
                content: 'Sorry, I encountered an error. Please try again.',
                createdAt: new Date().toISOString()
            }]);
        } finally {
            setSending(false);
        }
    };


    // Helper to draw Lucide User Icon (vector approximation)
    const drawLucideUserIcon = (pdf: any, x: number, y: number, size: number) => {
        // Lucide User is 24x24 grid.
        // We render it at (x,y) with width/height = size.
        const s = size / 24;

        pdf.setDrawColor(30, 58, 138); // Blue-900 (Stroke)
        pdf.setLineWidth(2 * s);

        // Head: Circle cx=12 cy=7 r=4
        // jsPDF circle takes (x, y, r)
        // We stroke it to match outline style of Lucide, or fill? 
        // Lucide icons are strokes by default.
        pdf.circle(x + 12 * s, y + 7 * s, 4 * s, 'S');

        // Body: Path
        // M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2
        // We can approximate the Arcs or use lines/curves
        // Points: (20,21) -> (20,19) -> Arc to (16,15) -> Line to (8,15) -> Arc to (4,19) -> (4,21)

        // Using lines for curves approximation for simplicity & robustness in jsPDF if arc is tricky
        // But bezier is better.
        // bezier: (x1,y1, x2,y2, x3,y3, x4,y4)

        // Let's just draw the path manually
        // Start (20, 21)
        const pathOps = [
            { op: 'm', c: [x + 20 * s, y + 21 * s] },
            { op: 'l', c: [x + 20 * s, y + 19 * s] }, // v-2
            // a4 4 0 0 0 -4 -4 -> Curve from (20,19) to (16,15)
            // CP1 approx (20, 16.8), CP2 approx (18.2, 15)?? 
            // Simplified: Quadratic or just line with chamfer for "Iconic" look if Bezier is hard to calc manually.
            // Actually, let's try a cubic bezier. 
            // Quarter circle from (20,19) to (16,15) center (16,19).
            // k = 0.5522847498 * r => r=4 => k=2.2
            // P0(20,19) -> P1(20, 19-2.2=16.8) ? No, direction is Up-Left.
            // Center is (16, 19) ? No radius is 4. y goes from 19 to 15. x goes 20 to 16.
            // Center is (16, 19).
            // c [0, -2.2, -1.8, -4, -4, -4] (relative)
            // pdf.path uses absolute coords usually?
            // Let's rely on simple line interpolation for "good enough" at this small size or use `lines`.
            // `lines` allows relative coords.
        ];

        // Using `lines` API of jsPDF: (lines: [x,y][], x, y, scale, style, closed)
        // Note: lines array format is `[ [dx, dy], [dx, dy, dx, dy, dx, dy] (bezier) ]`...

        // Let's try explicit bezier approximation:
        // P0=(20,19) -> P3=(16,15). 
        // Tangent at P0 is vertical up (0,-1). Tangent at P3 is horizontal left (-1,0).
        // CP1 = (20, 19 - 2.2) = (20, 16.8)
        // CP2 = (16 + 2.2, 15) = (18.2, 15)

        pdf.lines(
            [
                [0, -2 * s], // v-2 => down is positive Y, so up is negative. Wait, coords?
                // pdf.lines starts at x,y.
                // 1st segment: Line to (20,19). Relative: (0, -2) * s
                // 2nd: Bezier to (16,15). Relative target: (-4, -4)*s. 
                // CP1 (relative): (0, -2.2)*s. CP2 (relative): (-1.8, -4)*s.
                [0, -2.2 * s, -1.8 * s, -4 * s, -4 * s, -4 * s],
                // 3rd: Line H8. From 16 to 8. Relative: (-8, 0)*s
                [-8 * s, 0],
                // 4th: Arc back to (4,19). Target (-4, 4)*s.
                // Tangent at (8,15) is Left (-1,0). Target tangent is Down (0,1).
                // CP1: (8-2.2, 15) -> (-2.2, 0)*s.
                // CP2: (4, 19-2.2) -> (-4, 4-2.2=1.8 Wait. target is relative).
                // Target is (4,19). Start (8,15).
                // CP1 relative: (-2.2, 0).
                // CP2 relative: (-4, 2.2). ?? 
                // Bezier: dx1, dy1, dx2, dy2, dx3, dy3
                [-2.2 * s, 0, -4 * s, 1.8 * s, -4 * s, 4 * s],
                // 5th: v2 -> (0, 2)*s
                [0, 2 * s]
            ],
            x + 20 * s,
            y + 21 * s,
            [1, 1], // scale x,y (already applied s manually so [1,1])? No, lines expects raw numbers scaled by 3rd arg scale.
            // Let's use raw standard layout and pass `s` as scale.
            // x, y arguments for lines are the *start* point.
            'S',
            false // closed? No
        );
    };

    // Helper to draw Lucide Bot Icon
    const drawLucideBotIcon = (pdf: any, x: number, y: number, size: number) => {
        const s = size / 24;
        pdf.setDrawColor(15, 23, 42); // Slate-900
        pdf.setLineWidth(2 * s);

        // 1. Rect Body: x=3, y=11, w=18, h=10, rx=2
        pdf.roundedRect(x + 3 * s, y + 11 * s, 18 * s, 10 * s, 2 * s, 2 * s, 'S');

        // 2. Head Circle: cx=12, cy=5, r=2
        pdf.circle(x + 12 * s, y + 5 * s, 2 * s, 'S');

        // 3. Neck Line: 12,7 -> 12,11 // Adjusted to connect circle to rect
        pdf.line(x + 12 * s, y + 7 * s, x + 12 * s, y + 11 * s);

        // 4. Eyes: (8,16) and (16,16) -> Lucide Bot actually has eyes at y=16?
        pdf.line(x + 8 * s, y + 16 * s, x + 8 * s, y + 16 * s); // Point? Line of 0 length with round cap?
        // jsPDF line cap? 
        // Let's draw small filled circles for eyes
        pdf.setFillColor(15, 23, 42);
        pdf.circle(x + 9 * s, y + 15 * s, 1 * s, 'F'); // Left Eye
        pdf.circle(x + 15 * s, y + 15 * s, 1 * s, 'F'); // Right Eye
    };
    const handleDownload = async () => {
        if (!doc) return;
        setDownloading(true);
        try {
            // 1. Generate The Report Content (Summary + Chat) as separate parts or one if Image
            const pdf = new jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();
            let yPos = 20;

            // --- HEADER ---
            pdf.setFontSize(24);
            pdf.setTextColor(37, 99, 235);
            pdf.text('Paggo.ai', 20, yPos);
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Generated Report | ${new Date().toLocaleDateString()}`, pageWidth - 20, yPos, { align: 'right' });
            yPos += 15;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(20, yPos, pageWidth - 20, yPos);
            yPos += 20;

            // --- INFO & SUMMARY ---
            pdf.setFontSize(18);
            pdf.setTextColor(0, 0, 0);
            pdf.text(doc.title, 20, yPos);
            yPos += 15;

            if (doc.aiSummary) {
                pdf.setFillColor(245, 247, 250);
                pdf.roundedRect(20, yPos, pageWidth - 40, 10, 2, 2, 'F');
                pdf.setFontSize(12);
                pdf.setTextColor(30, 41, 59);
                pdf.setFont("helvetica", "bold");
                pdf.text('Executive Summary', 25, yPos + 7);
                yPos += 20;
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.setTextColor(51, 65, 85);
                const splitSummary = pdf.splitTextToSize(doc.aiSummary, pageWidth - 40);
                pdf.text(splitSummary, 20, yPos);
                yPos += splitSummary.length * 5 + 20;
            }

            if (doc.extractedText) {
                if (yPos > 250) { pdf.addPage(); yPos = 20; }
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(30, 41, 59);
                pdf.text('Extracted Content Preview', 20, yPos);
                yPos += 8;
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9);
                pdf.setTextColor(100, 100, 100);
                const textPreview = doc.extractedText.slice(0, 800) + (doc.extractedText.length > 800 ? '...' : '');
                const splitText = pdf.splitTextToSize(textPreview, pageWidth - 40);
                pdf.text(splitText, 20, yPos);
                yPos += splitText.length * 4 + 20;
            }

            // --- IMAGE EMBEDDING (If Image) ---
            const isImage = doc.fileUrl && /\.(jpg|jpeg|png|webp)$/i.test(doc.fileUrl);
            const isPdf = doc.fileUrl && /\.pdf$/i.test(doc.fileUrl);

            if (isImage) {
                if (yPos > 200) { pdf.addPage(); yPos = 20; }
                pdf.setFontSize(12);
                pdf.setTextColor(60, 60, 60);
                pdf.setFont("helvetica", "bold");
                pdf.text('Original Document:', 20, yPos);
                yPos += 10;
                try {
                    const response = await fetch(doc.fileUrl);
                    const blob = await response.blob();
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    const imgProps = pdf.getImageProperties(base64);
                    const maxWidth = pageWidth - 40;
                    const maxHeight = 200;
                    let w = imgProps.width;
                    let h = imgProps.height;
                    if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
                    if (h > maxHeight) { w = (maxHeight / h) * w; h = maxHeight; }
                    pdf.addImage(base64, 'JPEG', 20, yPos, w, h);
                    yPos += h + 20;
                } catch (e) {
                    // ignore
                }
            }

            // --- CHAT HISTORY ---
            if (messages && messages.length > 0) {
                pdf.addPage();
                yPos = 20;
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.text('Chat History', 20, yPos);
                yPos += 20;

                const userX = pageWidth - 20;
                const aiX = 20;
                const maxWidth = (pageWidth / 2) + 20;
                const pageHeight = pdf.internal.pageSize.getHeight();
                const bottomMargin = 20;
                const lineHeight = 5;

                for (const msg of messages) {
                    const isAI = msg.role === 'AI';
                    const content = msg.content.replace(/\*\*/g, '');
                    pdf.setFontSize(10);
                    pdf.setFont("helvetica", "normal");

                    // Split text into lines that fit the width
                    const splitMsg = pdf.splitTextToSize(content, maxWidth - 35);

                    let linesProcessed = 0;

                    while (linesProcessed < splitMsg.length) {
                        const remainingLines = splitMsg.length - linesProcessed;

                        // Calculate space available on current page
                        const spaceAvailable = pageHeight - bottomMargin - yPos;

                        // Calculate how many lines can fit in this space (minus padding)
                        // Bubble padding is roughly 12 units (6 top, 6 bottom)
                        // So text space is spaceAvailable - 12
                        const maxLinesFit = Math.floor((spaceAvailable - 16) / lineHeight);

                        if (maxLinesFit <= 0) {
                            // Does not fit at all, move to next page
                            pdf.addPage();
                            yPos = 20;
                            continue; // Retry loop with new page
                        }

                        // Determine how many lines to take for this chunk
                        const linesToTake = Math.min(remainingLines, maxLinesFit);
                        const chunk = splitMsg.slice(linesProcessed, linesProcessed + linesToTake);

                        const bubbleH = (chunk.length * lineHeight) + 12;

                        if (isAI) {
                            // AI Bubble
                            pdf.setFillColor(241, 245, 249);
                            pdf.roundedRect(aiX + 15, yPos, maxWidth - 15, bubbleH, 3, 3, 'F');

                            // Draw Bot Icon
                            if (linesProcessed === 0) {
                                drawLucideBotIcon(pdf, aiX + 2, yPos + 6, 8); // x, y, size
                            }

                            pdf.setFontSize(10);
                            pdf.setFont("helvetica", "normal");
                            pdf.setTextColor(15, 23, 42);
                            pdf.text(chunk, aiX + 20, yPos + 8);
                        } else {
                            // User Bubble
                            const bubbleX = userX - (maxWidth - 15);
                            pdf.setFillColor(219, 234, 254);
                            pdf.roundedRect(bubbleX, yPos, maxWidth - 15, bubbleH, 3, 3, 'F');

                            // Draw User Icon
                            if (linesProcessed === 0) {
                                drawLucideUserIcon(pdf, userX - 10, yPos + 6, 8); // x, y, size
                            }

                            pdf.setFontSize(10);
                            pdf.setFont("helvetica", "normal");
                            pdf.setTextColor(30, 58, 138);
                            pdf.text(chunk, bubbleX + 5, yPos + 8);
                        }

                        yPos += bubbleH + 5; // Gap between chunks/messages
                        linesProcessed += linesToTake;

                        // If we finished the message but are very close to bottom, add extra padding or just let next message handle it
                        if (linesProcessed < splitMsg.length) {
                            // If we have more lines to print, we naturally loop back and hit the "maxLinesFit <= 0" check -> addPage
                        }
                    }
                    yPos += 5; // Extra gap between distinct messages
                }
            }

            // 2. IF PDF, MERGE IT
            if (isPdf) {
                // Get the generated report as Buffer
                const reportArrayBuffer = pdf.output('arraybuffer');

                // Fetch Original PDF
                const origRes = await fetch(doc.fileUrl);
                const origArrayBuffer = await origRes.arrayBuffer();

                // Merge with pdf-lib
                const mergedPdf = await PDFDocument.create();
                const sourcePdf = await PDFDocument.load(origArrayBuffer);
                const reportPdf = await PDFDocument.load(reportArrayBuffer);

                // 1. Copy All Source Pages FIRST
                const sourcePages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
                sourcePages.forEach((page) => mergedPdf.addPage(page));

                // 2. Copy Report Pages (Summary + Chat)
                const reportPages = await mergedPdf.copyPages(reportPdf, reportPdf.getPageIndices());
                reportPages.forEach((page) => mergedPdf.addPage(page));

                const pdfBytes = await mergedPdf.save();
                // Download
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${doc.title.replace(/[\s\/]/g, '_')}_Report.pdf`;
                link.click();

            } else {
                // Just Image or Other, use jsPDF output directly
                pdf.save(`${doc.title.replace(/[\s\/]/g, '_')}_Report.pdf`);
            }

        } catch (error) {
            console.error('Download failed', error);
            alert('Failed to generate PDF. Note: PDF merging might be blocked by CORS if file is not public.');
        } finally {
            setDownloading(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !doc) return;
        setDeleting(true);
        try {
            await axios.delete(`/api/documents/${doc.id}?userId=${user.id}`);
            removeDocument(doc.id); // Update context
            setDeleting(false);
            setShowDeleteModal(false);
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Delete failed', error);
            setDeleting(false);
            alert('Failed to delete document.');
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex flex-col bg-slate-900 border-x border-slate-700/50 w-full md:max-w-[90%] lg:max-w-[60%] mx-auto shadow-2xl">
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 size={40} className="animate-spin text-blue-500" />
                    <p className="text-slate-400 animate-pulse">Loading document details...</p>
                </div>
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="h-screen flex flex-col bg-slate-900 border-x border-slate-700/50 w-full md:max-w-[90%] lg:max-w-[60%] mx-auto shadow-2xl">
                <div className="p-4">
                    <button onClick={onBack} className="flex items-center text-slate-400 hover:text-white mb-4">
                        <ArrowLeft size={20} className="mr-2" /> Back
                    </button>
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                        <AlertTriangle size={48} className="text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">{error || "Document not found"}</h3>
                        <p className="text-slate-400">The document might have been deleted or is inaccessible.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-900 text-slate-50 overflow-hidden">
            <div className="w-full md:max-w-[90%] lg:max-w-[60%] mx-auto h-full flex flex-col bg-slate-900 shadow-2xl border-x border-slate-700/50">
                {/* Header */}
                <header className="bg-slate-800 border-b border-slate-700 px-4 md:px-6 py-4 flex items-center shadow-lg z-10">
                    <button onClick={onBack} className="mr-4 text-slate-400 hover:text-white transition p-2 hover:bg-slate-800 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 overflow-hidden">
                        <h1 className="text-lg font-bold text-white truncate" title={doc.title}>{doc.title}</h1>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <Clock size={12} />
                            <span>{new Date(doc.createdAt).toLocaleString()}</span>
                            {doc.status === 'PROCESSING' && <span className="text-blue-400 font-bold ml-2">• Processing</span>}
                            {doc.status === 'FAILED' && <span className="text-red-400 font-bold ml-2">• Failed</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {doc.fileUrl && (
                            <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-black/20"
                                title="View Original Document"
                            >
                                <Eye size={16} />
                                <span>View</span>
                            </a>
                        )}
                        <button
                            onClick={handleDownload}
                            disabled={downloading || doc.status === 'PROCESSING' || doc.status === 'FAILED'}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download Report"
                        >
                            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            <span>Download</span>
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Document"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                {/* Processing View */}
                {doc.status === 'PROCESSING' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                            <div className="relative w-24 h-24 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center p-6 shadow-2xl">
                                <Loader2 size={48} className="animate-spin text-blue-500" />
                            </div>
                        </div>
                        <div className="max-w-md space-y-2">
                            <h3 className="text-2xl font-bold text-white">Analyzing Document...</h3>
                            <p className="text-slate-400">Our AI is extracting text, identifying key insights, and generating a summary.</p>
                        </div>
                        {/* Steps */}
                        <div className="w-full max-w-sm space-y-4">
                            <div className="flex items-center gap-3 text-emerald-500">
                                <CheckCircle size={18} /> <span className="text-sm font-medium">Upload Complete</span>
                            </div>
                            <div className="flex items-center gap-3 text-blue-400 animate-pulse">
                                <Loader2 size={18} className="animate-spin" /> <span className="text-sm font-medium">Extracting Text & Data</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="w-4.5 h-4.5 rounded-full border-2 border-slate-700"></div> <span className="text-sm">Generating AI Summary</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* AI Summary Block */}
                            {doc.aiSummary && (
                                <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-xl p-6 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Bot size={18} className="text-blue-400" />
                                        <h3 className="font-bold text-white text-sm uppercase tracking-wider">Executive Summary</h3>
                                    </div>
                                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
                                        <ReactMarkdown>{doc.aiSummary}</ReactMarkdown>
                                    </div>
                                    {/* Extracted Text Toggle */}
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                        <button
                                            onClick={() => setExpandedData(!expandedData)}
                                            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-blue-400 transition-colors"
                                        >
                                            {expandedData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {expandedData ? 'Hide Extracted Data' : 'View Extracted Data'}
                                        </button>
                                        {expandedData && (
                                            <div className="mt-3 p-4 bg-black/20 rounded-lg text-xs font-mono text-slate-400 whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-800/50">
                                                {doc.extractedText || "No text extracted."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Chat Interface */}
                            <div className="relative">
                                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800"></div>
                                <div className="space-y-6">
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'USER' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${msg.role === 'AI' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700 text-slate-300 border-slate-600'
                                                }`}>
                                                {msg.role === 'AI' ? <Bot size={14} /> : <User size={14} />}
                                            </div>
                                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'AI' ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700' : 'bg-blue-600 text-white rounded-tr-none'
                                                }`}>
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'USER' ? 'text-blue-200' : 'text-slate-500'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                    {sending && (
                                        <div className="flex gap-3 animate-pulse">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border bg-indigo-600 text-white border-indigo-500">
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
                        {doc.status !== 'PROCESSING' && (
                            <div className="p-4 border-t border-slate-700 bg-slate-800">
                                <div className="relative flex items-center">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder="Ask a question about this document..."
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
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            <RateLimitModal show={showRateLimitModal} onClose={() => setShowRateLimitModal(false)} />
            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-slate-700 rounded-lg p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Delete Document?</h3>
                            <p className="text-slate-400 text-sm mb-6">Are you sure? This cannot be undone.</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors">Cancel</button>
                                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 px-4 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50">{deleting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Delete'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111827] border border-emerald-500/20 rounded-lg p-6 max-w-sm w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Deleted Successfully</h3>
                            <button
                                onClick={() => { setShowSuccessModal(false); onBack(); }}
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

function RateLimitModal({ show, onClose }: { show: boolean; onClose: () => void }) {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#111827] border border-red-500/30 rounded-lg p-6 max-w-sm w-full shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500"><AlertTriangle size={24} /></div>
                    <h3 className="text-lg font-bold text-white mb-2">Rate Limit Exceeded</h3>
                    <p className="text-slate-400 text-sm mb-6">You're sending messages too fast. Please wait a moment.</p>
                    <button onClick={onClose} className="w-full py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors">OK</button>
                </div>
            </div>
        </div>
    );
}
