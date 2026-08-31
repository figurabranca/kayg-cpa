-- =====================================================================
-- KAYG CPA — Schema SQL completo (Supabase / Postgres)
-- Execute este arquivo inteiro no SQL Editor do painel Supabase.
-- =====================================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUM: tipos de operação financeira
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'operacao_tipo') then
    create type operacao_tipo as enum ('deposito', 'saque', 'aposta', 'ganho', 'ajuste', 'taxa');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- TABELA: usuarios
-- Perfil de aplicação vinculado ao auth.users do Supabase Auth.
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.usuarios is 'Perfis de aplicação (sócios) vinculados ao Supabase Auth.';

-- ---------------------------------------------------------------------
-- TABELA: operacoes
-- Lançamentos financeiros/operacionais (depósitos, saques, apostas, etc).
-- ---------------------------------------------------------------------
create table if not exists public.operacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo operacao_tipo not null,
  valor numeric(14, 2) not null check (valor >= 0),
  descricao text not null check (char_length(descricao) between 1 and 280),
  data timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_operacoes_usuario_data on public.operacoes (usuario_id, data desc);

comment on table public.operacoes is 'Lançamentos financeiros: depósitos, saques, apostas, ganhos, ajustes e taxas.';

-- ---------------------------------------------------------------------
-- TABELA: extrato
-- Snapshot do saldo após cada operação, para exibição rápida do histórico.
-- ---------------------------------------------------------------------
create table if not exists public.extrato (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  operacao_id uuid not null references public.operacoes (id) on delete cascade,
  saldo_apos numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_extrato_usuario_created on public.extrato (usuario_id, created_at desc);

comment on table public.extrato is 'Histórico de saldo após cada operação (materializado via trigger).';

-- ---------------------------------------------------------------------
-- TABELA: metas
-- Metas financeiras/operacionais (valor alvo e/ou quantidade de depósitos).
-- ---------------------------------------------------------------------
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 140),
  valor_alvo numeric(14, 2) not null check (valor_alvo >= 0),
  quantidade_alvo integer check (quantidade_alvo is null or quantidade_alvo > 0),
  quantidade_atual integer not null default 0,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.metas is 'Metas de valor e/ou quantidade de depósitos.';

-- ---------------------------------------------------------------------
-- TABELA: activity_feed
-- Feed de atividades (fan-out) para notificações em tempo real entre sócios.
-- ---------------------------------------------------------------------
create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo_evento text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_feed_usuario_created on public.activity_feed (usuario_id, created_at desc);

comment on table public.activity_feed is 'Feed de eventos (fan-out) para todos os sócios visualizarem em tempo real.';

-- =====================================================================
-- TRIGGER 1: checar_progresso_metas_qtd_dep
-- Ao inserir uma operação do tipo 'deposito', incrementa quantidade_atual
-- de todas as metas do usuário que têm quantidade_alvo definida, e marca
-- concluida = true quando o alvo (valor e/ou quantidade) é atingido.
-- =====================================================================
create or replace function public.checar_progresso_metas_qtd_dep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'deposito' then
    update public.metas
    set
      quantidade_atual = quantidade_atual + 1,
      concluida = (
        (quantidade_alvo is not null and quantidade_atual + 1 >= quantidade_alvo)
        or (
          valor_alvo > 0
          and valor_alvo <= (
            select coalesce(sum(
              case
                when o.tipo in ('deposito', 'ganho') then o.valor
                when o.tipo in ('saque', 'aposta', 'taxa') then -o.valor
                else o.valor
              end
            ), 0)
            from public.operacoes o
            where o.usuario_id = new.usuario_id
          )
        )
      )
    where usuario_id = new.usuario_id
      and concluida = false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checar_progresso_metas on public.operacoes;
create trigger trg_checar_progresso_metas
  after insert on public.operacoes
  for each row
  execute function public.checar_progresso_metas_qtd_dep();

-- =====================================================================
-- TRIGGER 2: fan-out do activity_feed
-- Ao inserir uma operação, gera automaticamente:
--   (a) uma linha em `extrato` com o saldo consolidado após a operação
--   (b) uma linha em `activity_feed` para todos os usuários (fan-out),
--       permitindo que ambos os sócios vejam o evento em tempo real.
-- =====================================================================
create or replace function public.fanout_activity_feed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric(14, 2);
  v_usuario record;
begin
  -- Calcula saldo consolidado do autor da operação
  select coalesce(sum(
    case
      when o.tipo in ('deposito', 'ganho') then o.valor
      when o.tipo in ('saque', 'aposta', 'taxa') then -o.valor
      else o.valor
    end
  ), 0)
  into v_saldo
  from public.operacoes o
  where o.usuario_id = new.usuario_id;

  insert into public.extrato (usuario_id, operacao_id, saldo_apos)
  values (new.usuario_id, new.id, v_saldo);

  -- Fan-out: replica o evento para TODOS os usuários da plataforma
  -- (visão compartilhada entre sócios).
  for v_usuario in select id from public.usuarios loop
    insert into public.activity_feed (usuario_id, tipo_evento, payload)
    values (
      v_usuario.id,
      'nova_operacao',
      jsonb_build_object(
        'operacao_id', new.id,
        'autor_id', new.usuario_id,
        'tipo', new.tipo,
        'valor', new.valor,
        'descricao', new.descricao,
        'data', new.data
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_fanout_activity_feed on public.operacoes;
create trigger trg_fanout_activity_feed
  after insert on public.operacoes
  for each row
  execute function public.fanout_activity_feed();

-- =====================================================================
-- VIEW: vw_saldo_atual
-- =====================================================================
create or replace view public.vw_saldo_atual as
select
  u.id as usuario_id,
  coalesce(sum(
    case
      when o.tipo in ('deposito', 'ganho') then o.valor
      when o.tipo in ('saque', 'aposta', 'taxa') then -o.valor
      else o.valor
    end
  ), 0) as saldo,
  now() as atualizado_em
from public.usuarios u
left join public.operacoes o on o.usuario_id = u.id
group by u.id;

-- =====================================================================
-- FUNÇÃO AUXILIAR: obter_saldo_usuario
-- =====================================================================
create or replace function public.obter_saldo_usuario(p_usuario_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case
      when o.tipo in ('deposito', 'ganho') then o.valor
      when o.tipo in ('saque', 'aposta', 'taxa') then -o.valor
      else o.valor
    end
  ), 0)
  from public.operacoes o
  where o.usuario_id = p_usuario_id;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Ambos os sócios enxergam os dados um do outro (visão compartilhada),
-- mas apenas usuários autenticados têm acesso.
-- =====================================================================
alter table public.usuarios enable row level security;
alter table public.operacoes enable row level security;
alter table public.extrato enable row level security;
alter table public.metas enable row level security;
alter table public.activity_feed enable row level security;

drop policy if exists "usuarios autenticados podem ver todos os perfis" on public.usuarios;
create policy "usuarios autenticados podem ver todos os perfis"
  on public.usuarios for select
  to authenticated
  using (true);

drop policy if exists "usuario pode atualizar o proprio perfil" on public.usuarios;
create policy "usuario pode atualizar o proprio perfil"
  on public.usuarios for update
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "usuario pode inserir o proprio perfil" on public.usuarios;
create policy "usuario pode inserir o proprio perfil"
  on public.usuarios for insert
  to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "autenticados veem todas as operacoes" on public.operacoes;
create policy "autenticados veem todas as operacoes"
  on public.operacoes for select
  to authenticated
  using (true);

drop policy if exists "autenticados inserem operacoes" on public.operacoes;
create policy "autenticados inserem operacoes"
  on public.operacoes for insert
  to authenticated
  with check (
    usuario_id in (select id from public.usuarios where auth_user_id = auth.uid())
  );

drop policy if exists "autenticados veem todo o extrato" on public.extrato;
create policy "autenticados veem todo o extrato"
  on public.extrato for select
  to authenticated
  using (true);

drop policy if exists "autenticados veem todas as metas" on public.metas;
create policy "autenticados veem todas as metas"
  on public.metas for select
  to authenticated
  using (true);

drop policy if exists "autenticados gerenciam metas" on public.metas;
create policy "autenticados gerenciam metas"
  on public.metas for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "autenticados veem o feed" on public.activity_feed;
create policy "autenticados veem o feed"
  on public.activity_feed for select
  to authenticated
  using (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()));

-- =====================================================================
-- REALTIME: habilita replicação para atualização em tempo real
-- =====================================================================
alter publication supabase_realtime add table public.operacoes;
alter publication supabase_realtime add table public.extrato;
alter publication supabase_realtime add table public.activity_feed;

-- =====================================================================
-- FIM DO SCHEMA
-- =====================================================================
