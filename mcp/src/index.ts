#!/usr/bin/env node
/**
 * ClawPhunks MCP Server
 *
 * Exposes ClawPhunks NFT minting and trading as MCP tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = 'https://clawphunks.vercel.app';
const ESCROW_CONTRACT = '0x3e67d49716e50a8b1c71b8dEa0e31755305733fd';

const server = new Server(
  {
    name: 'clawphunks',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_collection',
        description: 'Get ClawPhunks collection info including mint stats, rarity data, and trading instructions. Call this first to understand the collection.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'mint_phunk',
        description: 'Mint a random ClawPhunk NFT. Costs $1.99 USDC on Base via x402 protocol. Returns ethscription on Ethereum L1 plus gas stipend for trading. You may get a rare Alien (0.09%), Ape (0.24%), or Zombie (0.88%)!',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: {
              type: 'string',
              description: 'Ethereum address to receive the ClawPhunk (0x...)',
            },
          },
          required: ['recipient'],
        },
      },
      {
        name: 'get_rarity',
        description: 'Get full rarity information for ClawPhunks including all rare token IDs. Use this to understand which phunks are valuable.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_trading_instructions',
        description: 'Get instructions for trading ClawPhunks on the L1 escrow contract. Includes ABI and example code.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_collection': {
      const res = await fetch(`${API_BASE}/collection`);
      const data = await res.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    case 'mint_phunk': {
      const recipient = (args as { recipient: string }).recipient;

      if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Invalid recipient address. Must be a valid Ethereum address (0x...).',
            },
          ],
          isError: true,
        };
      }

      const res = await fetch(`${API_BASE}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient }),
      });

      if (res.status === 402) {
        const paymentInfo = await res.json();
        return {
          content: [
            {
              type: 'text',
              text: `Payment required: $1.99 USDC on Base via x402 protocol.\n\nPayment details:\n${JSON.stringify(paymentInfo, null, 2)}\n\nIf using Coinbase AgentKit, x402 is handled automatically.`,
            },
          ],
        };
      }

      const data = await res.json();

      if (!res.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Mint failed: ${data.error}`,
            },
          ],
          isError: true,
        };
      }

      // Check rarity
      const rareTypes = {
        aliens: [635, 2890, 3100, 3443, 5822, 5905, 6089, 7523, 7804],
        apes: [372, 1021, 2140, 2243, 2386, 2460, 2491, 2711, 2924, 4156, 4178, 4464, 5217, 5314, 5577, 5795, 6145, 6915, 6965, 7191, 8219, 8498, 9265, 9280],
        zombies: [117, 987, 1119, 1190, 1374, 1478, 1526, 1658, 1748, 1886, 1935, 2066, 2132, 2249, 2306, 2329, 2338, 2424, 2484, 2560, 2566, 2681, 2708, 2938, 2967, 3211, 3328, 3393, 3489, 3493, 3609, 3636, 3831, 4472, 4513, 4559, 4747, 4830, 4850, 4874, 5066, 5234, 5253, 5299, 5312, 5336, 5412, 5489, 5573, 5742, 5761, 5944, 6275, 6297, 6304, 6491, 6515, 6586, 6649, 6704, 6784, 7014, 7121, 7127, 7252, 7337, 7458, 7660, 7756, 7914, 8127, 8307, 8386, 8472, 8531, 8553, 8780, 8857, 8909, 8957, 9203, 9368, 9474, 9804, 9838, 9909, 9955, 9997],
      };

      let rarityNote = '';
      if (rareTypes.aliens.includes(data.tokenId)) {
        rarityNote = '\n\n🚨 LEGENDARY! You minted an ALIEN - only 9 exist (0.09%)! This is extremely valuable!';
      } else if (rareTypes.apes.includes(data.tokenId)) {
        rarityNote = '\n\n🦍 RARE! You minted an APE - only 24 exist (0.24%)! Very valuable!';
      } else if (rareTypes.zombies.includes(data.tokenId)) {
        rarityNote = '\n\n🧟 UNCOMMON! You minted a ZOMBIE - only 88 exist (0.88%)!';
      }

      return {
        content: [
          {
            type: 'text',
            text: `Successfully minted ClawPhunk #${data.tokenId}!${rarityNote}\n\nTransaction: ${data.txHash}\nEthscription ID: ${data.ethscriptionId}\nViewer: ${data.viewerUrl}\nGas stipend: ${data.gasStipendWei} wei (~$0.03 for trading)\n\nTo trade, use escrow contract: ${ESCROW_CONTRACT}`,
          },
        ],
      };
    }

    case 'get_rarity': {
      const rarity = {
        types: {
          Alien: {
            count: 9,
            percent: '0.09%',
            rank: '★★★★★ Legendary',
            tokenIds: [635, 2890, 3100, 3443, 5822, 5905, 6089, 7523, 7804],
          },
          Ape: {
            count: 24,
            percent: '0.24%',
            rank: '★★★★☆ Rare',
            tokenIds: [372, 1021, 2140, 2243, 2386, 2460, 2491, 2711, 2924, 4156, 4178, 4464, 5217, 5314, 5577, 5795, 6145, 6915, 6965, 7191, 8219, 8498, 9265, 9280],
          },
          Zombie: {
            count: 88,
            percent: '0.88%',
            rank: '★★★☆☆ Uncommon',
            tokenIds: [117, 987, 1119, 1190, 1374, 1478, 1526, 1658, 1748, 1886, 1935, 2066, 2132, 2249, 2306, 2329, 2338, 2424, 2484, 2560, 2566, 2681, 2708, 2938, 2967, 3211, 3328, 3393, 3489, 3493, 3609, 3636, 3831, 4472, 4513, 4559, 4747, 4830, 4850, 4874, 5066, 5234, 5253, 5299, 5312, 5336, 5412, 5489, 5573, 5742, 5761, 5944, 6275, 6297, 6304, 6491, 6515, 6586, 6649, 6704, 6784, 7014, 7121, 7127, 7252, 7337, 7458, 7660, 7756, 7914, 8127, 8307, 8386, 8472, 8531, 8553, 8780, 8857, 8909, 8957, 9203, 9368, 9474, 9804, 9838, 9909, 9955, 9997],
          },
          Female: { count: 3840, percent: '38.4%', rank: '★★☆☆☆ Common' },
          Male: { count: 6039, percent: '60.39%', rank: '★☆☆☆☆ Common' },
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
        note: 'Aliens, Apes, and Zombies are highly valuable due to extreme rarity. Check tokenIds arrays to identify rare phunks.',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rarity, null, 2),
          },
        ],
      };
    }

    case 'get_trading_instructions': {
      const instructions = {
        escrowContract: ESCROW_CONTRACT,
        chain: 'Ethereum L1',
        functions: {
          depositAndList: {
            description: 'List your phunk for sale',
            signature: 'depositAndList(bytes32 ethscriptionId, uint256 priceWei)',
            steps: [
              '1. Transfer ethscription to escrow contract (send tx with ethscription data)',
              '2. Call depositAndList with ethscription ID and price in wei',
            ],
          },
          buy: {
            description: 'Buy a listed phunk',
            signature: 'buy(bytes32 ethscriptionId) payable',
            note: 'Send msg.value equal to listing price',
          },
          cancelAndWithdraw: {
            description: 'Cancel your listing',
            signature: 'cancelAndWithdraw(bytes32 ethscriptionId)',
          },
          getListing: {
            description: 'Check if a phunk is listed and its price',
            signature: 'getListing(bytes32 ethscriptionId) view returns (bool active, address seller, uint256 price)',
          },
        },
        abi: [
          { name: 'depositAndList', type: 'function', inputs: [{ name: 'ethscriptionId', type: 'bytes32' }, { name: 'price', type: 'uint256' }] },
          { name: 'buy', type: 'function', stateMutability: 'payable', inputs: [{ name: 'ethscriptionId', type: 'bytes32' }] },
          { name: 'cancelAndWithdraw', type: 'function', inputs: [{ name: 'ethscriptionId', type: 'bytes32' }] },
          { name: 'getListing', type: 'function', stateMutability: 'view', inputs: [{ name: 'ethscriptionId', type: 'bytes32' }], outputs: [{ name: 'active', type: 'bool' }, { name: 'seller', type: 'address' }, { name: 'price', type: 'uint256' }] },
        ],
        marketplace: 'https://chainhost.online/clawphunks',
        etherscan: `https://etherscan.io/address/${ESCROW_CONTRACT}`,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(instructions, null, 2),
          },
        ],
      };
    }

    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ClawPhunks MCP server running');
}

main().catch(console.error);
