/**
 * Encoding helpers: conversions between Stellar stroops (i128) and decimal
 * strings, and between the SDK `Asset` union and `@stellar/stellar-sdk` xdr
 * representations.
 *
 * All amounts in the SDK and on-chain are represented as `bigint` stroops.
 * Display layers convert to decimal strings for human readability.
 */

import { Address, Asset as StellarAsset, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';

import type { Asset } from '../types';

/**
 * Convert a decimal amount string (e.g. "100.1234567") to stroops as a bigint.
 * `decimals` is the asset's decimal precision (e.g. 7 for native XLM).
 *
 * Throws on malformed input or negative values.
 */
export function decimalToStroops(decimal: string, decimals: number = 7): bigint {
  if (typeof decimal !== 'string') {
    throw new Error(`decimalToStroops: expected string, got ${typeof decimal}`);
  }
  const trimmed = decimal.trim();
  if (trimmed === '') {
    throw new Error('decimalToStroops: empty string');
  }
  if (trimmed.startsWith('-')) {
    throw new Error(`decimalToStroops: negative values are not allowed (${decimal})`);
  }
  if (!/^\d*(\.\d*)?$/.test(trimmed)) {
    throw new Error(`decimalToStroops: invalid decimal string "${decimal}"`);
  }

  const [whole, fraction = ''] = trimmed.split('.');
  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  const stroopsStr = `${whole || '0'}${paddedFraction}`;
  const stroops = BigInt(stroopsStr);
  if (stroops < 0n) {
    throw new Error(`decimalToStroops: overflow/negative result (${stroops})`);
  }
  return stroops;
}

/**
 * Convert a stroops bigint to a decimal string with `decimals` precision.
 * Trailing zeros beyond the decimal precision are not stripped unless
 * `trimTrailingZeros` is true.
 */
export function stroopsToDecimal(stroops: bigint, decimals: number = 7, trimTrailingZeros: boolean = false): string {
  if (typeof stroops !== 'bigint') {
    throw new Error(`stroopsToDecimal: expected bigint, got ${typeof stroops}`);
  }
  if (stroops < 0n) {
    throw new Error(`stroopsToDecimal: negative values are not allowed (${stroops})`);
  }
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error(`stroopsToDecimal: invalid decimals (${decimals})`);
  }

  const sign = stroops < 0n ? '-' : '';
  const abs = stroops < 0n ? -stroops : stroops;
  const absStr = abs.toString();

  if (decimals === 0) {
    return `${sign}${absStr}`;
  }

  const padded = absStr.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  let fraction = padded.slice(padded.length - decimals);
  if (trimTrailingZeros) {
    fraction = fraction.replace(/0+$/, '');
  }
  return fraction === '' ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/** Round-trip a stroops value through bigint to validate it is in range. */
export function toStroops(value: bigint | number | string, decimals: number = 7): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return decimalToStroops(value.toString(), decimals);
  }
  return decimalToStroops(value, decimals);
}

/**
 * Encode an SDK `Asset` to a Soroban `ScVal` for cross-contract calls.
 *
 * The on-chain `Asset` enum is: Native | Alphanum4(BytesN<4>, Address) | Alphanum12(BytesN<12>, Address)
 */
export function assetToScVal(asset: Asset): xdr.ScVal {
  switch (asset.type) {
    case 'native':
      return nativeToScVal('native', { type: 'symbol' });
    case 'credit4': {
      const code = Buffer.from(asset.code.padEnd(4).slice(0, 4), 'ascii');
      return xdr.ScVal.scvVec([
        nativeToScVal('Alphanum4', { type: 'symbol' }),
        xdr.ScVal.scvBytes(code),
        nativeToScVal(Address.fromString(asset.issuer).toScVal()),
      ]);
    }
    case 'credit12': {
      const code = Buffer.from(asset.code.padEnd(12).slice(0, 12), 'ascii');
      return xdr.ScVal.scvVec([
        nativeToScVal('Alphanum12', { type: 'symbol' }),
        xdr.ScVal.scvBytes(code),
        nativeToScVal(Address.fromString(asset.issuer).toScVal()),
      ]);
    }
    default: {
      const _exhaustive: never = asset;
      throw new Error(`assetToScVal: unsupported asset type ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Decode a Soroban `ScVal` back to an SDK `Asset`.
 */
export function scValToAsset(val: xdr.ScVal): Asset {
  const native = scValToNative(val);
  if (native === 'native') {
    return { type: 'native' };
  }
  if (Array.isArray(native) && native.length === 3) {
    const [tag, codeBuf, issuerVal] = native as [string, Buffer, unknown];
    const issuer =
      typeof issuerVal === 'string'
        ? issuerVal
        : // Address instances expose toString()
          String(issuerVal);
    const code = Buffer.from(codeBuf).toString('ascii').trim();
    if (tag === 'Alphanum4') {
      return { type: 'credit4', code, issuer };
    }
    if (tag === 'Alphanum12') {
      return { type: 'credit12', code, issuer };
    }
  }
  throw new Error(`scValToAsset: unparseable asset ScVal`);
}

/**
 * Convert a stellar-sdk `Asset` instance to the SDK `Asset` union.
 */
export function fromStellarAsset(asset: StellarAsset): Asset {
  if (asset.isNative()) {
    return { type: 'native' };
  }
  const code = asset.getCode();
  const issuer = asset.getIssuer();
  return code.length <= 4
    ? { type: 'credit4', code, issuer }
    : { type: 'credit12', code, issuer };
}

/**
 * Convert the SDK `Asset` union to a stellar-sdk `Asset` instance.
 */
export function toStellarAsset(asset: Asset): StellarAsset {
  switch (asset.type) {
    case 'native':
      return StellarAsset.native();
    case 'credit4':
    case 'credit12':
      return new StellarAsset(asset.code, asset.issuer);
    default: {
      const _exhaustive: never = asset;
      throw new Error(`toStellarAsset: unsupported asset type ${JSON.stringify(_exhaustive)}`);
    }
  }
}
