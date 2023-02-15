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
const fs = require("fs")

describe("anchor-grizzly", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())
  const wallet = anchor.workspace.AnchorGrizzly.provider.wallet
  const program = anchor.workspace.AnchorGrizzly as Program<AnchorGrizzly>
  const connection = program.provider.connection
  const metaplex = Metaplex.make(connection)

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

  // metadata for reward points mint
  const rewardPointsMetaData = {
    uri: "https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ",
    name: "NAME",
    symbol: "SYMBOL",
  }

  // customer account
  const customer = anchor.web3.Keypair.generate()

  let metadataPDA: anchor.web3.PublicKey
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

    // airdrop sol to customer to pay for tx fees
    await connection.confirmTransaction(
      await connection.requestAirdrop(
        customer.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )

    // get metadata account for reward points mint
    metadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: rewardPointsPDA })
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
    const rewardPointsBasisPoints = 100
    const txSig = await program.methods
      .initRewardPoints(
        rewardPointsBasisPoints,
        rewardPointsMetaData.uri,
        rewardPointsMetaData.name,
        rewardPointsMetaData.symbol
      )
      .accounts({
        authority: wallet.publicKey,
        metadataAccount: metadataPDA,
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
    const accInfo = await connection.getAccountInfo(metadataPDA)
    const metadata = Metadata.deserialize(accInfo.data, 0)

    assert.ok(
      metadata[0].data.uri.startsWith(rewardPointsMetaData.uri),
      "URI in metadata does not start with expected URI"
    )
    assert.ok(
      metadata[0].data.name.startsWith(rewardPointsMetaData.name),
      "Name in metadata does not start with expected name"
    )
    assert.ok(
      metadata[0].data.symbol.startsWith(rewardPointsMetaData.symbol),
      "Symbol in metadata does not start with expected symbol"
    )
  })

  it("Transaction", async () => {
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

  //   const metadataPDA = await metaplex.nfts().pdas().metadata({ mint: mint })

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
