import * as anchor from "@project-serum/anchor"
import * as spl from "@solana/spl-token"
import { Program } from "@project-serum/anchor"
import { AnchorGrizzly } from "../target/types/anchor_grizzly"
import { assert } from "chai"
import { Metaplex } from "@metaplex-foundation/js"
import {
  Metadata,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata"
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet"
const fs = require("fs")

describe("anchor-grizzly", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())
  const wallet = anchor.workspace.AnchorGrizzly.provider.wallet
  const program = anchor.workspace.AnchorGrizzly as Program<AnchorGrizzly>
  const connection = program.provider.connection
  const metaplex = Metaplex.make(connection)

  const customer = anchor.web3.Keypair.generate()

  // merchant account
  const [merchantPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("MERCHANT"), wallet.publicKey.toBuffer()],
    program.programId
  )

  // merchant reward points mint
  const [rewardPointsPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("REWARD_POINTS"), merchantPDA.toBuffer()],
    program.programId
  )

  // merchant loyalty nft collection mint
  const [loyaltyCollectionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("LOYALTY_NFT"), merchantPDA.toBuffer()],
    program.programId
  )

  // merchant loyalty nft collection mint
  const [customerNftPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("LOYALTY_NFT"),
      merchantPDA.toBuffer(),
      customer.publicKey.toBuffer(),
    ],
    program.programId
  )

  // test nft metadata
  const testMetadata = {
    uri: "https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ",
    name: "NAME",
    symbol: "SYMBOL",
  }

  // customer account

  let usdcPlaceholderMint: anchor.web3.PublicKey
  let paymentDestination: anchor.web3.PublicKey
  let customerUsdcTokenAccount: anchor.web3.PublicKey
  let customerRewardTokenAccount: anchor.web3.PublicKey

  before(async () => {
    // get usdc placeholder mint keypair
    let key = fs.readFileSync(
      "1oveQg3XfAfY2Rw1SpwvTe5tVnaphWRXiNB9pcZE96c.json"
    )
    let keyJson = JSON.parse(key)
    let mintKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyJson))

    // create usdc placeholder mint
    usdcPlaceholderMint = await spl.createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0,
      mintKeypair
    )

    // get merchant payment destination token account
    paymentDestination = await spl.getAssociatedTokenAddress(
      usdcPlaceholderMint,
      wallet.publicKey
    )

    // create customer "usdc" token account
    customerUsdcTokenAccount = await spl.createAccount(
      connection,
      wallet.payer,
      usdcPlaceholderMint,
      customer.publicKey
    )

    // mint "usdc" tokens to customer
    await spl.mintTo(
      connection,
      wallet.payer,
      usdcPlaceholderMint,
      customerUsdcTokenAccount,
      wallet.payer,
      10000
    )

    // get customer reward points token account
    customerRewardTokenAccount = await spl.getAssociatedTokenAddress(
      rewardPointsPDA,
      customer.publicKey
    )

    const txSig = await connection.requestAirdrop(
      customer.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    )

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    await connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature: txSig,
      },
      "confirmed"
    )
  })

  it("initialize merchant", async () => {
    const txSig = await program.methods
      .initMerchant()
      .accounts({
        authority: wallet.publicKey,
        usdcMintPlaceholder: usdcPlaceholderMint,
        paymentDestination: paymentDestination,
      })
      .rpc()

    const merchantAccount = await program.account.merchantState.fetch(
      merchantPDA
    )

    assert.isTrue(merchantAccount.authority.equals(wallet.publicKey))
  })

  it("initialize reward points mint", async () => {
    // get metadata account for reward points mint
    const rewardPointsMetadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: rewardPointsPDA })

    const rewardPointsBasisPoints = 100
    const txSig = await program.methods
      .initRewardPoints(
        rewardPointsBasisPoints,
        testMetadata.uri,
        testMetadata.name,
        testMetadata.symbol
      )
      .accounts({
        authority: wallet.publicKey,
        metadataAccount: rewardPointsMetadataPDA,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc()

    // check merchant account updated
    const merchantAccount = await program.account.merchantState.fetch(
      merchantPDA
    )
    assert.isTrue(merchantAccount.rewardPointsMint.equals(rewardPointsPDA))
    assert.equal(
      merchantAccount.rewardPointsBasisPoints,
      rewardPointsBasisPoints
    )

    // check metadata account has expected data
    const accInfo = await connection.getAccountInfo(rewardPointsMetadataPDA)
    const metadata = Metadata.deserialize(accInfo.data, 0)

    assert.ok(
      metadata[0].data.uri.startsWith(testMetadata.uri),
      "URI in metadata does not start with expected URI"
    )
    assert.ok(
      metadata[0].data.name.startsWith(testMetadata.name),
      "Name in metadata does not start with expected name"
    )
    assert.ok(
      metadata[0].data.symbol.startsWith(testMetadata.symbol),
      "Symbol in metadata does not start with expected symbol"
    )
  })

  it("transaction", async () => {
    const tx = await program.methods
      .transaction(new anchor.BN(10000))
      .accounts({
        customer: customer.publicKey,
        authority: wallet.publicKey,
        merchant: merchantPDA,
        paymentDestination: paymentDestination,
        customerUsdcTokenAccount: customerUsdcTokenAccount,
        customerRewardTokenAccount: customerRewardTokenAccount,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [customer])

    assert.strictEqual(
      Number(
        (await connection.getTokenAccountBalance(customerUsdcTokenAccount))
          .value.amount
      ),
      0
    )

    assert.strictEqual(
      Number(
        (await connection.getTokenAccountBalance(customerRewardTokenAccount))
          .value.amount
      ),
      100
    )

    assert.strictEqual(
      Number(
        (await connection.getTokenAccountBalance(paymentDestination)).value
          .amount
      ),
      10000
    )
  })

  it("create collection nft", async () => {
    const loyaltyCollectionMetadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: loyaltyCollectionPDA })

    const loyaltyCollectionMasterEditionPDA = await metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: loyaltyCollectionPDA })

    const loyaltyCollectionTokenAccount = await spl.getAssociatedTokenAddress(
      loyaltyCollectionPDA,
      wallet.publicKey
    )

    // Instruction requires more compute units
    const modifyComputeUnits =
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 250_000,
      })

    const loyaltyDiscountBasisPoints = 100
    const tx = await program.methods
      .createCollectionNft(
        loyaltyDiscountBasisPoints,
        testMetadata.uri,
        testMetadata.name,
        testMetadata.symbol
      )
      .accounts({
        authority: wallet.publicKey,
        merchant: merchantPDA,
        loyaltyCollectionMint: loyaltyCollectionPDA,
        metadataAccount: loyaltyCollectionMetadataPDA,
        masterEdition: loyaltyCollectionMasterEditionPDA,
        tokenAccount: loyaltyCollectionTokenAccount,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .transaction()

    const transferTransaction = new anchor.web3.Transaction().add(
      modifyComputeUnits,
      tx
    )

    const txSig = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transferTransaction,
      [(wallet as NodeWallet).payer]
    )

    // check merchant account updated
    const merchantAccount = await program.account.merchantState.fetch(
      merchantPDA
    )
    assert.isTrue(
      merchantAccount.loyaltyCollectionMint.equals(loyaltyCollectionPDA)
    )
    assert.equal(
      merchantAccount.loyaltyDiscountBasisPoints,
      loyaltyDiscountBasisPoints
    )

    // check metadata account has expected data
    const accInfo = await connection.getAccountInfo(
      loyaltyCollectionMetadataPDA
    )
    const metadata = Metadata.deserialize(accInfo.data, 0)

    assert.ok(
      metadata[0].data.uri.startsWith(testMetadata.uri),
      "URI in metadata does not start with expected URI"
    )
    assert.ok(
      metadata[0].data.name.startsWith(testMetadata.name),
      "Name in metadata does not start with expected name"
    )
    assert.ok(
      metadata[0].data.symbol.startsWith(testMetadata.symbol),
      "Symbol in metadata does not start with expected symbol"
    )

    assert.isTrue(metadata[0].data.creators[0].address.equals(wallet.publicKey))
    assert.isTrue(metadata[0].data.creators[0].verified)
    assert.isTrue(metadata[0].collectionDetails.__kind === "V1")
  })

  it("create nft in collection", async () => {
    const loyaltyCollectionMetadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: loyaltyCollectionPDA })

    const loyaltyCollectionMasterEditionPDA = await metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: loyaltyCollectionPDA })

    const customerNftMetadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: customerNftPDA })

    const customerNftMasterEditionPDA = await metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: customerNftPDA })

    const customerNftTokenAccount = await spl.getAssociatedTokenAddress(
      customerNftPDA,
      customer.publicKey
    )

    // Instruction requires more compute units
    const modifyComputeUnits =
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      })

    const tx = await program.methods
      .createNftInCollection(
        testMetadata.uri,
        testMetadata.name,
        testMetadata.symbol
      )
      .accounts({
        customer: customer.publicKey,
        authority: wallet.publicKey,
        merchant: merchantPDA,
        loyaltyCollectionMint: loyaltyCollectionPDA,
        collectionMetadataAccount: loyaltyCollectionMetadataPDA,
        collectionMasterEdition: loyaltyCollectionMasterEditionPDA,
        customerNftMint: customerNftPDA,
        metadataAccount: customerNftMetadataPDA,
        masterEdition: customerNftMasterEditionPDA,
        tokenAccount: customerNftTokenAccount,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .transaction()

    const transferTransaction = new anchor.web3.Transaction().add(
      modifyComputeUnits,
      tx
    )

    const txSig = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transferTransaction,
      [customer]
    )

    // check metadata account has expected data
    const collectionAccInfo = await connection.getAccountInfo(
      loyaltyCollectionMetadataPDA
    )
    const collectionMetadata = Metadata.deserialize(collectionAccInfo.data, 0)
    assert.isTrue(
      // @ts-ignore
      collectionMetadata[0].collectionDetails.size.eq(new anchor.BN(1))
    )

    // check metadata account has expected data
    const accInfo = await connection.getAccountInfo(customerNftMetadataPDA)
    const metadata = Metadata.deserialize(accInfo.data, 0)

    assert.ok(
      metadata[0].data.uri.startsWith(testMetadata.uri),
      "URI in metadata does not start with expected URI"
    )
    assert.ok(
      metadata[0].data.name.startsWith(testMetadata.name),
      "Name in metadata does not start with expected name"
    )
    assert.ok(
      metadata[0].data.symbol.startsWith(testMetadata.symbol),
      "Symbol in metadata does not start with expected symbol"
    )
  })

  // it("initialize", async () => {
  //   const MetadataProgramID = new anchor.web3.PublicKey(
  //     "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  //   )

  //   const mint = new anchor.web3.PublicKey(
  //     "GuGuSFXcdjMJyfHxsD5tZkZYiX45jieXHqFrfKoH8TdU"
  //   )

  //   const [pda] = await anchor.web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("metadata"), MetadataProgramID.toBuffer(), mint.toBuffer()],
  //     MetadataProgramID
  //   )

  //   const rewardPointsMetadataPDA = await metaplex.nfts().pdas().metadata({ mint: mint })

  //   const txHash = await program.methods
  //     .tokenMetadata()
  //     .accounts({
  //       metadataAccount: pda,
  //       mint: mint,
  //       signer: wallet.publicKey,
  //     })
  //     .rpc()

  //   // Confirm transaction
  //   await connection.confirmTransaction(txHash)
  //   console.log(txHash)
  // })

  // it("initialize", async () => {
  //   // Generate keypair for the new account
  //   const newAccountKp = new anchor.web3.Keypair()

  //   // Send transaction
  //   const data = new anchor.BN(42)
  //   const txHash = await program.methods
  //     .initialize(data)
  //     .accounts({
  //       newAccount: null,
  //       signer: wallet.publicKey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .rpc()

  //   // Confirm transaction
  //   await connection.confirmTransaction(txHash)
  //   console.log(txHash)
  // })

  // it("initialize", async () => {
  //   // Generate keypair for the new account
  //   const newAccountKp = new anchor.web3.Keypair()

  //   // Send transaction
  //   const data = new anchor.BN(42)
  //   const txHash = await program.methods
  //     .initialize(data)
  //     .accounts({
  //       newAccount: newAccountKp.publicKey,
  //       signer: wallet.publicKey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([newAccountKp])
  //     .rpc()

  //   // Confirm transaction
  //   await connection.confirmTransaction(txHash)

  //   // Fetch the created account
  //   const newAccount = await program.account.newAccount.fetch(
  //     newAccountKp.publicKey
  //   )

  //   console.log("On-chain data is:", newAccount.data.toString())

  //   // Check whether the data on-chain is equal to local 'data'
  //   assert(data.eq(newAccount.data))
  // })
})
