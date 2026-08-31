'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setChecking(false);
      if (data.session) {
        router.replace('/extrato');
      } else {
        router.replace('/login');
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-night-900">
      <div className="flex flex-col items-center gap-3 text-gold-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
        <p className="text-sm text-gold-100/70">
          {checking ? 'Verificando sessão…' : 'Redirecionando…'}
        </p>
      </div>
    </div>
  );
}
