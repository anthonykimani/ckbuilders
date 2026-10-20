# Living Passport: two-shop pilot

The goal is to learn whether repair shops and their customers would use a signed, portable repair history, not to sell anything. Two shops, one visit each (about 45 minutes), plus a follow-up message a few days later.

## What we want to learn

1. **Would the shop record repairs this way?** Is drafting a record and sending a link quick enough to do at the counter?
2. **Does the customer understand what they are approving?** Can they read the approval page and say what they are signing?
3. **Would a buyer care?** When shown a passport for a used laptop, does the shop think a buyer would pay more or trust it more?
4. **What breaks?** Wallet setup, links on phones, network delays, wording.

Write down what actually happened, including failures. A pilot where the shop says "no, because…" is a useful result.

## Before the visit

- [ ] The site is live on public testnet and the end-to-end script has passed (`node scripts/testnet.mjs e2e`).
- [ ] You have a testnet JoyID wallet with at least 1,300 CKB (two passports plus spare).
- [ ] Prepare ~150 testnet CKB to send to each shop's wallet. This pays their repair fees; customers need nothing.
- [ ] Print or save this page and the question sheet below.
- [ ] Bring your own laptop as the demo item in case the shop has nothing suitable that day.

## At the shop

**1. Explain (2 minutes).** "This is a student project on a test network. Nothing here is real money. I want to know if a repair history that follows the laptop would be useful to you."

**2. Shop wallet (5 to 10 minutes).** On the shop's phone, open the site, tap **Connect**, choose JoyID and create a passkey wallet. JoyID connected through the site uses testnet. Copy their `ckt1…` address and send them ~150 testnet CKB.

**3. Create a passport (you).** On your phone: **Create a passport**. Use the laptop model, a first-name owner label, and the shop's `ckt1…` address as the workshop. Approve in your wallet. Note the passport link.

**4. Record a repair (shop).** The shop opens the passport link on their phone, writes what they did (a real recent repair, or a check-up), taps **Sign draft** and sends you the link by WhatsApp or SMS.

**5. Approve (you, as owner).** Open the link, read the checks, tap **Approve and sign**. Show the shop the updated history and the explorer link.

**6. Optional hand-over.** If a customer is present and willing, help them create a JoyID wallet and **Hand over** the passport to them. They need no CKB.

**7. Clean up.** Leave the passport live if the shop wants to keep testing. Otherwise the owner can **Close passport** to return the 600 CKB.

Time each step. Note where people hesitated or asked questions.

## Privacy rules

- Never type serial numbers, phone numbers, full names or addresses into the passport. Everything is public and permanent.
- Ask before photographing anything. Do not photograph customers.
- In the report, use the shop's name only if they agree. Otherwise "Shop A" and "Shop B".

## Questions for the shop (after the demo)

1. How do you record repairs today? What do customers get as proof?
2. How long did drafting the repair take? Would you do it for every job, some jobs, or none?
3. What would make you stop using it?
4. Do customers ever come back with a laptop someone else repaired? Would this history help?
5. Do you sell used laptops? Would a passport change the price or how quickly they sell?
6. Who should pay the network fee and the 600 CKB deposit: the shop, the customer, or the buyer?
7. What would you call this in your own words?

## Record per shop

| Item | Shop A | Shop B |
| --- | --- | --- |
| Date | | |
| Shop type (repair only / repair + resale) | | |
| Wallet setup time | | |
| Passport create tx | | |
| Repair draft to approval time | | |
| Repair tx | | |
| Errors seen (exact text) | | |
| Would use it? (yes / maybe / no) and why | | |
| Strongest objection | | |
| Feature they asked for | | |

## Closing the project

After both visits, write the Week 9 report with: the testnet contract and transaction hashes, the e2e script output, the two pilot tables, direct quotes (with permission), and an honest decision. Either "stop here" or "worth a Spark proposal because…". Then archive the project in the README.
