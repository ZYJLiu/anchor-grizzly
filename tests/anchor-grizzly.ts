import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { AnchorGrizzly } from "../target/types/anchor_grizzly"
import { assert } from "chai"
import { Metaplex } from "@metaplex-foundation/js"

describe("anchor-grizzly", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.AnchorGrizzly as Program<AnchorGrizzly>
  const connection = program.provider.connection
  const metaplex = Metaplex.make(connection)

  it("initialize", async () => {
    const MetadataProgramID = new anchor.web3.PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    )

    const mint = new anchor.web3.PublicKey(
      "GuGuSFXcdjMJyfHxsD5tZkZYiX45jieXHqFrfKoH8TdU"
    )

    const [pda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), MetadataProgramID.toBuffer(), mint.toBuffer()],
      MetadataProgramID
    )

    const metadataPDA = await metaplex.nfts().pdas().metadata({ mint: mint })

    const txHash = await program.methods
      .tokenMetadata()
      .accounts({
        metadataAccount: pda,
        mint: mint,
        signer: program.provider.publicKey,
      })
      .rpc()

    // Confirm transaction
    await connection.confirmTransaction(txHash)
    console.log(txHash)
  })

  it("initialize", async () => {
    // Generate keypair for the new account
    const newAccountKp = new anchor.web3.Keypair()

    // Send transaction
    const data = new anchor.BN(42)
    const txHash = await program.methods
      .initialize(data)
      .accounts({
        newAccount: null,
        signer: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    // Confirm transaction
    await connection.confirmTransaction(txHash)
    console.log(txHash)
  })

  it("initialize", async () => {
    // Generate keypair for the new account
    const newAccountKp = new anchor.web3.Keypair()

    // Send transaction
    const data = new anchor.BN(42)
    const txHash = await program.methods
      .initialize(data)
      .accounts({
        newAccount: newAccountKp.publicKey,
        signer: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([newAccountKp])
      .rpc()

    // Confirm transaction
    await connection.confirmTransaction(txHash)

    // Fetch the created account
    const newAccount = await program.account.newAccount.fetch(
      newAccountKp.publicKey
    )

    console.log("On-chain data is:", newAccount.data.toString())

    // Check whether the data on-chain is equal to local 'data'
    assert(data.eq(newAccount.data))
  })
})
