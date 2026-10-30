# CKB Builder Track - Week 10

Week Ending: 2026-10-30

## What I worked on

Last week Living Passport went live on public testnet, but every test used private keys in a script. This week the goals were to use it with a real wallet on a real phone, fix whatever broke, and take it into a repair shop to see what an actual technician thinks of it.

The app is still at [ckbuilders-two.vercel.app](https://ckbuilders-two.vercel.app).

## First passport from a real wallet

I created a passport for my own Samsung A56 from my phone, using JoyID. It's the first passport on the app signed by a real wallet, with no test key:

- Passport: [`0x91187a37…fe6f`](https://ckbuilders-two.vercel.app/?passport=0x91187a373b4c3ce7e22b3257a5b5a7f99d7df14f6c90e50c8c19013430a3fba30000000066927c92953662bfdd926f6b35ebdc6e94db7dc57904f07374b1de126b81fe6f)
- Create tx: [`0xf7c4f799…3aef`](https://testnet.explorer.nervos.org/transaction/0xf7c4f799de2b1d6c10deec17ddc645fc1bea4dfcd0b98c78caa5fdcf9ed13aef)

Before that I tested on an Android emulator, in real Chrome, against the live site. The page loads the passport history and **Connect** offers JoyID Passkey:

![Connect dialog in Android Chrome](android-connect.png)

Doing it for real exposed several problems that the scripts never hit:

- **Creating a passport failed when the wallet's CKB was spread over several cells.** Anyone who claimed from the faucet twice would have hit this. The app now collects from as many cells as it needs.
- **Errors were invisible on a phone.** Messages show at the top of the page while you're scrolled down at the button, so tapping "Continue to wallet" looked like nothing happened. The page now scrolls to the message.
- **I pasted a passport ID into the workshop address field** and got "Unknown address format". The error now tells you the field expects a `ckt1…` address.
- **The wallet button disconnected you when you tapped it.** On a phone, tapping your address is how you'd try to copy it. It now copies, and disconnect is a separate button.

## No more copying IDs and links

Using it on two phones showed how annoying all the copying was. You copied the passport ID, the workshop address, and the repair link, then sent each one between phones. A shop dealing with twenty phones would never do that. So I made two changes.

**My devices.** When you connect a wallet, the home screen lists every passport you own and every passport where you're the named workshop, with the latest event. Tap one and you get its full history.

![My devices on a phone](my-devices.png)

**Repair inbox.** The two-signer repair used to depend on the workshop sending the owner a link. Now when the workshop signs a draft, it also goes to a small inbox service, and the owner sees **"Repair waiting for your approval"** on their devices page. The link still works as a backup.

![The workshop drafts a repair](workshop-repair.png)
![The owner reviews it before signing](owner-approval.png)

The inbox runs on my Contabo server at `passport-api.mandaristudios.com` (Node, pm2, nginx, Let's Encrypt). It holds nothing secret: a draft is a public transaction with only the workshop's signature. Before storing a draft, it runs the same checks the owner's app runs. It drops drafts that go stale, for example when the passport has moved on since. The owner's app checks everything again before signing, so the inbox can't trick anyone into approving something wrong. The worst it can do is lose a draft, and then the link still works.

![History after the repair is approved](history-after-repair.png)

## Tests

- **13 local tests pass.** These are the contract tests in CKB-VM, plus checks that the owner's review rejects bad drafts.
- **Two-phone browser test passes against public testnet.** One emulated Android phone acts as the owner and one emulated iPhone as the workshop. Owner creates, workshop drafts a repair, the owner finds it in the inbox (no link) and approves, the repair shows in the history, and the owner closes the passport. Each run takes about two minutes.
- **I can now fill testnet with demo data.** A new `seed` command registers devices with repair histories. I used it to create 12 demo phones and laptops with 25 co-signed repairs, so the app has something to show. These are **made-up demo devices and owners**, not shop records. All of them are signed by my own test workshop wallet.

## The repair shop visit

I took Living Passport to a computer and phone repair shop.

![The shop](shop-shelves.jpg)
![Talking it through at the bench](shop-interview.jpg)
![Laptops opened up on the bench](shop-bench.jpg)

I talked to both the owner and the technician at **Dflex Technologies**. We did a live demo in the app on my phone, going through both sides: creating a passport as the owner, and drafting a repair as the workshop.

**First reaction.** They were interested. Their first questions were practical:

- How does it actually work?
- Does it need internet?
- Can he do it on his own smartphone?
- What happens when a customer doesn't have a smartphone?

**What he liked.** JoyID. Making a wallet with a passkey is much easier than managing seed phrases and passwords.

**His concerns.** The big one was **someone faking records**. The second was about where the records come from. Right now the shop doesn't keep repair records at all. They rely on whatever the owner tells them about the device. He asked how it could work without relying on the customer's side. His view was that it would work better used mainly **within the repair network**, shop to shop, instead of resting on owners.

**Other uses he saw.** He thinks it could help with **theft**: identifying stolen phones and stolen parts moving through repair shops.

**Would he use it?** Yes, but not the way I pitched it. He would use it as **in-house documentation and an inventory ledger** for the shop.

**Something he said that stuck with me.** They handle a lot of repairs, and many clients don't understand phone repairs or what actually happens to their phone while it's in the shop.

**What I took away.** I built Living Passport around the owner: the owner creates the passport, the owner approves every repair, and the passport follows the owner at resale. The shop sees it the other way round. To them the shop is the natural keeper of the record, the customer is often the weak link, and the most useful thing is a trusted log inside the repair trade: records of their own work and inventory, plus a way to catch stolen devices and parts. His worry about faked records is exactly what the two-signer repair is meant to prevent. But if records are kept mostly between shops, the question becomes which shops are trusted, not which owners. For the next step, I need to decide whether to turn this into a shop-first tool or stop here.

## What is not done yet

- **A repair has not yet been co-signed with JoyID on chain.** Creating a passport with JoyID works. The drafts are waiting in the inbox for me to approve from my phone.
- **I've visited only one shop so far.** The plan was two. I'd rather visit a second shop with the shop-first questions above than repeat the same pitch.

## What I learned

Tests with a script on a laptop told me the transactions were right, but nothing about whether a person could use the app. Every real bug this week came from a phone: the errors I couldn't see, the button that did the wrong thing, and the copying of IDs and links. Talking to someone who repairs devices every day mattered more than any of the code. One conversation changed who I think the user is.
