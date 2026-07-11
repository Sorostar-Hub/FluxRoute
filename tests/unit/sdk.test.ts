import {
  decimalToStroops,
  stroopsToDecimal,
  toStroops,
  fromStellarAsset,
  toStellarAsset,
  assetToScVal,
  scValToAsset,
} from '../../packages/sdk/src/utils/encoding';
import {
  isValidStellarAddress,
  isContractAddress,
  isAnyStellarAddress,
  assetsEqual,
  validateCreateIntentParams,
  assertCreateIntentParams,
} from '../../packages/sdk/src/utils/validation';
import { nativeToScVal } from '../../packages/sdk/node_modules/@stellar/stellar-sdk';

// A well-formed, valid Stellar account address (G...).
const VALID_G = 'GDVXC7TGO3W5IDZTUYYJBITZJNBKL54P6RUOVMS5VJ2H3K5DZ462FDU4';
// A well-formed Soroban contract address (C...).
const VALID_C = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4'; // 56 chars, valid checksum
// A different valid account address used as the recipient.
const RECIPIENT = 'GDCMUKBLXKTY6QZFFDIAGV4IS7FOM2GU7GJL45K2AITRU7LXGLVT44TT';
// A fourth valid account address used as the asset issuer.
const ISSUER = 'GB7ENOFBJHMQOCDTXLV7ZEOIHGHUJYGLLOPXGTFQUFQHU4GRSTEG6UYJ';
// A fifth valid account address used as a second issuer.
const ISSUER2 = 'GATAGYEHBXTUT3UOYUAQPRBHIZDD7666IZDWNETPWO23HQB3R4PPQTSG';

const NATIVE = { type: 'native' } as const;

function credit4(code: string, issuer: string) {
  return { type: 'credit4' as const, code, issuer };
}

describe('encoding: decimalToStroops / stroopsToDecimal', () => {
  it('round-trips whole numbers', () => {
    expect(decimalToStroops('100', 7)).toBe(1_000_000_000n);
    expect(stroopsToDecimal(1_000_000_000n, 7)).toBe('100.0000000');
    expect(stroopsToDecimal(1_000_000_000n, 7, true)).toBe('100');
  });

  it('round-trips fractional amounts', () => {
    const stroops = decimalToStroops('1.2345678', 7);
    expect(stroops).toBe(12_345_678n);
    expect(stroopsToDecimal(stroops, 7)).toBe('1.2345678');
  });

  it('handles zero', () => {
    expect(decimalToStroops('0', 7)).toBe(0n);
    expect(decimalToStroops('0.0', 7)).toBe(0n);
    expect(stroopsToDecimal(0n, 7)).toBe('0.0000000');
    expect(stroopsToDecimal(0n, 7, true)).toBe('0');
  });

  it('handles max i128', () => {
    const max = (1n << 127n) - 1n; // 170141183460469231731687303715884105727n
    // With 0 decimals the stroops value IS the decimal value.
    expect(stroopsToDecimal(max, 0)).toBe(max.toString());
    expect(decimalToStroops(max.toString(), 0)).toBe(max);
    // Round-trip with 7 decimals preserves the value.
    const decimal7 = stroopsToDecimal(max, 7);
    expect(decimalToStroops(decimal7, 7)).toBe(max);
  });

  it('pads short fractions to full precision', () => {
    expect(decimalToStroops('1.5', 7)).toBe(15_000_000n);
    expect(stroopsToDecimal(15_000_000n, 7)).toBe('1.5000000');
  });

  it('truncates over-long fractions (does not round)', () => {
    // 1.23456789 with 7 decimals keeps the first 7 digits after the point.
    expect(decimalToStroops('1.23456789', 7)).toBe(12_345_678n);
  });

  it('supports 0-decimals assets', () => {
    expect(decimalToStroops('42', 0)).toBe(42n);
    expect(stroopsToDecimal(42n, 0)).toBe('42');
  });

  it('throws on negative values', () => {
    expect(() => decimalToStroops('-1', 7)).toThrow(/negative/);
    expect(() => stroopsToDecimal(-1n, 7)).toThrow(/negative/);
  });

  it('throws on malformed strings', () => {
    expect(() => decimalToStroops('abc', 7)).toThrow(/invalid decimal/);
    expect(() => decimalToStroops('', 7)).toThrow(/empty/);
    expect(() => decimalToStroops('1.2.3', 7)).toThrow(/invalid decimal/);
  });

  it('throws on invalid decimals param', () => {
    expect(() => stroopsToDecimal(1n, -1)).toThrow(/invalid decimals/);
    expect(() => stroopsToDecimal(1n, 1.5)).toThrow(/invalid decimals/);
  });

  it('throws on non-string / non-bigint input', () => {
    expect(() => decimalToStroops(123 as unknown as string, 7)).toThrow(/expected string/);
    expect(() => stroopsToDecimal(123 as unknown as bigint, 7)).toThrow(/expected bigint/);
  });

  it('toStroops accepts bigint, number, and string', () => {
    // bigint is assumed to already be in stroops and is returned as-is.
    expect(toStroops(100n, 7)).toBe(100n);
    // number and string are treated as decimal amounts and scaled by decimals.
    expect(toStroops(100, 7)).toBe(1_000_000_000n);
    expect(toStroops('100', 7)).toBe(1_000_000_000n);
  });
});

describe('encoding: fromStellarAsset / toStellarAsset', () => {
  it('round-trips native', () => {
    const asset = toStellarAsset(NATIVE);
    expect(asset.isNative()).toBe(true);
    expect(fromStellarAsset(asset)).toEqual(NATIVE);
  });

  it('round-trips a credit4 asset', () => {
    const sdk = credit4('USDC', ISSUER);
    const stellar = toStellarAsset(sdk);
    expect(stellar.getCode()).toBe('USDC');
    expect(stellar.getIssuer()).toBe(ISSUER);
    expect(fromStellarAsset(stellar)).toEqual(sdk);
  });

  it('round-trips a credit12 asset', () => {
    const code = 'TWELVECHAR12';
    const sdk = { type: 'credit12' as const, code, issuer: ISSUER };
    const stellar = toStellarAsset(sdk);
    expect(stellar.getCode()).toBe(code);
    expect(fromStellarAsset(stellar)).toEqual(sdk);
  });
});

describe('encoding: assetToScVal / scValToAsset', () => {
  it('round-trips native through ScVal', () => {
    const scv = assetToScVal(NATIVE);
    expect(scv).toBeDefined();
    const back = scValToAsset(scv);
    expect(back).toEqual(NATIVE);
  });

  it('round-trips a credit4 asset through ScVal', () => {
    const sdk = credit4('USDC', ISSUER);
    const scv = assetToScVal(sdk);
    expect(scv).toBeDefined();
    const back = scValToAsset(scv);
    expect(back).toEqual(sdk);
  });

  it('round-trips a credit12 asset through ScVal', () => {
    const sdk = { type: 'credit12' as const, code: 'TWELVECHAR12', issuer: ISSUER };
    const scv = assetToScVal(sdk);
    expect(scv).toBeDefined();
    const back = scValToAsset(scv);
    expect(back).toEqual(sdk);
  });

  it('throws on unparseable ScVal', () => {
    // A bare integer ScVal is not a valid asset representation.
    const bad = nativeToScVal(42);
    expect(() => scValToAsset(bad)).toThrow(/unparseable/);
  });
});

describe('validation: isValidStellarAddress', () => {
  it('accepts a valid G... account key', () => {
    expect(isValidStellarAddress(VALID_G)).toBe(true);
  });

  it('rejects an invalid key', () => {
    expect(isValidStellarAddress('G' + 'X'.repeat(55))).toBe(false);
    expect(isValidStellarAddress('not-an-address')).toBe(false);
    expect(isValidStellarAddress('')).toBe(false);
  });

  it('rejects a contract address (C...)', () => {
    expect(isValidStellarAddress(VALID_C)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidStellarAddress(123 as unknown as string)).toBe(false);
    expect(isValidStellarAddress(null as unknown as string)).toBe(false);
  });
});

describe('validation: isContractAddress / isAnyStellarAddress', () => {
  it('accepts a valid C... contract address', () => {
    expect(isContractAddress(VALID_C)).toBe(true);
  });

  it('rejects a G... account as a contract address', () => {
    expect(isContractAddress(VALID_G)).toBe(false);
  });

  it('isAnyStellarAddress accepts both G and C', () => {
    expect(isAnyStellarAddress(VALID_G)).toBe(true);
    expect(isAnyStellarAddress(VALID_C)).toBe(true);
    expect(isAnyStellarAddress('garbage')).toBe(false);
  });
});

describe('validation: assetsEqual', () => {
  it('native equals native', () => {
    expect(assetsEqual(NATIVE, NATIVE)).toBe(true);
  });

  it('credit assets equal when code and issuer match', () => {
    expect(assetsEqual(credit4('USDC', ISSUER), credit4('USDC', ISSUER))).toBe(true);
  });

  it('credit assets differ by code', () => {
    expect(assetsEqual(credit4('USDC', ISSUER), credit4('USDT', ISSUER))).toBe(false);
  });

  it('credit assets differ by issuer', () => {
    expect(
      assetsEqual(credit4('USDC', ISSUER), credit4('USDC', ISSUER2)),
    ).toBe(false);
  });

  it('native differs from credit', () => {
    expect(assetsEqual(NATIVE, credit4('USDC', ISSUER))).toBe(false);
  });
});

describe('validation: validateCreateIntentParams', () => {
  const base = {
    sender: VALID_G,
    recipient: RECIPIENT,
    inputAsset: NATIVE,
    outputAsset: credit4('USDC', ISSUER),
    inputAmount: 1_000_000_000n,
    minOutputAmount: 900_000_000n,
    deadline: 10_000n,
  };

  it('returns null for valid params', () => {
    expect(validateCreateIntentParams(base)).toBeNull();
  });

  it('returns null for valid params with explicit solverFeeBps', () => {
    expect(validateCreateIntentParams({ ...base, solverFeeBps: 5 })).toBeNull();
  });

  it('rejects an invalid sender address', () => {
    expect(validateCreateIntentParams({ ...base, sender: 'bad' })).toMatch(/sender/);
  });

  it('rejects an invalid recipient address', () => {
    expect(validateCreateIntentParams({ ...base, recipient: 'bad' })).toMatch(/recipient/);
  });

  it('rejects sender == recipient', () => {
    expect(
      validateCreateIntentParams({ ...base, recipient: VALID_G }),
    ).toMatch(/different/);
  });

  it('rejects zero input amount', () => {
    expect(validateCreateIntentParams({ ...base, inputAmount: 0n })).toMatch(/inputAmount/);
  });

  it('rejects negative input amount', () => {
    expect(validateCreateIntentParams({ ...base, inputAmount: -1n })).toMatch(/inputAmount/);
  });

  it('rejects negative min output', () => {
    expect(
      validateCreateIntentParams({ ...base, minOutputAmount: -1n }),
    ).toMatch(/minOutputAmount/);
  });

  it('rejects same input/output asset', () => {
    expect(
      validateCreateIntentParams({ ...base, outputAsset: NATIVE }),
    ).toMatch(/different/);
  });

  it('rejects past/zero deadline', () => {
    expect(validateCreateIntentParams({ ...base, deadline: 0n })).toMatch(/deadline/);
    expect(validateCreateIntentParams({ ...base, deadline: -1n })).toMatch(/deadline/);
  });

  it('rejects out-of-range solverFeeBps', () => {
    expect(
      validateCreateIntentParams({ ...base, solverFeeBps: -1 }),
    ).toMatch(/solverFeeBps/);
    expect(
      validateCreateIntentParams({ ...base, solverFeeBps: 10_001 }),
    ).toMatch(/solverFeeBps/);
    expect(
      validateCreateIntentParams({ ...base, solverFeeBps: 1.5 }),
    ).toMatch(/solverFeeBps/);
  });
});

describe('validation: assertCreateIntentParams', () => {
  const base = {
    sender: VALID_G,
    recipient: RECIPIENT,
    inputAsset: NATIVE,
    outputAsset: credit4('USDC', ISSUER),
    inputAmount: 1_000_000_000n,
    minOutputAmount: 900_000_000n,
    deadline: 10_000n,
  };

  it('does not throw for valid params', () => {
    expect(() => assertCreateIntentParams(base)).not.toThrow();
  });

  it('throws for invalid params', () => {
    expect(() => assertCreateIntentParams({ ...base, sender: 'bad' })).toThrow(/sender/);
  });
});
