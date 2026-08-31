import { describe, it, expect } from 'vitest';
import {
  normalizeZero,
  toCents,
  fromCents,
  parseBRL,
  formatBRL,
  sumBRL,
  sumCents,
  subtractBRL,
  percentOf,
  zBRL,
  zBRLPositive,
  zBRLStrictPositive,
  operacaoSchema,
  calcularSaldo,
  type Operacao,
} from '../lib/money';

// ---------------------------------------------------------------------
// normalizeZero
// ---------------------------------------------------------------------
describe('normalizeZero', () => {
  it('converte -0 para 0', () => {
    expect(Object.is(normalizeZero(-0), -0)).toBe(false);
    expect(normalizeZero(-0)).toBe(0);
  });
  it('mantém 0 positivo como 0', () => {
    expect(normalizeZero(0)).toBe(0);
  });
  it('mantém valores positivos inalterados', () => {
    expect(normalizeZero(10.5)).toBe(10.5);
  });
  it('mantém valores negativos não-zero inalterados', () => {
    expect(normalizeZero(-10.5)).toBe(-10.5);
  });
  it('trata resultado de subtração que gera -0', () => {
    expect(normalizeZero(5 - 5)).toBe(0);
    expect(Object.is(normalizeZero(0 * -1), -0)).toBe(false);
  });
});

// ---------------------------------------------------------------------
// toCents / fromCents
// ---------------------------------------------------------------------
describe('toCents', () => {
  it('converte reais para centavos corretamente', () => {
    expect(toCents(1500.5)).toBe(150050);
    expect(toCents(10)).toBe(1000);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(0)).toBe(0);
  });
  it('converte valores negativos', () => {
    expect(toCents(-200)).toBe(-20000);
  });
  it('arredonda corretamente valores com imprecisão de ponto flutuante', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
  it('normaliza -0', () => {
    expect(Object.is(toCents(-0), -0)).toBe(false);
    expect(toCents(-0)).toBe(0);
  });
  it('lança erro para valores não finitos', () => {
    expect(() => toCents(NaN)).toThrow();
    expect(() => toCents(Infinity)).toThrow();
  });
});

describe('fromCents', () => {
  it('converte centavos para reais corretamente', () => {
    expect(fromCents(150050)).toBe(1500.5);
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(1)).toBe(0.01);
    expect(fromCents(0)).toBe(0);
  });
  it('converte valores negativos', () => {
    expect(fromCents(-20000)).toBe(-200);
  });
  it('normaliza -0', () => {
    expect(fromCents(-0)).toBe(0);
  });
  it('lança erro para valores não inteiros', () => {
    expect(() => fromCents(10.5)).toThrow();
  });
  it('é o inverso de toCents (round-trip)', () => {
    const valores = [0, 0.01, 1, 10.5, 1500.5, 999999.99, -200, -0.01];
    for (const v of valores) {
      expect(fromCents(toCents(v))).toBe(v);
    }
  });
});

// ---------------------------------------------------------------------
// parseBRL
// ---------------------------------------------------------------------
describe('parseBRL', () => {
  it('faz parse de number diretamente', () => {
    expect(parseBRL(1500.5)).toBe(1500.5);
    expect(parseBRL(0)).toBe(0);
    expect(parseBRL(-200)).toBe(-200);
  });

  it('faz parse de string decimal formato US/ISO sem transformar em milhar', () => {
    // Caso crítico explicitamente citado no requisito
    expect(parseBRL('1500.50')).toBe(1500.5);
    expect(parseBRL('1500.50')).not.toBe(150050);
    expect(parseBRL('10.00')).toBe(10);
    expect(parseBRL('0.50')).toBe(0.5);
  });

  it('faz parse de string formato BR com milhar e decimal', () => {
    expect(parseBRL('1.500,50')).toBe(1500.5);
    expect(parseBRL('10.000,00')).toBe(10000);
    expect(parseBRL('1.000.000,99')).toBe(1000000.99);
  });

  it('faz parse de string formato BR sem separador de milhar', () => {
    expect(parseBRL('1500,50')).toBe(1500.5);
    expect(parseBRL('1500,5')).toBe(1500.5);
    expect(parseBRL('0,99')).toBe(0.99);
  });

  it('faz parse de número inteiro puro (sem separador)', () => {
    expect(parseBRL('1500')).toBe(1500);
    expect(parseBRL('0')).toBe(0);
  });

  it('remove símbolo de moeda R$ e espaços', () => {
    expect(parseBRL('R$ 1.500,50')).toBe(1500.5);
    expect(parseBRL('R$1500,50')).toBe(1500.5);
    expect(parseBRL('  R$ 200,00  ')).toBe(200);
  });

  it('trata valores negativos com sinal de menos', () => {
    expect(parseBRL('-200,00')).toBe(-200);
    expect(parseBRL('-1.500,50')).toBe(-1500.5);
    expect(parseBRL('-1500.50')).toBe(-1500.5);
  });

  it('trata valores negativos em notação contábil (parênteses)', () => {
    expect(parseBRL('(200,00)')).toBe(-200);
    expect(parseBRL('(1.500,50)')).toBe(-1500.5);
  });

  it('lança erro para string vazia', () => {
    expect(() => parseBRL('')).toThrow();
    expect(() => parseBRL('   ')).toThrow();
  });

  it('lança erro para valores nulos/indefinidos', () => {
    expect(() => parseBRL(null)).toThrow();
    expect(() => parseBRL(undefined)).toThrow();
  });

  it('lança erro para string não numérica', () => {
    expect(() => parseBRL('abc')).toThrow();
    expect(() => parseBRL('R$ abc')).toThrow();
  });

  it('lança erro para number não finito', () => {
    expect(() => parseBRL(NaN)).toThrow();
    expect(() => parseBRL(Infinity)).toThrow();
  });

  it('faz parse de milhar com múltiplos pontos', () => {
    expect(parseBRL('1.000.000')).toBe(1000000);
  });

  it('arredonda para 2 casas decimais', () => {
    expect(parseBRL('10,999')).toBe(11);
    expect(parseBRL('10.994')).toBeCloseTo(10.99, 2);
  });
});

// ---------------------------------------------------------------------
// formatBRL
// ---------------------------------------------------------------------
describe('formatBRL', () => {
  it('formata valores positivos no padrão brasileiro', () => {
    expect(formatBRL(1500.5)).toBe('R$\u00A01.500,50');
    expect(formatBRL(10)).toBe('R$\u00A010,00');
    expect(formatBRL(0)).toBe('R$\u00A00,00');
  });

  it('formata valores negativos com sinal antes do R$', () => {
    const result = formatBRL(-200);
    expect(result.startsWith('-')).toBe(true);
    expect(result).toContain('200,00');
  });

  it('nunca exibe -R$ 0,00 para zero negativo', () => {
    const result = formatBRL(-0);
    expect(result.startsWith('-')).toBe(false);
    expect(result).toBe('R$\u00A00,00');
  });

  it('nunca exibe -R$ 0,00 para operações que resultam em -0', () => {
    const result = formatBRL(subtractBRL(100, 100));
    expect(result.startsWith('-')).toBe(false);
  });

  it('formata valores grandes com separador de milhar', () => {
    expect(formatBRL(1000000)).toBe('R$\u00A01.000.000,00');
  });

  it('lança erro para valores não finitos', () => {
    expect(() => formatBRL(NaN)).toThrow();
    expect(() => formatBRL(Infinity)).toThrow();
  });
});

// ---------------------------------------------------------------------
// sumBRL / sumCents
// ---------------------------------------------------------------------
describe('sumBRL', () => {
  it('soma valores decimais sem erro de ponto flutuante', () => {
    expect(sumBRL([0.1, 0.2])).toBe(0.3);
    expect(sumBRL([1500.5, 200.25, 10.01])).toBe(1710.76);
  });

  it('soma lista vazia retorna 0', () => {
    expect(sumBRL([])).toBe(0);
  });

  it('soma valores negativos e positivos, tratando -0', () => {
    expect(sumBRL([100, -100])).toBe(0);
    expect(Object.is(sumBRL([100, -100]), -0)).toBe(false);
  });

  it('não gera remessas truncadas ou zeradas incorretamente em somas grandes', () => {
    const valores = Array.from({ length: 100 }, () => 10.1);
    expect(sumBRL(valores)).toBe(1010);
  });

  it('lança erro para valor inválido na lista', () => {
    expect(() => sumBRL([10, NaN])).toThrow();
  });
});

describe('sumCents', () => {
  it('soma centavos inteiros corretamente', () => {
    expect(sumCents([100, 200, 300])).toBe(600);
  });
  it('normaliza -0 resultante', () => {
    expect(sumCents([100, -100])).toBe(0);
  });
  it('lança erro para valores não inteiros', () => {
    expect(() => sumCents([10.5])).toThrow();
  });
});

// ---------------------------------------------------------------------
// subtractBRL
// ---------------------------------------------------------------------
describe('subtractBRL', () => {
  it('subtrai valores corretamente', () => {
    expect(subtractBRL(1500.5, 500.25)).toBe(1000.25);
  });
  it('retorna 0 positivo quando resultado é zero', () => {
    const result = subtractBRL(100, 100);
    expect(result).toBe(0);
    expect(Object.is(result, -0)).toBe(false);
  });
  it('retorna negativo corretamente quando b > a', () => {
    expect(subtractBRL(100, 300)).toBe(-200);
  });
});

// ---------------------------------------------------------------------
// percentOf
// ---------------------------------------------------------------------
describe('percentOf', () => {
  it('calcula percentual corretamente', () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(1, 3)).toBeCloseTo(33.33, 2);
  });
  it('retorna 0 quando total é 0 (evita divisão por zero)', () => {
    expect(percentOf(50, 0)).toBe(0);
  });
  it('trata -0 no resultado', () => {
    expect(Object.is(percentOf(0, 100), -0)).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------
describe('zBRL', () => {
  it('aceita e transforma string válida', () => {
    const result = zBRL.safeParse('1.500,50');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(1500.5);
  });

  it('aceita e transforma number válido', () => {
    const result = zBRL.safeParse(200);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(200);
  });

  it('rejeita string inválida com issue customizada', () => {
    const result = zBRL.safeParse('abc');
    expect(result.success).toBe(false);
  });
});

describe('zBRLPositive', () => {
  it('aceita zero e positivos', () => {
    expect(zBRLPositive.safeParse(0).success).toBe(true);
    expect(zBRLPositive.safeParse(100).success).toBe(true);
  });
  it('rejeita negativos', () => {
    expect(zBRLPositive.safeParse(-1).success).toBe(false);
  });
});

describe('zBRLStrictPositive', () => {
  it('rejeita zero', () => {
    expect(zBRLStrictPositive.safeParse(0).success).toBe(false);
  });
  it('aceita positivos estritos', () => {
    expect(zBRLStrictPositive.safeParse(0.01).success).toBe(true);
  });
});

describe('operacaoSchema', () => {
  it('valida uma operação correta', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'deposito',
      valor: '1.500,50',
      descricao: 'Depósito inicial',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.valor).toBe(1500.5);
  });

  it('rejeita tipo inválido', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'invalido',
      valor: 100,
      descricao: 'Teste',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita descrição vazia', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'saque',
      valor: 100,
      descricao: '',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------
// calcularSaldo
// ---------------------------------------------------------------------
describe('calcularSaldo', () => {
  const base: Omit<Operacao, 'tipo' | 'valor'> = { descricao: 'op' };

  it('soma depósitos e ganhos, subtrai saques/apostas/taxas', () => {
    const operacoes: Operacao[] = [
      { ...base, tipo: 'deposito', valor: 1000 },
      { ...base, tipo: 'ganho', valor: 200 },
      { ...base, tipo: 'saque', valor: 300 },
      { ...base, tipo: 'aposta', valor: 100 },
      { ...base, tipo: 'taxa', valor: 10 },
    ];
    // 1000 + 200 - 300 - 100 - 10 = 790
    expect(calcularSaldo(operacoes)).toBe(790);
  });

  it('retorna 0 para lista vazia', () => {
    expect(calcularSaldo([])).toBe(0);
  });

  it('trata ajuste positivo e negativo mantendo o sinal informado', () => {
    const operacoes: Operacao[] = [
      { ...base, tipo: 'deposito', valor: 100 },
      { ...base, tipo: 'ajuste', valor: -50 },
    ];
    expect(calcularSaldo(operacoes)).toBe(50);
  });

  it('nunca retorna -0 quando o saldo líquido é zero', () => {
    const operacoes: Operacao[] = [
      { ...base, tipo: 'deposito', valor: 100 },
      { ...base, tipo: 'saque', valor: 100 },
    ];
    const saldo = calcularSaldo(operacoes);
    expect(saldo).toBe(0);
    expect(Object.is(saldo, -0)).toBe(false);
  });

  it('ignora o sinal informado em valores de saque/aposta/taxa (usa magnitude)', () => {
    const operacoes: Operacao[] = [
      { ...base, tipo: 'saque', valor: -300 }, // mesmo se vier negativo, deve subtrair 300
    ];
    expect(calcularSaldo(operacoes)).toBe(-300);
  });

  it('processa uma sequência longa de operações mistas sem perda de precisão', () => {
    const operacoes: Operacao[] = [
      { ...base, tipo: 'deposito', valor: 1000.33 },
      { ...base, tipo: 'aposta', valor: 50.11 },
      { ...base, tipo: 'aposta', valor: 50.11 },
      { ...base, tipo: 'ganho', valor: 120.22 },
      { ...base, tipo: 'taxa', valor: 5.5 },
      { ...base, tipo: 'saque', valor: 300 },
      { ...base, tipo: 'ajuste', valor: -0.99 },
    ];
    // 1000.33 - 50.11 - 50.11 + 120.22 - 5.5 - 300 - 0.99 = 713.84
    expect(calcularSaldo(operacoes)).toBeCloseTo(713.84, 2);
  });
});

// ---------------------------------------------------------------------
// Casos de borda adicionais / round-trip / precisão extendida
// ---------------------------------------------------------------------
describe('casos de borda de precisão decimal', () => {
  it('toCents/fromCents preservam valores de centavo único em toda a faixa 0-100', () => {
    for (let i = 0; i <= 100; i++) {
      const reais = i / 100;
      expect(fromCents(toCents(reais))).toBeCloseTo(reais, 2);
    }
  });

  it('soma 0.1 dez vezes resulta em 1.0 exato', () => {
    expect(sumBRL(Array(10).fill(0.1))).toBe(1);
  });

  it('soma 0.7 três vezes resulta em 2.1 exato (clássico erro de float)', () => {
    expect(sumBRL([0.7, 0.7, 0.7])).toBe(2.1);
  });

  it('parseBRL + toCents mantêm consistência para valores de aposta comuns', () => {
    const casos = ['10,00', '25,50', '100,00', '0,50', '1.234,56'];
    const esperados = [1000, 2550, 10000, 50, 123456];
    casos.forEach((c, i) => {
      expect(toCents(parseBRL(c))).toBe(esperados[i]);
    });
  });

  it('formatBRL(parseBRL(x)) é idempotente para valores típicos', () => {
    expect(formatBRL(parseBRL('1.500,50'))).toBe('R$\u00A01.500,50');
    expect(formatBRL(parseBRL('R$ 200,00'))).toBe('R$\u00A0200,00');
  });
});

describe('parseBRL - casos adicionais de entrada', () => {
  it('faz parse de valores com apenas um dígito decimal', () => {
    expect(parseBRL('10,5')).toBe(10.5);
    expect(parseBRL('10.5')).toBe(10.5);
  });

  it('faz parse de zero em diversos formatos', () => {
    expect(parseBRL('0')).toBe(0);
    expect(parseBRL('0,00')).toBe(0);
    expect(parseBRL('0.00')).toBe(0);
    expect(parseBRL('R$ 0,00')).toBe(0);
  });

  it('faz parse de valores muito grandes', () => {
    expect(parseBRL('1.000.000,00')).toBe(1000000);
    expect(parseBRL('999999.99')).toBeCloseTo(999999.99, 2);
  });

  it('faz parse de valores muito pequenos', () => {
    expect(parseBRL('0,01')).toBe(0.01);
    expect(parseBRL('0.01')).toBe(0.01);
  });

  it('ignora espaços extras ao redor do valor', () => {
    expect(parseBRL('  1500,50  ')).toBe(1500.5);
  });
});

describe('sumCents - casos adicionais', () => {
  it('soma lista vazia retorna 0', () => {
    expect(sumCents([])).toBe(0);
  });
  it('soma valores negativos corretamente', () => {
    expect(sumCents([-100, -200, -300])).toBe(-600);
  });
  it('soma um único valor retorna o próprio valor', () => {
    expect(sumCents([500])).toBe(500);
  });
});

describe('percentOf - casos adicionais', () => {
  it('retorna 100 quando part === total', () => {
    expect(percentOf(50, 50)).toBe(100);
  });
  it('retorna 0 quando part é 0', () => {
    expect(percentOf(0, 100)).toBe(0);
  });
  it('lida com percentuais acima de 100', () => {
    expect(percentOf(150, 100)).toBe(150);
  });
  it('lida com valores negativos', () => {
    expect(percentOf(-50, 100)).toBe(-50);
  });
});

describe('formatBRL - casos adicionais', () => {
  it('formata centavos únicos corretamente', () => {
    expect(formatBRL(0.01)).toBe('R$\u00A00,01');
  });
  it('formata valores com apenas uma casa decimal informada', () => {
    expect(formatBRL(10.5)).toBe('R$\u00A010,50');
  });
  it('formata corretamente após subtração que resulta em valor pequeno positivo', () => {
    expect(formatBRL(subtractBRL(10.01, 10))).toBe('R$\u00A00,01');
  });
});

describe('zBRL - validações adicionais', () => {
  it('rejeita valor nulo', () => {
    // @ts-expect-error teste de runtime para entrada inválida
    expect(zBRL.safeParse(null).success).toBe(false);
  });
  it('aceita valor zero', () => {
    expect(zBRL.safeParse('0,00').success).toBe(true);
  });
  it('transforma corretamente valores negativos válidos', () => {
    const result = zBRL.safeParse('-50,00');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(-50);
  });
});

describe('operacaoSchema - validações adicionais', () => {
  it('rejeita valor monetário inválido dentro do schema completo', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'deposito',
      valor: 'abc',
      descricao: 'Teste',
    });
    expect(result.success).toBe(false);
  });

  it('aceita todos os tipos de operação válidos', () => {
    const tipos = ['deposito', 'saque', 'aposta', 'ganho', 'ajuste', 'taxa'] as const;
    for (const tipo of tipos) {
      const result = operacaoSchema.safeParse({ tipo, valor: 10, descricao: 'ok' });
      expect(result.success).toBe(true);
    }
  });

  it('rejeita descrição acima do limite de 280 caracteres', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'deposito',
      valor: 10,
      descricao: 'a'.repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it('aceita data ISO opcional quando informada corretamente', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'deposito',
      valor: 10,
      descricao: 'ok',
      data: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejeita data em formato inválido', () => {
    const result = operacaoSchema.safeParse({
      tipo: 'deposito',
      valor: 10,
      descricao: 'ok',
      data: '31/08/2026',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Regressão: cenário de "extrato" completo (fluxo de ponta a ponta)
// ---------------------------------------------------------------------
describe('cenário de extrato completo (integração leve)', () => {
  it('calcula corretamente o saldo final de um extrato realista', () => {
    const entradas = [
      'R$ 1.000,00',
      'R$ 250,75',
      '-R$ 300,00',
      '(50,25)',
      '89.90',
    ];
    const valores = entradas.map((e) => parseBRL(e));
    const saldo = sumBRL(valores);
    // 1000 + 250.75 - 300 - 50.25 + 89.90 = 990.40
    expect(saldo).toBeCloseTo(990.4, 2);
    expect(formatBRL(saldo)).toBe('R$\u00A0990,40');
  });

  it('produz saldo positivo formatado sem sinal quando resultado é zero exato', () => {
    const valores = [parseBRL('500,00'), parseBRL('-500,00')];
    const saldo = sumBRL(valores);
    expect(saldo).toBe(0);
    expect(formatBRL(saldo)).toBe('R$\u00A00,00');
  });

  it('calcula percentual de progresso de meta de depósitos corretamente', () => {
    const metaTotal = parseBRL('5.000,00');
    const depositado = sumBRL([parseBRL('1.500,00'), parseBRL('1.000,00')]);
    expect(percentOf(depositado, metaTotal)).toBe(50);
  });
});
