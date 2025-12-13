'use client'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
    const router = useRouter()

    const handleLogin = async () => {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            alert("Supabase keys missing. Check configuration.");
            return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`,
            },
        })
        if (error) {
            console.error(error)
            alert(error.message)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="p-8 bg-white rounded shadow-md text-center">
                <h1 className="text-2xl font-bold mb-4">Paggo Case Login</h1>
                <p className="mb-4 text-gray-600">Please sign in to continue.</p>
                <button
                    onClick={handleLogin}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                    Sign in with Google
                </button>
            </div>
        </div>
    )
}
