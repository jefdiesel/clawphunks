# ClawPhunks Status - March 4, 2026

## What Works

### Minting (x402)
- **API**: `POST https://clawphunks.vercel.app/mint` with `{"recipient": "0x..."}`
- **Payment**: $1.99 USDC on Base via x402 (EIP-3009 signature)
- **Self-hosted facilitator**: Executes USDC transfer on Base, pays gas
- **Output**: Ethscription on L1 + gas stipend to recipient

### Collection Display
- **Page**: https://chainhost.online/clawphunks
- **Data source**: Ethscriptions AppChain RPC (`mainnet.ethscriptions.com`)
- **Contract**: `0x5ED5a160483462Bbb36cB30bA10f60Ea4708D839`
- **Stats**: Pulled from appchain `totalSupply()`

### Images
- All 10k phunks regenerated facing LEFT (like CryptoPhunks)
- Stored in Supabase as ESIP-6 data URIs with traits
- #9590 is the only right-facing phunk (minted before fix) - "legendary bug"

### Browser Minting
- Added EIP-3009 signature flow for browser users
- Switches to Base, signs USDC permit, calls mint API
- Wagmi config updated with Base chain

## Minted Items
- **#0**: Collection creator token
- **#9590**: First mint (right-facing, owned by test agent)
- **Total on-chain**: 2

## Test Agent Wallet
- **Address**: `0x6bbB3A99Be4311d39979fEA749EdE550b2563254`
- **Private Key**: `0x7c57f732c47aace25996dbcb8a918ab54f9c4a1786dbd76059156591cd8f662e`
- **Owns**: #9590
- **Status**: Ethscription deposited to escrow, NOT YET LISTED

## Escrow/Trading (IN PROGRESS)
- **Contract**: `0x3e67d49716e50a8b1c71b8dEa0e31755305733fd` (L1)
- **Functions**:
  - `depositAndList(bytes32 ethscriptionId, uint256 priceWei)`
  - `buy(bytes32 ethscriptionId)` payable
  - `cancelAndWithdraw(bytes32 ethscriptionId)`

### Current Issue
- Test agent deposited #9590 to escrow (tx: `0xb2de86e3a6b9579248e52a2038a94ff14fde7b25a6295bbd168ff2704652ad52`)
- `depositAndList` call keeps timing out on free RPCs
- Need to complete listing at 0.69 ETH
- Agent has ~$1.50 ETH for gas

## Key Addresses
- **Signer/Deployer**: `0xe16340DCB633FB386c324Eea219F2b3Ec59d4aC9`
- **USDC on Base**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Payment Recipient**: `0xe16340DCB633FB386c324Eea219F2b3Ec59d4aC9`

## Environment Variables (Vercel)
- `SIGNER_PRIVATE_KEY` - L1 minting wallet
- `ETHEREUM_RPC_URL` - L1 RPC
- `BASE_RPC_URL` - Base RPC (for facilitator)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` - Item database
- `PAYMENT_RECIPIENT` - Where USDC goes
- `FACILITATOR_URL` - Self-hosted at same domain

## TODO
1. Complete listing of #9590 (need working RPC or use Alchemy/Infura)
2. Test buy flow
3. Update skills page with complete listing instructions
4. Test browser mint end-to-end
5. Consider increasing gas stipend (currently ~3 cents, not enough for L1 listing)

## Files
- `/Users/jef/clawphunks/src/server.ts` - Main API
- `/Users/jef/clawphunks/src/facilitator.ts` - x402 facilitator
- `/Users/jef/clawphunks/src/mint.ts` - L1 minting
- `/Users/jef/clawphunks/src/db.ts` - Supabase
- `/Users/jef/chainhost/src/app/clawphunks/page.tsx` - Frontend
- `/Users/jef/chainhost/src/lib/wagmi.ts` - Wagmi config (includes Base)
