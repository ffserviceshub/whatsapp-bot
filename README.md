# FF ServicesPicks WhatsApp Bot

Baileys-based WhatsApp bot deployed on Render.

## Package menu

Customers who choose option **1** see only the starter packages priced up to ৳280:

| Code | Package | Price |
|---|---|---:|
| p1 | Starter (30+ Likes) | ৳70 |
| p2 | Value (50+ Likes) | ৳120 |
| p3 | Starter Plus (30+ Likes) | ৳110 |
| p4 | Pro (80+ Likes) | ৳150 |
| p5 | Value Plus (50+ Likes) | ৳180 |
| p6 | Special (150+ Likes) | ৳220 |
| p7 | Ultra (200+ Likes) — Popular, 7-day offer | ৳250 |
| p8 | Pro Plus (80+ Likes) | ৳280 |

The Yearly and Lifetime packages are hidden from the normal package menu.

## Admin: reveal larger packages

To show the larger package list to a particular customer:

1. Open that customer's WhatsApp chat from the same WhatsApp account paired with this bot.
2. Send **`!big`** (also accepts `/big` or `!vip-packages`).
3. The bot attempts to delete the trigger message and sends the larger package list in that chat.
4. The customer can then select one of the codes below.

The bot also supports the private customer keyword **`ffvip`**. You can tell a selected customer to type that keyword when you want them to see the larger packages. Do not publish this keyword in the public menu.

### Hidden package codes

| Code | Package | Price |
|---|---|---:|
| p9 | Yearly Value (50+ Likes) | ৳750 |
| p10 | Lifetime Star (50+ Likes) | ৳1,050 |
| p11 | Yearly Pro (80+ Likes) | ৳1,150 |
| p12 | Lifetime VIP (200+ Likes) | ৳5,000 |

Customers must open the relevant package list before sending its package code. The bot accepts p1–p8 from the starter list and p9–p12 from the larger-package list.

## Important notes

- Ultra is marked as a **7-day offer**; its listed delivery period remains 30 days.
- 30 / 60 / 365 days refer to the service delivery period, not an expiry date for likes already delivered.
- Total likes are estimates, not guaranteed delivery promises. Permanent packages remain subject to supplier terms.
- Existing payment, order-template, FAQ, support, and 24-hour order auto-reply hold logic are retained.
- Never ask customers for their game password, account password, payment PIN, or OTP.

## Run

```bash
npm install
npm start
``

Required environment: Node.js 18 or later. Render can provide the `PORT` environment variable.
