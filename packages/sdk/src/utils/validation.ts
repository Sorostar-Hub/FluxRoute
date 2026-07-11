/**
 * Validation helpers for FluxRoute SDK inputs.
 *
 * These are pure functions with no external dependencies, making them trivial
 * to unit-test and safe to use in browser contexts.
 */

import { StrKey } from '@stellar/stellar-sdk';

import type { Asset, CreateIntentParams } from '../types';

const ED25519_PUBLIC_KEY_LENGTH = 56;

/**
 * Validate that a string is a well-formed Stellar account address (G...).
 *
 * Does NOT validate contract addresses (C...) — use `isContractAddress` for that.
 */
export function isValidStellarAddress(address: string): boolean {
  if (typeof address !== 'string' || address.length !== ED25519_PUBLIC_KEY_LENGTH) {
    return false;
  }
  return StrKey.isValidEd25519PublicKey(address);
}

/** Validate that a string is a Soroban contract address (C...). */
export function isContractAddress(address: string): boolean {
  if (typeof address !== 'string') {
    return false;
  }
  return StrKey.isValidContract(address);
}

/** True for any Stellar address (account or contract). */
export function isAnyStellarAddress(address: string): boolean {
  return isValidStellarAddress(address) || isContractAddress(address);
}

/** Two assets are equal iff their type/code/issuer all match. */
export function assetsEqual(a: Asset, b: Asset): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === 'native' && b.type === 'native') {
    return true;
  }
  if (a.type !== 'native' && b.type !== 'native') {
    return a.code === b.code && a.issuer === b.issuer;
  }
  return false;
}

/**
 * Validate the parameters for `createIntent`. Returns `null` on success or an
 * error message string describing the first validation failure.
 */
export function validateCreateIntentParams(params: CreateIntentParams): string | null {
  if (!isValidStellarAddress(params.sender)) {
    return `sender must be a valid G... address, got "${params.sender}"`;
  }
  if (!isAnyStellarAddress(params.recipient)) {
    return `recipient must be a valid Stellar address, got "${params.recipient}"`;
  }
  if (params.sender === params.recipient) {
    return 'sender and recipient must be different addresses';
  }
  if (params.inputAmount <= 0n) {
    return `inputAmount must be positive, got ${params.inputAmount}`;
  }
  if (params.minOutputAmount < 0n) {
    return `minOutputAmount must be non-negative, got ${params.minOutputAmount}`;
  }
  if (assetsEqual(params.inputAsset, params.outputAsset)) {
    return 'inputAsset and outputAsset must be different';
  }
  if (params.deadline <= 0n) {
    return `deadline must be a positive ledger sequence, got ${params.deadline}`;
  }
  if (params.solverFeeBps !== undefined) {
    if (!Number.isInteger(params.solverFeeBps) || params.solverFeeBps < 0 || params.solverFeeBps > 10_000) {
      return `solverFeeBps must be an integer in [0, 10000], got ${params.solverFeeBps}`;
    }
  }
  return null;
}

/** Throw if `validateCreateIntentParams` returns an error. */
export function assertCreateIntentParams(params: CreateIntentParams): void {
  const error = validateCreateIntentParams(params);
  if (error !== null) {
    throw new Error(error);
  }
}
