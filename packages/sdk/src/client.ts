/**
 * `FluxRouteClient` — the primary integration surface for interacting with
 * the FluxRoute contracts on Stellar.
 *
 * Wraps the Soroban RPC `Server` and provides typed helpers for:
 *   - creating and reading intents (IntentRegistry)
 *   - submitting settlements (SolverSettlement)
 *
 * The client is wallet-agnostic: methods that require signing accept a
 * `signer` callback so any wallet (Freighter, Albedo, secret key) can be
 * plugged in.
 */

import {
  Address,
  Keypair,
  Networks,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import type {
  CreateIntentParams,
  Intent,
  IntentStatus,
  RouteStep,
  SettlementResult,
} from './types';
import { assetToScVal } from './utils/encoding';
import { assertCreateIntentParams } from './utils/validation';

/** Network configuration for a FluxRoute client. */
export interface FluxRouteNetwork {
  rpcUrl: string;
  networkPassphrase: string;
}

/** Pre-configured networks. */
export const NETWORKS = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
  },
  futurenet: {
    rpcUrl: 'https://rpc-futurenet.stellar.org:443',
    networkPassphrase: Networks.FUTURENET,
  },
} as const;

/**
 * A signer is an async function that receives the prepared transaction XDR
 * (base64) plus the network passphrase and returns the signed XDR (base64).
 *
 * Freighter's `signTransaction` matches this shape directly.
 */
export type Signer = (txXdr: string, networkPassphrase: string) => Promise<string>;

/** Options for constructing a `FluxRouteClient`. */
export interface FluxRouteClientOptions {
  /** Address of the deployed IntentRegistry contract. */
  intentRegistryContractId: string;
  /** Address of the deployed SolverSettlement contract. */
  solverSettlementContractId: string;
  network: FluxRouteNetwork | keyof typeof NETWORKS;
  /** Optional wallet signer. Required for write methods. */
  signer?: Signer;
}

const DEFAULT_FEE = '100';
const TX_TIMEOUT_SECONDS = 30;

/**
 * Build an `Operation` that invokes a contract function.
 */
function buildInvokeOp(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): xdr.Operation {
  const invokeArgs = new xdr.InvokeContractArgs({
    contractAddress: Address.fromString(contractId).toScAddress(),
    functionName: method,
    args,
  });
  const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs);
  const body = xdr.OperationBody.invokeHostFunction(
    new xdr.InvokeHostFunctionOp({ hostFunction, auth: [] }),
  );
  return new xdr.Operation({ sourceAccount: null, body });
}

/**
 * Convert a JSON object (from scValToNative) into a typed `Intent`.
 * Handles the snake_case -> camelCase mapping and bigint coercion.
 */
function parseIntent(raw: Record<string, unknown>): Intent {
  const status = (raw.status ?? 'Open') as IntentStatus;
  const filledBy =
    raw.filled_by === null || raw.filled_by === undefined
      ? null
      : String(raw.filled_by);
  return {
    id: BigInt(raw.id as string | number | bigint),
    sender: String(raw.sender),
    recipient: String(raw.recipient),
    inputAmount: BigInt(raw.input_amount as string | number | bigint),
    minOutputAmount: BigInt(raw.min_output_amount as string | number | bigint),
    deadline: BigInt(raw.deadline as string | number | bigint),
    status,
    filledBy,
    solverFeeBps: Number(raw.solver_fee_bps),
    // input_asset / output_asset are decoded by the caller where needed.
    inputAsset: { type: 'native' },
    outputAsset: { type: 'native' },
  };
}

export class FluxRouteClient {
  readonly server: rpc.Server;
  readonly intentRegistryContractId: string;
  readonly solverSettlementContractId: string;
  readonly network: FluxRouteNetwork;
  private readonly signer?: Signer;

  constructor(opts: FluxRouteClientOptions) {
    this.intentRegistryContractId = opts.intentRegistryContractId;
    this.solverSettlementContractId = opts.solverSettlementContractId;
    this.network =
      typeof opts.network === 'string' ? NETWORKS[opts.network] : opts.network;
    this.server = new rpc.Server(this.network.rpcUrl);
    this.signer = opts.signer;
  }

  // -----------------------------------------------------------------------
  // Low-level contract invocation
  // -----------------------------------------------------------------------

  /**
   * Build, simulate, sign, and submit a contract invocation transaction.
   * Returns the result ScVal decoded to a native JS value.
   */
  private async invoke<T = unknown>(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    sourceAddress: string,
    signer: Signer,
  ): Promise<T> {
    const account = await this.server.getAccount(sourceAddress);
    const op = buildInvokeOp(contractId, method, args);

    const tx = new TransactionBuilder(account, {
      fee: DEFAULT_FEE,
      networkPassphrase: this.network.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    const simulated = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulated)) {
      throw new Error(`simulate ${method} failed: ${simulated.error}`);
    }
    const prepared = rpc.assembleTransaction(tx, simulated).build();
    const signedXdr = await signer(prepared.toXDR(), this.network.networkPassphrase);
    const signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      this.network.networkPassphrase,
    );

    const response = await this.server.sendTransaction(signedTx);
    if (response.status === 'ERROR') {
      throw new Error(
        `Transaction submission failed: ${response.errorResult?.toString() ?? 'unknown'}`,
      );
    }
    return this.waitForResult<T>(response.hash);
  }

  /** Poll the RPC until a transaction is confirmed, then decode its result. */
  private async waitForResult<T>(txHash: string): Promise<T> {
    for (let i = 0; i < 60; i++) {
      const response = await this.server.getTransaction(txHash);
      if (response.status === 'SUCCESS') {
        const returnValue = response.returnValue;
        if (returnValue === undefined) {
          return undefined as T;
        }
        return scValToNative(returnValue) as T;
      }
      if (response.status === 'FAILED') {
        throw new Error(`Transaction ${txHash} failed on-chain`);
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error(`Transaction ${txHash} not confirmed after 60s`);
  }

  // -----------------------------------------------------------------------
  // Read methods (IntentRegistry)
  // -----------------------------------------------------------------------

  /** Fetch an intent by id. Throws if not found. */
  async getIntent(id: bigint): Promise<Intent> {
    const result = await this.simulateRead<Record<string, unknown>>(
      this.intentRegistryContractId,
      'get_intent',
      [nativeToScVal(id, { type: 'u64' })],
    );
    return parseIntent(result);
  }

  /** Total number of intents ever created. */
  async totalIntents(): Promise<bigint> {
    const result = await this.simulateRead<number | string | bigint>(
      this.intentRegistryContractId,
      'total_intents',
      [],
    );
    return BigInt(result);
  }

  /** Run a read-only simulation (no signing required). */
  private async simulateRead<T>(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<T> {
    const op = buildInvokeOp(contractId, method, args);
    // A read simulation does not need a real funded account; the RPC accepts
    // any valid public key as the source.
    const sourceKeypair = Keypair.random();
    const account = await this.server
      .getAccount(sourceKeypair.publicKey())
      .catch(() => {
        // Fallback minimal account-like object if the key has no on-chain state.
        return {
          accountId: () => sourceKeypair.publicKey(),
          sequenceNumber: () => '0',
          incrementedSequenceNumber: () => BigInt(1),
        };
      });

    const tx = new TransactionBuilder(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account as any,
      { fee: DEFAULT_FEE, networkPassphrase: this.network.networkPassphrase },
    )
      .addOperation(op)
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    const simulated = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulated)) {
      throw new Error(`simulateRead ${method} failed: ${simulated.error}`);
    }
    const returnValue = simulated.result?.retval;
    if (returnValue === undefined) {
      return undefined as T;
    }
    return scValToNative(returnValue) as T;
  }

  // -----------------------------------------------------------------------
  // Write methods
  // -----------------------------------------------------------------------

  /** Create and submit a new intent. Returns the new intent id. */
  async createIntent(params: CreateIntentParams): Promise<bigint> {
    assertCreateIntentParams(params);
    const signer = this.requireSigner();
    const args = [
      nativeToScVal(Address.fromString(params.sender).toScAddress()),
      nativeToScVal(Address.fromString(params.recipient).toScAddress()),
      assetToScVal(params.inputAsset),
      assetToScVal(params.outputAsset),
      nativeToScVal(params.inputAmount, { type: 'i128' }),
      nativeToScVal(params.minOutputAmount, { type: 'i128' }),
      nativeToScVal(params.deadline, { type: 'u64' }),
      nativeToScVal(params.solverFeeBps ?? 5, { type: 'u32' }),
    ];
    const id = await this.invoke<number | string | bigint>(
      this.intentRegistryContractId,
      'create_intent',
      args,
      params.sender,
      signer,
    );
    return BigInt(id);
  }

  /** Submit a settlement transaction on behalf of a registered solver. */
  async executeSettlement(
    solverAddress: string,
    intentId: bigint,
    route: RouteStep[],
    grossOutput: bigint,
    inputToken: string,
    outputToken: string,
  ): Promise<SettlementResult> {
    const signer = this.requireSigner();
    const routeScVals = route.map((step) =>
      nativeToScVal({
        protocol: step.protocol,
        pool: step.pool,
        input_asset: step.inputAsset,
        output_asset: step.outputAsset,
        amount_in: step.amountIn,
        amount_out: step.amountOut,
      }),
    );
    const args = [
      nativeToScVal(Address.fromString(solverAddress).toScAddress()),
      nativeToScVal(intentId, { type: 'u64' }),
      nativeToScVal(routeScVals),
      nativeToScVal(grossOutput, { type: 'i128' }),
      nativeToScVal(Address.fromString(inputToken).toScAddress()),
      nativeToScVal(Address.fromString(outputToken).toScAddress()),
    ];
    const result = await this.invoke<Record<string, unknown>>(
      this.solverSettlementContractId,
      'execute_settlement',
      args,
      solverAddress,
      signer,
    );
    return {
      intentId: BigInt(result.intent_id as string | number | bigint),
      grossOutput: BigInt(result.gross_output as string | number | bigint),
      solverFee: BigInt(result.solver_fee as string | number | bigint),
      netOutput: BigInt(result.net_output as string | number | bigint),
      solver: String(result.solver),
    };
  }

  /** Cancel an open intent. Only the sender may cancel. */
  async cancelIntent(senderAddress: string, intentId: bigint): Promise<void> {
    const signer = this.requireSigner();
    const args = [nativeToScVal(intentId, { type: 'u64' })];
    await this.invoke(
      this.intentRegistryContractId,
      'cancel_intent',
      args,
      senderAddress,
      signer,
    );
  }

  private requireSigner(): Signer {
    if (!this.signer) {
      throw new Error(
        'FluxRouteClient: a signer is required for write operations. ' +
          'Pass a `signer` to the constructor (e.g. Freighter signTransaction).',
      );
    }
    return this.signer;
  }
}
