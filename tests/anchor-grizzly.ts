import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { AnchorGrizzly } from "../target/types/anchor_grizzly"
import { assert } from "chai"
import { Metaplex } from "@metaplex-foundation/js"
import {
  Metadata,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata"

describe("anchor-grizzly", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.AnchorGrizzly as Program<AnchorGrizzly>
  const connection = program.provider.connection
  const metaplex = Metaplex.make(connection)

  const [merchantPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("MERCHANT"), program.provider.publicKey.toBuffer()],
    program.programId
  )

  const [rewardPointsPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("REWARD_POINTS"), merchantPDA.toBuffer()],
    program.programId
  )

  const rewardPointsMetaData = {
    uri: "https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ",
    name: "NAME",
    symbol: "SYMBOL",
  }

  let metadataPDA: anchor.web3.PublicKey

  before(async () => {
    metadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: rewardPointsPDA })
  })

  it("initialize merchant", async () => {
    const txSig = await program.methods
      .initMerchant()
      .accounts({
        authority: program.provider.publicKey,
      })
      .rpc()

    const merchantAccount = await program.account.merchantState.fetch(
      merchantPDA
    )

    assert.isTrue(merchantAccount.authority.equals(program.provider.publicKey))
  })

  it("initialize reward points mint", async () => {
    const txSig = await program.methods
      .initRewardPoints(
        100,
        rewardPointsMetaData.uri,
        rewardPointsMetaData.name,
        rewardPointsMetaData.symbol
      )
      .accounts({
        authority: program.provider.publicKey,
        metadataAccount: metadataPDA,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc()

    // check merchant account updated
    const merchantAccount = await program.account.merchantState.fetch(
      merchantPDA
    )
    assert.isTrue(merchantAccount.rewardPointsMint.equals(rewardPointsPDA))
    assert.equal(merchantAccount.rewardPointsBasisPoints, 100)

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
  //       signer: program.provider.publicKey,
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
  //       signer: program.provider.publicKey,
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
  //       signer: program.provider.publicKey,
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
