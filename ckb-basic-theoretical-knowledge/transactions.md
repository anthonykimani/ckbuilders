# What Is a Transaction?

At its core, a transaction in CKB does one thing:

> **It consumes existing cells and creates new ones.**

You can think of it as transforming one set of cells into another.

```text
Inputs (Live Cells)
        │
        ▼
   Transaction
        │
        ▼
Outputs (New Live Cells)
```

The original input cells are destroyed, and the newly created output cells replace them.

---

## Inputs and Outputs

Every transaction consists of two main parts:

* **Inputs** – existing live cells that will be consumed.
* **Outputs** – new cells that will be created.

```text
Transaction

Inputs
    Cell A
    Cell B
    Cell C

        │
        ▼

Outputs
    Cell D
    Cell E
```

Once the transaction is confirmed:

* every input cell becomes a **dead cell**
* every output cell becomes a **live cell**

A cell can only be spent once.

After it becomes dead, it can never be used as an input again.

---

## Capacity Cannot Be Created

Every cell contains some amount of capacity (CKB).

A transaction must preserve that value.

The total capacity of all outputs can never exceed the total capacity of all inputs.

```text
Sum(Input Capacity)
>=
Sum(Output Capacity)
```

This prevents users from creating new CKB out of thin air.

The only way new CKB enters circulation is through the blockchain's issuance rules, not through normal transactions.

---

## Transaction Fees

Usually, the output capacity is slightly smaller than the input capacity.

The difference becomes the transaction fee paid to the miner.

```text
Input Capacity
-
Output Capacity
=
Transaction Fee
```

For example:

```text
Inputs:   500 CKB
Outputs:  499.9 CKB

Fee:        0.1 CKB
```

Miners collect this difference as payment for including the transaction in a block.

---

## How Are Inputs Referenced?

You might expect a transaction to include the full contents of every input cell.

Instead, it only stores a reference to each cell.

This reference is called an **OutPoint**.

```rust
OutPoint {
    tx_hash,
    index
}
```

An `OutPoint` identifies a cell using:

* `tx_hash` – the transaction that originally created the cell.
* `index` – the position of the cell within that transaction's outputs.

Using these two values, CKB can locate the exact cell that will be consumed.

This keeps transactions smaller since they only reference existing cells instead of copying all of their data.

---

## Cell Lifecycle

A cell moves through three stages during its lifetime.

```text
Created
    │
    ▼
Live Cell
    │
    ▼
Used as Transaction Input
    │
    ▼
Dead Cell
```

Once a live cell is consumed, it is permanently marked as dead.

If you still own funds after spending a cell, they exist inside one of the newly created output cells.

---

## Key Takeaways

* A transaction consumes existing **live cells** and creates new ones.
* Input cells become **dead cells** after the transaction is confirmed.
* Output cells become the new **live cells**.
* The total output capacity cannot exceed the total input capacity.
* The difference between inputs and outputs is the transaction fee.
* Transactions reference input cells using **OutPoints** instead of storing the entire cell.
