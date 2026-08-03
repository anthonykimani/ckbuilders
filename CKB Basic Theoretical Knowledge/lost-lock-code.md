# What Happens If a Script's Code Is Lost?

Scripts are usually stored inside **dependency cells (CellDeps)**.

This raises an important question.

> What happens if someone spends the cell that contains the script code?

If that dependency cell disappears, any script that references it would no longer be able to find its code.

In theory, that means the script cannot be executed, and any cell depending on it can no longer be unlocked.

Fortunately, CKB is designed to prevent this from becoming a problem.

---

## Built-in Scripts Can Never Be Destroyed

CKB's built-in lock scripts are stored in special cells that are intentionally impossible to spend.

Their lock script looks like this:

```rust id="pwvjlwm"
NeverUnlockableLock {
    code_hash: 0x000...000,
    hash_type: data,
    args: 0x
}
```

Because no transaction can satisfy this lock, these cells can never be consumed.

As a result:

* the script code remains on-chain forever
* every transaction can safely depend on it
* the code is guaranteed to remain available for the lifetime of the blockchain

This is how CKB ensures its native scripts are always accessible.

---

## What About Custom Scripts?

Application developers can deploy their own lock and type scripts.

Unlike built-in scripts, these dependency cells are not automatically protected.

If the dependency cell is accidentally spent, the original reference is lost.

However, this does **not** mean the script itself is gone forever.

Since the compiled program is just data, the developer can:

1. Deploy the exact same compiled code into a new cell.
2. Use that new cell as the dependency.
3. Update future transactions to reference the new dependency cell.

As long as the same code is redeployed, the script continues to work.

---

## Why This Works

A script is identified by its code, not by a specific transaction.

If the same compiled program is stored again, it can be reused just like the original.

The only thing that changes is which dependency cell the transaction references.

This makes script deployment flexible while still allowing code to be shared across many applications.

---

## Key Takeaways

* Script code is stored inside dependency cells.
* If a dependency cell is destroyed, scripts that reference it can no longer load that specific copy of the code.
* CKB's built-in scripts are stored in cells that can never be spent.
* Custom scripts can be redeployed if their dependency cell is lost.
* Future transactions simply reference the new dependency cell instead of the old one.
