# CKB Builder Track - Week 11

Week Ending: 2026-11-06

## Work Completed

| Task | Status | Link |
| ---- | ------ | ---- |
| Shop-first mode | Done | `living-passport/public-web/` |
| Repair co-signed with JoyID | Done | [tx](https://testnet.explorer.nervos.org/transaction/0x028227e78a423e5ef46ffafcb68b9aeb76d22719687a397a2c0f5d305298fe15) |
| Shop names with `did:ckb` | Done | `living-passport/src/public-did.js` |
| Test on a laptop and a phone emulator | Done | Test wallets, local build |
| Publish a shop name with JoyID | Not yet | |
| Visit a second repair shop | Not yet | |

Live app: [ckbuilders-two.vercel.app](https://ckbuilders-two.vercel.app)

### Shop-first mode: `living-passport/public-web/`

A shop registers a walk-in device from its own wallet and holds the passport, so the customer doesn't need a wallet or a smartphone. This came from the Dflex visit last week.

What I learned:

- If the owner and the workshop are the same wallet, one signature already passes the contract, so I didn't need to redeploy
- Each device gets a printable QR card that anyone can scan without a wallet
- A customer with a wallet can request ownership through the inbox, and the shop hands it over in person
- After the hand-over, every repair needs both signatures again
- Added a shop ledger with In the shop, Collected and With owner filters, and search
- Added two contract tests, one for a shop-signed repair and one that rejects a forged actor

### Repair co-signed with JoyID

Last week this was not done. I ran the shop-first flow with my JoyID wallet as the customer and a test key as the shop on an Android emulator.

What I learned:

- The transaction hash stays the same from the shop's draft to the owner's approval, because witnesses aren't part of it
- Verified it end to end: registered the device, recorded a repair, handed it to my JoyID wallet, then approved a second repair with JoyID
- The QR code decoded from an emulator screenshot gave the exact passport link

Details:

- Device: Samsung Galaxy A14 / Ticket 0412
- Passport ID: `0x3d066fec30cf0270e64bec92a0a5b443d8e06bf14616a4b550a11db8198e489e00000000d80c812bfc5b23643dc8d46c47e553eec8b8d4bdff94eb309a26dde4ca11d3d8`
- Create tx: `0x90e6a2bcea81bb1ab09d2307fea0571a4ce3f7f22a48ce9ffe7ea3ec8b07ada9`
- Checked in tx: `0xd30e64a5cf5e96cdacf3172dea258a5040460a6ff19db6b284cdc0bb7cfa28d0`
- Shop repair tx: `0x28426e238f2132bba32b8a41094f1fa647f2aec62f80fa856fdab3ca6c0ca049`
- Hand-over tx: `0x90f45961d51a9c4bea6938b6e06d0b66a46b5816c8edf756c0694858b6131363`
- Co-signed repair tx: `0x028227e78a423e5ef46ffafcb68b9aeb76d22719687a397a2c0f5d305298fe15`

### Shop names with `did:ckb`: `living-passport/src/public-did.js`

A shop publishes its name and location as a `did:ckb`, and the app shows the name instead of a wallet code like `0xd80c81…`.

![Shop identity on the laptop](laptop-shop-identity.jpg)

What I learned:

- `did:ckb` is already a known script in CCC, so `@ckb-ccc/did-ckb` works with no new contract
- A DID is a cell with a Type ID, and the `did:ckb:` string is its 20-byte args in base32
- The document is CBOR in the cell data. I put the shop name under `services.living_passport`
- The cell holds about 260 CKB. You get it back when you remove the identity
- Anyone can create a DID cell under someone else's lock without their signature, so looking up a DID by wallet isn't enough
- The app only accepts a name if that lock also signed the transaction that wrote it
- Verified it on testnet: created a newer "Scam Shop" DID under the shop's lock from another wallet, and the app ignored it
- A DID proves the same wallet published the name, not that the name is true. The page says nobody has checked the names

Details:

- Forged DID tx: `0x7aa3ab62a3c51f08ce81271ecbd9dc8da9578e4284be7eee94c87d69769e3aae`
- Test shop DID: `did:ckb:qm4vrxwjn4btz22nbw57jc7rsygp5dko`, removed after the test
- Create tx: `0x6f085c392998cc56bbd0c40ebfba63980290fc9d05264af705a471b3a4c6ae08`
- Stack: `@ckb-ccc/did-ckb` 0.2.15, `@ckb-ccc/core` 1.23.0

### Test on a laptop and a phone emulator

The laptop browser was the shop and the Android emulator was the customer, both with test wallets on a local build. I wanted two emulators, but the second wouldn't start because my disk is almost full.

![Device registered on the laptop](laptop-registered.jpg)
![The passport on the phone after the repair](phone-passport.png)
![QR card on the phone](phone-qr-card.png)
![History on the laptop after the phone approved the repair](laptop-history.jpg)

| Step | Device | Result |
| ---- | ------ | ------ |
| Publish a shop name | Laptop | Pass |
| Register a device | Laptop | Pass |
| Open the passport and request ownership | Phone | Pass, name and DID show |
| Hand over | Laptop | Pass |
| Draft a repair | Laptop | Pass |
| Approve the repair | Phone | Pass, says "Drafted by Bench Test Repairs" |
| See the repair | Laptop | Pass, shows as event 4 |
| Close the passport and remove the name | Phone, laptop | Pass, CKB returned |

Details:

- Register tx: `0x6502afc7c01e652b37cc194603baa936a5ca982c611ae1b7544738a9c1daedb2`
- Hand-over tx: `0xe25f7359543f51a6181af7288466e4b1c3ff13129020d0d3e885660a3dd27d43`
- Repair tx: `0x301a6b2f2223a0a8c4a76657deaa31bc042399039801f640f4da2a276763eafb`
- Bug found: the shop card's content was off-centre and wrapped onto two lines. Fixed

## Tests

- 21 local tests pass, 6 of them new for `did:ckb`
- Two-phone browser test passes on public testnet, now with the shop flow and shop names. Takes about 6.5 minutes
- A shop name has only been published with test wallets so far, not JoyID

## Key Learnings

- A shop can hold a passport without a contract change, because the contract only checks who signed
- A DID on CKB is a normal cell with a Type ID, the same cell model again
- Anyone can create a cell under your lock, so a cell under a wallet doesn't mean that wallet agreed to it
- To check a wallet agreed, look for one of its cells in the inputs of the transaction
- Witnesses aren't part of the transaction hash, so two people can sign the same transaction at different times
- A DID gives a shop a name it controls, but someone still has to vouch that the shop is real

## Next Steps

- Publish a shop name with JoyID on my phone
- Show shop-first to Dflex
- Visit a second repair shop
