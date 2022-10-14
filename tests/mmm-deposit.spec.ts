import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import {
  getAssociatedTokenAddress,
  getAccount as getTokenAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { assert } from 'chai';
import {
  Mmm,
  CurveKind,
  AllowlistKind,
  getMMMPoolPDA,
  getMMMBuysideSolEscrowPDA,
} from '../sdk/src';
import {
  createPool,
  getEmptyAllowLists,
  getMetaplexInstance,
  mintNfts,
} from './utils';

describe('mmm-deposit', () => {
  const { wallet, connection, opts } = anchor.AnchorProvider.env();
  opts.commitment = 'processed';
  const program = anchor.workspace.Mmm as Program<Mmm>;
  const cosigner = Keypair.generate();

  describe('Can deposit buyside sol mmm', () => {
    it('happy path', async () => {
      const { poolKey } = await createPool(program, {
        owner: wallet.publicKey,
        cosigner,
      });

      const { key: solEscrowKey } = getMMMBuysideSolEscrowPDA(
        program.programId,
        poolKey,
      );
      await program.methods
        .solDepositBuy({ paymentAmount: new anchor.BN(2 * LAMPORTS_PER_SOL) })
        .accountsStrict({
          owner: wallet.publicKey,
          cosigner: cosigner.publicKey,
          pool: poolKey,
          buysideSolEscrowAccount: solEscrowKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: cosigner.publicKey, isSigner: true, isWritable: false },
        ])
        .signers([cosigner])
        .rpc();

      assert.equal(
        await connection.getBalance(solEscrowKey),
        2 * LAMPORTS_PER_SOL,
      );
    });
  });

  describe('Can deposit buy side', () => {
    it('happy path - fvca only', async () => {
      const creator = Keypair.generate();
      const metaplexInstance = getMetaplexInstance(connection);
      const [{ poolKey }, nfts, sfts] = await Promise.all([
        createPool(program, {
          owner: wallet.publicKey,
          cosigner,
          allowlists: [
            { kind: AllowlistKind.fvca, value: creator.publicKey },
            ...getEmptyAllowLists(5),
          ],
        }),
        mintNfts(connection, {
          numNfts: 1,
          creators: [
            { address: creator.publicKey, share: 100, authority: creator },
          ],
        }),
        mintNfts(connection, {
          numNfts: 1,
          creators: [
            { address: creator.publicKey, share: 100, authority: creator },
          ],
        }),
      ]);

      let poolAccountInfo = await program.account.pool.fetch(poolKey);
      assert.equal(poolAccountInfo.sellsideOrdersCount.toNumber(), 0);

      const mintAddress1 = nfts[0].mintAddress;
      const poolAta1 = await getAssociatedTokenAddress(
        mintAddress1,
        poolKey,
        true,
      );
      await program.methods
        .depositSell({ assetAmount: new anchor.BN(1) })
        .accountsStrict({
          owner: wallet.publicKey,
          cosigner: cosigner.publicKey,
          pool: poolKey,
          assetMetadata: metaplexInstance
            .nfts()
            .pdas()
            .metadata({ mint: mintAddress1 }),
          assetMasterEdition: metaplexInstance
            .nfts()
            .pdas()
            .masterEdition({ mint: mintAddress1 }),
          assetMint: mintAddress1,
          assetTokenAccount: nfts[0].tokenAddress!,
          sellsideEscrowTokenAccount: poolAta1,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .remainingAccounts([
          { pubkey: cosigner.publicKey, isSigner: true, isWritable: false },
        ])
        .signers([cosigner])
        .rpc();

      const nftEscrow = await getTokenAccount(connection, poolAta1);
      assert.equal(Number(nftEscrow.amount), 1);
      assert.deepEqual(nftEscrow.owner, poolKey);
      poolAccountInfo = await program.account.pool.fetch(poolKey);
      assert.equal(poolAccountInfo.sellsideOrdersCount.toNumber(), 1);
      assert.equal(await connection.getBalance(nfts[0].tokenAddress!), 0);

      const mintAddress2 = sfts[0].mintAddress;
      const poolAta2 = await getAssociatedTokenAddress(
        mintAddress2,
        poolKey,
        true,
      );
      await program.methods
        .depositSell({ assetAmount: new anchor.BN(1) })
        .accountsStrict({
          owner: wallet.publicKey,
          cosigner: cosigner.publicKey,
          pool: poolKey,
          assetMetadata: metaplexInstance
            .nfts()
            .pdas()
            .metadata({ mint: mintAddress2 }),
          assetMasterEdition: metaplexInstance
            .nfts()
            .pdas()
            .masterEdition({ mint: mintAddress2 }),
          assetMint: mintAddress2,
          assetTokenAccount: sfts[0].tokenAddress!,
          sellsideEscrowTokenAccount: poolAta2,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .remainingAccounts([
          { pubkey: cosigner.publicKey, isSigner: true, isWritable: false },
        ])
        .signers([cosigner])
        .rpc();

      poolAccountInfo = await program.account.pool.fetch(poolKey);
      assert.equal(poolAccountInfo.sellsideOrdersCount.toNumber(), 2);
    });
  });
});