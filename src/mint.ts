/**
 * Ethscription minting for ClawPhunks
 * Inscribes pre-built data URI from Supabase to recipient
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  toHex,
} from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { GAS_STIPEND_WEI } from './config.js';

export interface MintResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

function getWalletClient() {
  const signerKey = process.env.SIGNER_PRIVATE_KEY;
  const rpcUrl = process.env.ETHEREUM_RPC_URL;

  if (!signerKey || !signerKey.startsWith('0x')) {
    throw new Error('SIGNER_PRIVATE_KEY not configured');
  }

  if (!rpcUrl) {
    throw new Error('ETHEREUM_RPC_URL not configured');
  }

  const account = privateKeyToAccount(signerKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  });

  return { account, publicClient, walletClient };
}

/**
 * Mint an ethscription to recipient
 * dataURI comes from Supabase (pre-built with ESIP6 format)
 */
export async function mintEthscription(
  recipient: string,
  dataURI: string
): Promise<MintResult> {
  const { publicClient, walletClient } = getWalletClient();

  // Encode data URI as hex calldata
  const calldataHex = toHex(new TextEncoder().encode(dataURI));

  try {
    const feeData = await publicClient.estimateFeesPerGas();

    // Send to recipient with gas stipend
    const txHash = await walletClient.sendTransaction({
      to: recipient as `0x${string}`,
      data: calldataHex,
      value: GAS_STIPEND_WEI,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    });

    await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    return { success: true, txHash };
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Mint failed' };
  }
}
