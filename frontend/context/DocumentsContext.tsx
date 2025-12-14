'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import axios from 'axios';

interface Document {
    id: string;
    title: string;
    status: string;
    extractedText?: string;
    createdAt: string;
    fileUrl?: string;
    aiSummary?: string;
    chatMessages?: any[]; // using any[] for Message[] to avoid circular dependency or import issues for now, or I can define Message
}

interface Message {
    id: string;
    role: 'USER' | 'AI';
    content: string;
    createdAt: string;
}

interface DocumentsContextType {
    docs: Document[];
    loading: boolean;
    error: string | null;
    fetchDocuments: (userId: string, force?: boolean, isBackground?: boolean) => Promise<void>;
    addDocument: (doc: Document) => void;
    removeDocument: (docId: string) => void;
    getDocumentDetails: (docId: string, userId: string) => Promise<Document | null>;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export function DocumentsProvider({ children }: { children: ReactNode }) {
    const [docs, setDocs] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

    const fetchDocuments = useCallback(async (userId: string, force = false, isBackground = false) => {
        if (!force && lastFetchedUserId === userId && docs.length > 0 && !isBackground) {
            return;
        }

        if (!isBackground) setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/documents?userId=${userId}&t=${new Date().getTime()}`);
            // Merge existing detailed docs with new list to preserve cache?
            // Actually, the list endpoint might assume summary data.
            // If we just replace `docs`, we lose the detailed `chatMessages` we fetched.
            // We should merge.

            const newDocs = Array.isArray(res.data) ? res.data : [];
            setDocs(currentDocs => {
                // If we have current docs, we want to keep their 'details' if the ID matches.
                // But typically the list update might change status.
                // Let's create a map of current docs.
                const currentDocsMap = new Map(currentDocs.map(d => [d.id, d]));
                return newDocs.map((newDoc: Document) => {
                    const existing = currentDocsMap.get(newDoc.id);
                    if (existing) {
                        // Preserve detailed fields if they exist in state but not in new fetch
                        // (Assuming list fetch doesn't return chatMessages)
                        return {
                            ...newDoc,
                            chatMessages: existing.chatMessages,
                            aiSummary: existing.aiSummary || newDoc.aiSummary,
                            fileUrl: existing.fileUrl || newDoc.fileUrl
                        };
                    }
                    return newDoc;
                });
            });

            setLastFetchedUserId(userId);
        } catch (err) {
            console.error('Failed to fetch documents', err);
            setError('Failed to load documents.');
        } finally {
            setLoading(false);
        }
    }, [docs.length, lastFetchedUserId]);

    const getDocumentDetails = useCallback(async (docId: string, userId: string): Promise<Document | null> => {
        // Check if we already have the details
        const existingDoc = docs.find(d => d.id === docId);
        if (existingDoc && existingDoc.chatMessages && existingDoc.fileUrl) {
            // We have details cached! 
            // NOTE: We might want to re-fetch if status is PROCESSING to get updates?
            // User requested "only load once". So for now we return cached.
            // But if it is PROCESSING, we probably DO want to re-fetch or rely on the polling from page.tsx?
            // Actually, the detail view will handle polling status updates.
            // For checking "if loaded", we check for chatMessages presence.
            return existingDoc;
        }

        // Fetch details
        try {
            const res = await axios.get(`/api/documents/${docId}?userId=${userId}&t=${new Date().getTime()}`);
            const detailDoc = res.data;

            // Update the specific document in the state with full details
            setDocs(prev => prev.map(d => d.id === docId ? { ...d, ...detailDoc } : d));
            return detailDoc;
        } catch (err) {
            console.error('Failed to fetch document details', err);
            return null;
        }
    }, [docs]);

    const addDocument = useCallback((doc: Document) => {
        setDocs(prev => [doc, ...prev]);
    }, []);

    const removeDocument = useCallback((docId: string) => {
        setDocs(prev => prev.filter(d => d.id !== docId));
    }, []);

    return (
        <DocumentsContext.Provider value={{ docs, loading, error, fetchDocuments, addDocument, removeDocument, getDocumentDetails }}>
            {children}
        </DocumentsContext.Provider>
    );
}

export function useDocuments() {
    const context = useContext(DocumentsContext);
    if (context === undefined) {
        throw new Error('useDocuments must be used within a DocumentsProvider');
    }
    return context;
}
