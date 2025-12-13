import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { DocumentsProvider } from '@/context/DocumentsContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'Paggo Case',
    description: 'Document Analysis AI',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <DocumentsProvider>
                    {children}
                </DocumentsProvider>
            </body>
        </html>
    )
}
