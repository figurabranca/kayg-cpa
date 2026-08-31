'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import banner from '../../public/banner-login.jpg';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErro(null);

    if (!isSupabaseConfigured) {
      setErro(
        'Supabase não configurado. Preencha as Secrets NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);

    if (error) {
      setErro('E-mail ou senha inválidos. Verifique e tente novamente.');
      return;
    }

    router.replace('/extrato');
  }

  return (
    <main className="flex min-h-screen flex-col bg-night-900 md:flex-row">
      {/* Banner: topo reduzido no mobile, lateral cheia no desktop */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden md:h-auto md:w-1/2">
        <Image
          src={banner}
          alt="KAYG CPA"
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night-900 via-night-900/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-night-900/10 md:to-night-900" />
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 md:w-1/2">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold text-gold-400">KAYG CPA</h1>
          <p className="mt-2 text-sm text-white/60">
            Acesse o painel financeiro e operacional.
          </p>

          {!isSupabaseConfigured && (
            <div className="mt-4 rounded-lg border border-gold-700/50 bg-gold-900/10 px-4 py-3 text-xs text-gold-300">
              Supabase ainda não configurado. Preencha as Secrets do repositório
              (<code>NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) e republique.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-white/70">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-night-600 bg-night-800 px-4 py-3 text-base text-white outline-none ring-gold-500 focus:ring-2"
                placeholder="voce@exemplo.com"
              />
            </div>

            <div>
              <label htmlFor="senha" className="mb-1 block text-xs font-medium text-white/70">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-night-600 bg-night-800 px-4 py-3 text-base text-white outline-none ring-gold-500 focus:ring-2"
                placeholder="••••••••"
              />
            </div>

            {erro && (
              <p role="alert" className="text-sm text-red-400">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-gold-500 px-4 py-3 text-base font-semibold text-night-900 transition hover:bg-gold-400 disabled:opacity-60"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
