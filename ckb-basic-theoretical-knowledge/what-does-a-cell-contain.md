# What Does a Cell Contain?

Unlike Ethereum where storage is paid for with gas, **CKB treats storage itself as a scarce resource.**

Every piece of data stored on-chain occupies storage permanently, so the blockchain needs a way to account for that storage.

This is where **CKB tokens** come in.

On Nervos CKB:

> **1 CKB = 1 Byte of Permanent Storage**

Owning CKB isn't just owning a cryptocurrency it means owning a portion of the blockchain's storage capacity.

### Thinking About Cells

The easiest way to understand a cell is to imagine it as a **storage box**.

* CKB tokens build the box.
* The amount of CKB determines how large the box is.
* The box stores both data and ownership rules.

For example:

* 100 CKB gives you a box with **100 bytes** of storage.
* 500 CKB gives you **500 bytes** of storage.
* 1000 CKB gives you **1000 bytes** of storage.

A large box can also be split into many smaller boxes.

For example:

* 100 CKB → one 100-byte cell
* 100 CKB → two 50-byte cells
* 100 CKB → four 25-byte cells

As long as the total storage remains **100 bytes**, the network doesn't care how you organize it.

---

## Storage Is Expensive

The box cannot dedicate all of its space to your application data.

A cell itself contains metadata that also occupies storage.

For example, if a cell has:

* 100 bytes of capacity

You cannot store 100 bytes of user data because some bytes are already reserved for the cell structure itself.

Only the remaining space is available for your application.

This makes on-chain storage a valuable resource that should only be used for important information.

Imagine storing an entire novel on-chain.

A Chinese character (GBK encoding) occupies roughly **2 bytes**.

A novel with **780,000 characters** would require roughly:

780,000 × 2 = **1,560,000 bytes**

Since:

> 1 CKB = 1 Byte

You would need approximately:

**1,560,000 CKB**

just to store that single book.

This demonstrates why CKB storage is considered a scarce digital resource.

---

## Why Is It Called the Common Knowledge Base?

CKB stores consensus data permanently on-chain.

Any information stored inside cells becomes part of the blockchain's globally agreed state.

Instead of thinking of CKB as just another cryptocurrency, think of it as a decentralized database where everyone collectively owns and maintains the world's shared knowledge.

This is why CKB stands for:

> **Common Knowledge Base**

---

# Cell Structure

Every cell has four fields.

```rust
Cell {
    capacity: HexString,
    lock: Script,
    type: Script,
    data: HexString
}
```

Each field serves a different purpose.

## Capacity

The amount of storage owned by the cell.

It represents both:

* the number of CKB locked inside the cell
* the total number of bytes available for that cell

Capacity is usually represented in **Shannons**, where:

* 1 CKB = 100,000,000 Shannons

---

## Lock Script

The lock script controls **who is allowed to spend the cell**.

You can think of it as the padlock on the storage box.

If the unlocking conditions are not satisfied, the cell cannot be consumed.

---

## Type Script

The type script defines **how the cell behaves**.

Instead of controlling ownership, it controls the rules that the stored data must follow.

This is how custom assets, tokens, NFTs and application logic are implemented on CKB.

---

## Data

This is the payload.

The data field can store **any arbitrary bytes**, including:

* text
* images
* serialized objects
* token metadata
* application state
* smart contract data

The blockchain doesn't care what the bytes represent.

Only your application knows how to interpret them.

---

# Cell Capacity Rule

A cell's capacity must always be large enough to store every field inside it.

```
capacity >=
lock +
type +
data +
cell overhead
```

In other words,

> **A cell cannot occupy more bytes than the number of CKB it owns.**

If the occupied space exceeds the cell's capacity, the cell becomes invalid.

---

# Example

Suppose a cell has:

* Capacity = **80 CKB**

Since:

> 1 CKB = 1 Byte

the cell owns **80 bytes** of storage.

If the lock script, type script, and data together occupy:

* 61 bytes

the cell is valid.

```
Capacity:          80 Bytes
Actual Occupancy:  61 Bytes
Remaining Space:   19 Bytes
```

If additional data increases the total occupancy beyond **80 bytes**, the cell becomes invalid because it no longer has enough capacity to store itself.

---

## Key Takeaways

* A **cell** is the fundamental storage unit on CKB.
* **1 CKB = 1 Byte** of permanent blockchain storage.
* CKB tokens represent ownership of storage, not just currency.
* Every cell contains four fields:

  * Capacity
  * Lock Script
  * Type Script
  * Data
* The total size of the cell must never exceed its capacity.
* Large cells can be split into smaller cells while preserving the total storage owned.
