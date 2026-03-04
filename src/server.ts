/**
 * ClawPhunks - NFT Mint Server for AI Agents
 *
 * x402 payment on Base → Ethscription minted on Ethereum L1 + gas stipend
 *
 * Endpoints:
 *   GET  /health      → Health check
 *   GET  /collection  → Collection info + agent instructions
 *   POST /mint        → Mint a random phunk (x402 gated)
 */

import express from 'express';
import cors from 'cors';
import { paymentMiddleware } from 'x402-express';
import {
  MINT_PRICE_USDC,
  COLLECTION,
  isTestnet,
  padId,
  GAS_STIPEND_WEI,
  ESCROW_CONTRACT,
} from './config.js';
import { mintEthscription } from './mint.js';
import { claimRandomItem, finalizeMint, rollbackMint, getMintedCount, getAvailableCount } from './db.js';

const app = express();

app.use(cors());
app.use(express.json());

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'clawphunks' });
});

// ─── Collection Info ──────────────────────────────────────────────────────────

app.get('/collection', async (_req, res) => {
  try {
    const [minted, available] = await Promise.all([
      getMintedCount(),
      getAvailableCount(),
    ]);

    const info = {
      name: COLLECTION.name,
      symbol: COLLECTION.symbol,
      description: COLLECTION.description,
      totalSupply: COLLECTION.totalSupply,
      minted,
      available,
      mintPrice: MINT_PRICE_USDC,
      mintCurrency: 'USDC',
      chain: COLLECTION.chain,
      collectionId: process.env.COLLECTION_ID ?? null,
      escrowContract: ESCROW_CONTRACT,
      rarity: {
        types: {
          Alien: { count: 9, percent: 0.09, rank: 5, tokenIds: [635, 2890, 3100, 3443, 5822, 5905, 6089, 7523, 7804] },
          Ape: { count: 24, percent: 0.24, rank: 4, tokenIds: [372, 1021, 2140, 2243, 2386, 2460, 2491, 2711, 2924, 4156, 4178, 4464, 5217, 5314, 5577, 5795, 6145, 6915, 6965, 7191, 8219, 8498, 9265, 9280] },
          Zombie: { count: 88, percent: 0.88, rank: 3, tokenIds: [117, 987, 1119, 1190, 1374, 1478, 1526, 1658, 1748, 1886, 1935, 2066, 2132, 2249, 2306, 2329, 2338, 2424, 2484, 2560, 2566, 2681, 2708, 2938, 2967, 3211, 3328, 3393, 3489, 3493, 3609, 3636, 3831, 4472, 4513, 4559, 4747, 4830, 4850, 4874, 5066, 5234, 5253, 5299, 5312, 5336, 5412, 5489, 5573, 5742, 5761, 5944, 6275, 6297, 6304, 6491, 6515, 6586, 6649, 6704, 6784, 7014, 7121, 7127, 7252, 7337, 7458, 7660, 7756, 7914, 8127, 8307, 8386, 8472, 8531, 8553, 8780, 8857, 8909, 8957, 9203, 9368, 9474, 9804, 9838, 9909, 9955, 9997] },
          Female: { count: 3840, percent: 38.4, rank: 2 },
          Male: { count: 6039, percent: 60.39, rank: 1 },
        },
        rareAccessories: {
          Beanie: 44,
          Choker: 48,
          'Pilot Helmet': 54,
          Tiara: 55,
          'Orange Side': 68,
          'Buck Teeth': 78,
          'Welding Goggles': 86,
          'Top Hat': 115,
          'Cowboy Hat': 142,
        },
        note: 'Rank 5 = legendary, 1 = common. Aliens/Apes/Zombies are highly valuable.',
      },
      agentInstructions: {
        mint: {
          endpoint: 'POST /mint',
          payment: `${MINT_PRICE_USDC} USDC on Base (x402)`,
          body: '{ "recipient": "0xYourAddress" }',
          returns: 'Random unminted phunk + gas stipend. Check rarity.types to see if you got a rare one!',
        },
        trade: {
          contract: ESCROW_CONTRACT,
          chain: 'Ethereum L1',
          list: 'depositAndList(bytes32 ethscriptionId, uint256 priceWei)',
          buy: 'buy(bytes32 ethscriptionId) payable',
          cancel: 'cancelAndWithdraw(bytes32 ethscriptionId)',
        },
        createWallet: `
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
// Store privateKey securely, use account.address for minting
        `.trim(),
      },
    };

    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── x402 Payment Middleware ──────────────────────────────────────────────────

const payToAddress = process.env.PAYMENT_RECIPIENT as `0x${string}`;

app.use(
  paymentMiddleware(payToAddress, {
    'POST /mint': {
      price: `$${MINT_PRICE_USDC}`,
      network: isTestnet ? 'base-sepolia' : 'base',
      config: {
        description: `ClawPhunks — mint random phunk (${MINT_PRICE_USDC} USDC) + gas stipend`,
      },
    },
  })
);

// ─── Mint (x402 Gated) ────────────────────────────────────────────────────────

app.post('/mint', async (req, res) => {
  try {
    const { recipient } = req.body;

    if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    // Claim a random unminted item from Supabase
    const { tokenId, dataURI } = await claimRandomItem(recipient);

    console.log(`[mint] Minting ClawPhunk #${padId(tokenId)} to ${recipient}`);

    // Inscribe to recipient
    const result = await mintEthscription(recipient, dataURI);

    if (!result.success || !result.txHash) {
      // Rollback - mark item as unminted
      await rollbackMint(tokenId);
      return res.status(500).json({ error: result.error ?? 'Mint failed' });
    }

    // Record tx hash
    await finalizeMint(tokenId, result.txHash);

    const response = {
      success: true,
      tokenId,
      txHash: result.txHash,
      ethscriptionId: result.txHash,
      recipient,
      gasStipendWei: GAS_STIPEND_WEI.toString(),
      viewerUrl: `https://ethscriptions.com/ethscriptions/${result.txHash}`,
      nextSteps: {
        trade: `Use escrow contract ${ESCROW_CONTRACT} on L1`,
        list: 'depositAndList(ethscriptionId, priceWei)',
        buy: 'buy(ethscriptionId) with msg.value = price',
      },
    };

    console.log(`[mint] ✓ #${padId(tokenId)} → ${recipient} | tx: ${result.txHash}`);
    res.json(response);
  } catch (err: any) {
    console.error('[mint] error:', err);
    res.status(500).json({ error: err.message ?? 'Mint failed' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`\nClawPhunks Mint Server`);
  console.log(`  Port       : ${PORT}`);
  console.log(`  Network    : ${isTestnet ? 'Base Sepolia' : 'Base'} (x402)`);
  console.log(`  Mint       : ${MINT_PRICE_USDC} USDC`);
  console.log(`  Gas stipend: ${Number(GAS_STIPEND_WEI) / 1e18} ETH`);
  console.log(`  Escrow     : ${ESCROW_CONTRACT}\n`);
});

export default app;
