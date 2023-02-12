import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { AnchorGrizzly } from "../target/types/anchor_grizzly"
import { assert } from "chai"

describe("anchor-grizzly", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.AnchorGrizzly as Program<AnchorGrizzly>

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
    await program.provider.connection.confirmTransaction(txHash)
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
    await program.provider.connection.confirmTransaction(txHash)

    // Fetch the created account
    const newAccount = await program.account.newAccount.fetch(
      newAccountKp.publicKey
    )

    console.log("On-chain data is:", newAccount.data.toString())

    // Check whether the data on-chain is equal to local 'data'
    assert(data.eq(newAccount.data))
  })
})
