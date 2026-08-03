# How Does CKB Know You Own a Cell?

Cells are created by locking CKB tokens, but simply creating a cell doesn't mean anyone can spend it.

Every cell has ownership rules that determine **who is allowed to consume it**.

These rules are defined using **scripts**.

## Lock Script vs Type Script

Every cell can contain two scripts:

* **Lock Script** – controls who can spend the cell.
* **Type Script** – optional, controls how the cell's data can be modified.

Think of a cell as a storage box.

* The **lock script** is the padlock on the box.
* The **type script** is an additional set of rules the contents must satisfy.

A cell must always have a lock script, but the type script is optional.

---

## What Is a Script?

A script is simply:

* executable code
* parameters passed into that code

Whenever someone tries to spend a cell, CKB automatically executes the cell's scripts.

The scripts examine the transaction and decide whether the spending conditions have been satisfied.

If they are, the cell can be consumed.

If they are not, the transaction fails.

A script looks like this:

```rust
Script {
    code_hash: HexString,
    args: HexString,
    hash_type: Uint8
}
```

The important fields are:

### code_hash

The hash that identifies the script code.

Instead of storing the entire program inside every cell, CKB stores a hash that points to the code that should be executed.

### args

The input parameters passed to the script.

These can include things like:

* a public key
* an account identifier
* configuration values

The script uses these arguments together with the transaction data to decide whether the cell can be unlocked.

---

## How Unlocking Works

When a transaction attempts to consume a cell, CKB follows these steps:

1. Locate the script using `code_hash`.
2. Execute the script inside the **CKB Virtual Machine (CKB-VM)**.
3. Pass the script's `args` and transaction data into the program.
4. The script validates the unlocking conditions.

If the script returns:

* `0` → the cell is successfully unlocked.
* Any other value → the transaction is rejected.

Returning `0` simply means the unlocking conditions were satisfied.

---

## Proving Ownership

The most common lock script uses public-key cryptography.

When the cell is created:

* your public key is stored in the script arguments.

When you want to spend the cell:

* you sign the transaction using your private key.

The lock script verifies that:

* the signature is valid
* it matches the stored public key

If both checks pass, the script returns `0`, proving that the transaction was authorized by the owner of the cell.

Notice that your private key is never revealed. Only the signature is shared.

---

## Why Locks Matter

A lock script is what protects the value stored inside a cell.

If you create a cell with a lock script that allows anyone to unlock it, then anyone can spend your CKB.

In other words, you've created a cell that has no real owner.

For this reason, lock scripts are one of the most important parts of the Cell Model.

Without them, there would be no way to prove ownership or prevent someone else from spending your assets.

---

## Key Takeaways

* Every cell has a **lock script** that defines who can spend it.
* A **type script** is optional and defines rules for the cell's data.
* Scripts consist of executable code and input arguments.
* When a cell is spent, CKB automatically executes its scripts.
* A script returns `0` if the unlocking conditions are satisfied.
* Most lock scripts verify a digital signature against a stored public key.
* A poorly designed lock script can allow anyone to spend your cell.
