'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  formatBRL,
  parseBRL,
  calcularSaldo,
  operacaoSchema,
  type Operacao,
  type OperacaoTipo,
} from '@/lib/money';
import type { Database } from '@/lib/database.types';

type OperacaoRow = Database['public']['Tables']['operacoes']['Row'];

const TIPO_LABEL: Record<OperacaoTipo, string> = {
  deposito: 'Depósito',
  saque: 'Saque',
  aposta: 'Aposta',
  ganho: 'Ganho',
  ajuste: 'Ajuste',
  taxa: 'Taxa',
};

const TIPO_COR: Record<OperacaoTipo, string> = {
  deposito: 'text-emerald-400',
  ganho: 'text-emerald-400',
  saque: 'text-red-400',
  aposta: 'text-red-400',
  taxa: 'text-red-400',
  ajuste: 'text-gold-300',
};

export default function ExtratoClient(): JSX.Element {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [operacoesRows, setOperacoesRows] = useState<OperacaoRow[]>([]);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);

  // Formulário de nova operação
  const [tipo, setTipo] = useState<OperacaoTipo>('deposito');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('operacoes')
      .select('*')
      .eq('usuario_id', uid)
      .order('data', { ascending: false })
      .limit(200);
    setOperacoesRows(data ?? []);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCarregando(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      if (!session) {
        router.replace('/login');
        return;
      }
      setEmailUsuario(session.user.email ?? null);

      // Garante que existe um registro em `usuarios` para este auth user
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      let uid = perfil?.id ?? null;

      if (!uid) {
        const { data: novoPerfil } = await supabase
          .from('usuarios')
          .insert({
            auth_user_id: session.user.id,
            nome: session.user.email?.split('@')[0] ?? 'Usuário',
            email: session.user.email ?? '',
          })
          .select('id')
          .single();
        uid = novoPerfil?.id ?? null;
      }

      if (!active) return;
      setUsuarioId(uid);
      if (uid) await carregarDados(uid);
      setCarregando(false);
    });

    return () => {
      active = false;
    };
  }, [router, carregarDados]);

  // Realtime: escuta novas operações e atualiza a lista automaticamente
  useEffect(() => {
    if (!isSupabaseConfigured || !usuarioId) return;

    const channel = supabase
      .channel('operacoes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operacoes', filter: `usuario_id=eq.${usuarioId}` },
        () => {
          void carregarDados(usuarioId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [usuarioId, carregarDados]);

  const operacoesParaSaldo: Operacao[] = useMemo(
    () =>
      operacoesRows.map((r) => ({
        tipo: r.tipo,
        valor: r.valor,
        descricao: r.descricao,
      })),
    [operacoesRows],
  );

  const saldo = useMemo(() => calcularSaldo(operacoesParaSaldo), [operacoesParaSaldo]);

  const totalDepositos = useMemo(
    () =>
      operacoesRows
        .filter((r) => r.tipo === 'deposito')
        .reduce((acc, r) => acc + Math.abs(r.valor), 0),
    [operacoesRows],
  );

  const totalSaques = useMemo(
    () =>
      operacoesRows
        .filter((r) => r.tipo === 'saque')
        .reduce((acc, r) => acc + Math.abs(r.valor), 0),
    [operacoesRows],
  );

  async function handleLogout(): Promise<void> {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErroForm(null);

    if (!usuarioId) {
      setErroForm('Sessão inválida. Faça login novamente.');
      return;
    }

    const parsedValor = (() => {
      try {
        return parseBRL(valor);
      } catch {
        return NaN;
      }
    })();

    const validacao = operacaoSchema.safeParse({
      tipo,
      valor: parsedValor,
      descricao,
    });

    if (!validacao.success) {
      setErroForm(validacao.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from('operacoes').insert({
      usuario_id: usuarioId,
      tipo: validacao.data.tipo,
      valor: Math.abs(validacao.data.valor),
      descricao: validacao.data.descricao,
    });
    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar a operação. Tente novamente.');
      return;
    }

    setValor('');
    setDescricao('');
    await carregarDados(usuarioId);
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night-900 text-gold-400">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night-900 pb-16 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-night-700 bg-night-900/95 px-4 py-4 backdrop-blur md:px-8">
        <div>
          <h1 className="font-display text-xl font-bold text-gold-400">KAYG CPA</h1>
          {emailUsuario && <p className="text-xs text-white/50">{emailUsuario}</p>}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-night-600 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-gold-500 hover:text-gold-400"
        >
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-lg border border-gold-700/50 bg-gold-900/10 px-4 py-3 text-sm text-gold-300">
            Supabase não configurado. Configure as Secrets do repositório para usar o painel.
          </div>
        )}

        {/* Cards de resumo */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-night-700 bg-night-800 p-5">
            <p className="text-xs uppercase tracking-wide text-white/50">Saldo atual</p>
            <p className={`mt-2 text-2xl font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatBRL(saldo)}
            </p>
          </div>
          <div className="rounded-xl border border-night-700 bg-night-800 p-5">
            <p className="text-xs uppercase tracking-wide text-white/50">Total depositado</p>
            <p className="mt-2 text-2xl font-bold text-emerald-400">{formatBRL(totalDepositos)}</p>
          </div>
          <div className="rounded-xl border border-night-700 bg-night-800 p-5">
            <p className="text-xs uppercase tracking-wide text-white/50">Total sacado</p>
            <p className="mt-2 text-2xl font-bold text-red-400">{formatBRL(totalSaques)}</p>
          </div>
        </section>

        {/* Formulário de nova operação */}
        <section className="mt-8 rounded-xl border border-night-700 bg-night-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/80">Nova operação</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as OperacaoTipo)}
              className="rounded-lg border border-night-600 bg-night-700 px-3 py-3 text-sm text-white outline-none ring-gold-500 focus:ring-2"
            >
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <input
              type="text"
              inputMode="decimal"
              placeholder="Valor (ex: 150,00)"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="rounded-lg border border-night-600 bg-night-700 px-3 py-3 text-sm text-white outline-none ring-gold-500 focus:ring-2"
            />

            <input
              type="text"
              placeholder="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="rounded-lg border border-night-600 bg-night-700 px-3 py-3 text-sm text-white outline-none ring-gold-500 focus:ring-2 sm:col-span-1"
            />

            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-gold-500 px-3 py-3 text-sm font-semibold text-night-900 transition hover:bg-gold-400 disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Adicionar'}
            </button>
          </form>
          {erroForm && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {erroForm}
            </p>
          )}
        </section>

        {/* Tabela de extrato com rolagem horizontal no mobile */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-white/80">Extrato</h2>
          <div className="overflow-x-auto rounded-xl border border-night-700">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-night-700 bg-night-800 text-left text-xs uppercase tracking-wide text-white/50">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {operacoesRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-white/40">
                      Nenhuma operação registrada ainda.
                    </td>
                  </tr>
                ) : (
                  operacoesRows.map((op) => (
                    <tr key={op.id} className="border-b border-night-800 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-white/60">
                        {new Date(op.data).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 font-medium ${TIPO_COR[op.tipo]}`}>
                        {TIPO_LABEL[op.tipo]}
                      </td>
                      <td className="px-4 py-3 text-white/80">{op.descricao}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${TIPO_COR[op.tipo]}`}>
                        {formatBRL(op.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
