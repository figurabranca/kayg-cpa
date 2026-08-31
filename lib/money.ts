/**
 * lib/money.ts
 * Núcleo matemático financeiro do KAYG CPA.
 *
 * Estratégia: todo valor monetário é representado internamente em
 * CENTAVOS (inteiro, BigInt-safe via number seguro até 2^53) para
 * evitar os erros clássicos de ponto flutuante (0.1 + 0.2 !== 0.3).
 *
 * Convenções:
 *  - `parseBRL(input)` converte string/number "humano" (ex: "1500.50",
 *     "1.500,50", 1500.5) para NUMBER em reais (não em centavos), pois
 *     é o formato mais usado nos formulários e no Supabase (numeric).
 *  - `toCents` / `fromCents` fazem a ponte entre reais e centavos
 *     inteiros para somas e agregações seguras.
 *  - `formatBRL` sempre recebe um valor em REAIS (não em centavos) e
 *     devolve a string formatada "R$ 1.500,50".
 *  - Qualquer -0 resultante de operações aritméticas é normalizado
 *     para 0 antes de retornar, sair de uma função pública ou ser
 *     persistido.
 */

import { z } from 'zod';

/** Normaliza -0 (zero negativo) para 0 positivo. */
export function normalizeZero(value: number): number {
  if (Object.is(value, -0)) return 0;
  // Também cobre casos como -0.00 vindos de subtrações que arredondam a zero
  if (value === 0) return 0;
  return value;
}

/** Arredonda para 2 casas decimais de forma segura (evita 1.005 -> 1.00). */
function round2(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return normalizeZero(rounded);
}

/**
 * Converte um valor em reais para centavos inteiros.
 * Ex: 1500.5 -> 150050
 */
export function toCents(reais: number): number {
  if (!Number.isFinite(reais)) {
    throw new Error(`toCents: valor inválido (${String(reais)})`);
  }
  const cents = Math.round(reais * 100);
  return normalizeZero(cents);
}

/**
 * Converte centavos inteiros de volta para reais.
 * Ex: 150050 -> 1500.5
 */
export function fromCents(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error(`fromCents: valor deve ser inteiro (${String(cents)})`);
  }
  return normalizeZero(round2(cents / 100));
}

/**
 * Faz o parse de uma entrada monetária "humana" (string ou number) e
 * retorna sempre um NUMBER em REAIS (não em centavos).
 *
 * Aceita:
 *  - number diretamente: 1500.5 -> 1500.5
 *  - string com ponto decimal (formato US/ISO): "1500.50" -> 1500.5
 *  - string com vírgula decimal e separador de milhar (formato BR):
 *      "1.500,50" -> 1500.5
 *      "1500,50"  -> 1500.5
 *  - string apenas com vírgula como decimal: "1500,5" -> 1500.5
 *  - valores negativos: "-200,00" -> -200
 *  - símbolo de moeda e espaços: "R$ 1.500,50" -> 1500.5
 *
 * IMPORTANTE: `parseBRL("1500.50")` deve retornar `1500.50`
 * (e nunca `150050.00` — esse é o bug clássico de tratar "." como
 * separador de milhar indevidamente).
 */
export function parseBRL(input: string | number | null | undefined): number {
  if (input === null || input === undefined) {
    throw new Error('parseBRL: valor não pode ser nulo/indefinido');
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`parseBRL: número inválido (${String(input)})`);
    }
    return normalizeZero(round2(input));
  }

  let raw = input.trim();
  if (raw === '') {
    throw new Error('parseBRL: string vazia');
  }

  // Remove símbolo de moeda e espaços
  raw = raw.replace(/R\$\s?/gi, '').trim();

  // Detecta sinal negativo (inclusive parênteses contábeis "(200,00)")
  let negative = false;
  if (raw.startsWith('-')) {
    negative = true;
    raw = raw.slice(1);
  } else if (raw.startsWith('(') && raw.endsWith(')')) {
    negative = true;
    raw = raw.slice(1, -1);
  }

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  let normalized: string;

  if (hasComma && hasDot) {
    // Formato BR: "1.500,50" -> ponto é milhar, vírgula é decimal
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    // Formato BR sem milhar: "1500,50" -> vírgula é decimal
    normalized = raw.replace(',', '.');
  } else if (hasDot && !hasComma) {
    // Pode ser decimal americano "1500.50" OU milhar BR sem decimal "1.500"
    // Heurística segura: se houver EXATAMENTE um ponto e os dígitos após
    // ele tiverem 1 ou 2 casas, tratamos como decimal (caso mais comum
    // em formulários e no requisito explícito: parseBRL("1500.50") -> 1500.50).
    // Se houver múltiplos pontos, ou o grupo após o último ponto tiver
    // exatamente 3 dígitos E existir mais de um agrupamento de milhar
    // plausível, tratamos como separador de milhar.
    const parts = raw.split('.');
    const lastGroup = parts[parts.length - 1] ?? '';
    if (parts.length > 2) {
      // múltiplos pontos => milhar: "1.500.000" -> 1500000
      normalized = parts.join('');
    } else if (lastGroup.length === 3 && parts[0] !== undefined && parts[0].length <= 3 && parts.length === 2 && /^\d{1,3}\.\d{3}$/.test(raw) === false) {
      // fallback abaixo, tratado como decimal por segurança
      normalized = raw;
    } else {
      normalized = raw;
    }
  } else {
    // Nem ponto nem vírgula: número inteiro puro
    normalized = raw;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`parseBRL: não foi possível interpretar "${input}"`);
  }

  const result = round2(parsed);
  return normalizeZero(negative ? -result : result);
}

/**
 * Formata um valor em REAIS para o padrão monetário brasileiro.
 * Ex: formatBRL(1500.5) -> "R$ 1.500,50"
 * Ex: formatBRL(-200)   -> "-R$ 200,00"
 *
 * Trata -0 explicitamente para nunca exibir "-R$ 0,00".
 */
export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`formatBRL: valor inválido (${String(value)})`);
  }
  const safe = normalizeZero(round2(value));
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe));

  if (safe < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Soma uma lista de valores em REAIS de forma segura (via centavos
 * inteiros, para evitar erro de ponto flutuante) e normaliza -0.
 */
export function sumBRL(values: readonly number[]): number {
  const totalCents = values.reduce((acc, v) => {
    if (!Number.isFinite(v)) {
      throw new Error(`sumBRL: valor inválido na lista (${String(v)})`);
    }
    return acc + toCents(v);
  }, 0);
  return fromCents(normalizeZero(totalCents));
}

/** Soma direta de valores já em centavos (inteiros). */
export function sumCents(values: readonly number[]): number {
  const total = values.reduce((acc, v) => {
    if (!Number.isInteger(v)) {
      throw new Error(`sumCents: valor deve ser inteiro (${String(v)})`);
    }
    return acc + v;
  }, 0);
  return normalizeZero(total);
}

/** Subtração segura em reais (via centavos). */
export function subtractBRL(a: number, b: number): number {
  return fromCents(normalizeZero(toCents(a) - toCents(b)));
}

/** Percentual seguro: calcula (part / total) * 100, tratando divisão por zero. */
export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  const pct = (part / total) * 100;
  return normalizeZero(round2(pct));
}

// ---------------------------------------------------------------------
// Schemas Zod para validação de entradas monetárias em formulários
// ---------------------------------------------------------------------

/** Schema Zod que aceita string ou number e transforma em number (reais) via parseBRL. */
export const zBRL = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    try {
      return parseBRL(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Valor monetário inválido',
      });
      return z.NEVER;
    }
  });

/** Schema Zod para valores monetários que devem ser >= 0 (ex: depósitos). */
export const zBRLPositive = zBRL.refine((v) => v >= 0, {
  message: 'O valor deve ser maior ou igual a zero',
});

/** Schema Zod para valores monetários estritamente positivos (> 0). */
export const zBRLStrictPositive = zBRL.refine((v) => v > 0, {
  message: 'O valor deve ser maior que zero',
});

export const operacaoTipoSchema = z.enum([
  'deposito',
  'saque',
  'aposta',
  'ganho',
  'ajuste',
  'taxa',
]);

export type OperacaoTipo = z.infer<typeof operacaoTipoSchema>;

export const operacaoSchema = z.object({
  tipo: operacaoTipoSchema,
  valor: zBRL,
  descricao: z.string().min(1, 'Descrição obrigatória').max(280),
  data: z.string().datetime().optional(),
});

export type Operacao = z.infer<typeof operacaoSchema>;

/**
 * Calcula o saldo líquido de uma lista de operações, considerando o
 * sinal de cada tipo: depósitos/ganhos somam, saques/apostas/taxas
 * subtraem. `ajuste` pode ser positivo ou negativo (valor já vem
 * com sinal correto do formulário).
 */
export function calcularSaldo(operacoes: readonly Operacao[]): number {
  const cents = operacoes.reduce((acc, op) => {
    const magnitude = toCents(op.valor);
    switch (op.tipo) {
      case 'deposito':
      case 'ganho':
        return acc + Math.abs(magnitude);
      case 'saque':
      case 'aposta':
      case 'taxa':
        return acc - Math.abs(magnitude);
      case 'ajuste':
        return acc + magnitude;
      default:
        return acc;
    }
  }, 0);
  return fromCents(normalizeZero(cents));
}
