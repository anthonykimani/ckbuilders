# Where Is the Script Code Stored?

Earlier, we learned that every cell can contain a **lock script** and an optional **type script**.

A script looks like this:

```rust id="vhx7di"
Script {
    code_hash: HexString,
    args: HexString,
    hash_type: Uint8
}
```

One thing stands out immediately.

The script does **not** contain the actual program. Instead, it only contains a `code_hash`, which is simply a reference to the code.

So where is the real code stored?

The answer is surprisingly simple.

> **The code is stored inside another cell.**

---

## Code Is Just Data

Remember that a cell's `data` field can store arbitrary bytes.

Compiled programs are just bytes, so they can also be stored inside a cell.

Instead of embedding the same program inside every lock or type script, CKB stores the compiled code once and lets every script reference it.

The cell containing the program is called a **CellDep** (Dependency Cell).

When a transaction runs a script, it includes the required dependency cell so CKB knows where to find the code.

---

## How CKB Finds the Code

A script identifies its code using two fields:

* `code_hash`
* `hash_type`

Together, these tell CKB how to locate the correct dependency cell.

There are two ways this can happen.

### 1. `hash_type = data` or `data1`

In this case, the `code_hash` must match the hash of the dependency cell's **data** field.

```text
code_hash = blake2b(dep_cell.data)
```

Since the compiled program is stored in the data field, CKB simply loads and executes it.

---

### 2. `hash_type = type`

In this case, the `code_hash` matches the hash of the dependency cell's **type script** instead.

```text
code_hash = blake2b(dep_cell.type_script)
```

This allows scripts to be located through their associated type script rather than their raw data.

---

## Script Execution Flow

Whenever a transaction spends a cell, CKB performs the following steps:

1. Read the script's `code_hash`.
2. Check the `hash_type`.
3. Search the transaction's dependency cells.
4. Find the matching code.
5. Load the program into **CKB-VM**.
6. Execute it using the provided `args` and transaction data.

Only after the script executes successfully can the cell be consumed.

---

## Why Store Code Separately?

This design avoids duplication.

Imagine every user wanted to use the same lock script.

Without dependency cells:

* every cell would need to store a copy of the same program
* storage usage would grow rapidly
* everyone would pay for identical code repeatedly

Instead, CKB stores the program once.

Every cell simply references it using its `code_hash`.

This makes transactions smaller, reduces storage costs, and allows many applications to reuse the same scripts.

---

## Example: Simple UDT

A good example is **Simple UDT (SUDT)**, one of the most widely used token standards on CKB.

Instead of every token storing its own implementation, they all reference the same SUDT type script through its `code_hash`.

Whenever a transaction interacts with an SUDT token:

* the transaction includes the SUDT dependency cell
* CKB loads the compiled SUDT program
* the program validates the token operation

Every token using SUDT shares the exact same implementation.

---

## Key Takeaways

* A script does **not** store executable code.
* The actual program is stored inside another cell called a **CellDep**.
* `code_hash` identifies which program should be executed.
* `hash_type` determines how CKB locates that program.
* Transactions include dependency cells so CKB can load the required scripts.
* Storing code once and referencing it many times reduces storage costs and promotes code reuse across the network.
