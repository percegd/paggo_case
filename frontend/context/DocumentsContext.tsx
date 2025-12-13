'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import axios from 'axios';

interface Document {
    id: string;
    title: string;
    status: string;
    extractedText?: string;
    createdAt: string;
}

interface DocumentsContextType {
    docs: Document[];
    loading: boolean;
    error: string | null;
    fetchDocuments: (userId: string, force?: boolean) => Promise<void>;
    addDocument: (doc: Document) => void;
    removeDocument: (docId: string) => void;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export function DocumentsProvider({ children }: { children: ReactNode }) {
    const [docs, setDocs] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

    const fetchDocuments = useCallback(async (userId: string, force = false) => {
        // Prevent redundant fetching if we already have data for this user
        if (!force && lastFetchedUserId === userId && docs.length > 0) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/documents?userId=${userId}`);
            setDocs(Array.isArray(res.data) ? res.data : []);
            setLastFetchedUserId(userId);
        } catch (err) {
            console.error('Failed to fetch documents', err);
            setError('Failed to load documents.');
        } finally {
            setLoading(false);
        }
    }, [docs.length, lastFetchedUserId]);

    const addDocument = useCallback((doc: Document) => {
        setDocs(prev => [doc, ...prev]);
    }, []);

    const removeDocument = useCallback((docId: string) => {
        setDocs(prev => prev.filter(d => d.id !== docId));
    }, []);

    return (
        <DocumentsContext.Provider value={{ docs, loading, error, fetchDocuments, addDocument, removeDocument }}>
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
