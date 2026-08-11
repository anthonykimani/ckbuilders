# Difference Between Lock Script and Type Script

Every cell on CKB has a **lock script**.

A cell can also have an optional **type script**.

Although they are both scripts, they serve different purposes.

* **Lock Script** controls **who** can spend a cell.
* **Type Script** controls **how** a cell can be used or transformed.

You can think of them as two different layers of validation.

---

## Lock Script: Who Can Spend the Cell?

The lock script protects ownership.

Its job is to answer a simple question:

> **Is this transaction authorized to spend this cell?**

Typically, it verifies something like:

* a digital signature
* a public key
* a multisig policy
* another ownership rule

If the lock script succeeds, the transaction has permission to consume the cell.

If it fails, the transaction is rejected.

In short:

> **Lock scripts enforce ownership.**

---

## Type Script: What Rules Must the Cell Follow?

A type script doesn't care who owns the cell.

Instead, it validates the application's business logic.

Its job is to answer questions like:

* Is this token transfer valid?
* Was the NFT updated correctly?
* Does the cell follow the application's rules?

Type scripts define how a cell is allowed to change as it moves from an input to an output.

---

## Examples

A type script can enforce almost any rule.

For example, it could require that:

* a cell always produces exactly one output cell
* a token's total supply never changes
* a balance can never become negative
* the cell's data never contains the word `"carrot"`

These rules have nothing to do with ownership.

They simply define the application's logic.

---

## The Main Difference

A useful way to think about the two scripts is:

* **Lock Script** protects the owner.
* **Type Script** protects the rules.

Or even more simply:

* **Lock Script** = **Who can spend?**
* **Type Script** = **What is allowed to happen?**

The lock script is the gatekeeper.

The type script is the guardian of the application's state.

---

## Execution Difference

Although lock and type scripts have the same structure, they are executed differently.

### Lock Scripts

Lock scripts are executed for **input cells**.

When a transaction spends a cell, its lock script must approve the spending.

---

### Type Scripts

Type scripts are executed for both:

* input cells
* output cells

This allows a type script to compare the previous state with the new state and verify that the transformation follows the application's rules.

---

## Script Grouping

CKB does not execute every script independently.

Instead, it groups cells that share the same script and executes that script only once for the entire group.

This reduces duplicated computation and improves transaction efficiency.

---

## Key Takeaways

* Every cell has a **lock script**.
* A **type script** is optional.
* Lock scripts verify **who is allowed to spend a cell**.
* Type scripts verify **how a cell is allowed to change**.
* Lock scripts execute on input cells.
* Type scripts execute on both input and output cells.
* CKB groups identical scripts together and executes each group only once.
