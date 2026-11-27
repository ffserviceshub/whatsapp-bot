
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');

// Render 24/7 Uptime এর জন্য Express Server
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🚀 FF ServicesPicks WhatsApp Bot is Running 24/7 Smoothly!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server is running on port ${PORT}`);
});

// মেমোরি স্টোরেজ
const supportUsers = new Set();
// এই চালু সেশনে যেসব গ্রাহক Free Trial-এর UID দিয়েছেন
const trialRequestedUsers = new Set();
const userState = new Map();
const lastUserActivity = new Map();
const lastErrorActivity = new Map();

// Website/WhatsApp order hold: 24-hour auto-reply pause
const orderHoldFile = 'order_hold_state.json';
const orderHoldUntil = new Map();

try {
    if (fs.existsSync(orderHoldFile)) {
        const savedHolds = JSON.parse(
            fs.readFileSync(orderHoldFile, 'utf8')
        );

        for (const [sender, expiry] of Object.entries(savedHolds)) {
            if (Number(expiry) > Date.now()) {
                orderHoldUntil.set(sender, Number(expiry));
            }
        }
    }
} catch (err) {
    console.error('Could not load order hold state:', err);
}

function saveOrderHolds() {
    try {
        fs.writeFileSync(
            orderHoldFile,
            JSON.stringify(Object.fromEntries(orderHoldUntil), null, 2)
        );
    } catch (err) {
        console.error('Could not save order hold state:', err);
    }
}

// Message থেকে text বের করা
function getMessageText(message) {
    if (!message) return '';

    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.ephemeralMessage?.message?.conversation ||
        message.ephemeralMessage?.message?.extendedTextMessage?.text ||
        message.viewOnceMessage?.message?.conversation ||
        message.viewOnceMessage?.message?.extendedTextMessage?.text ||
        ''
    ).trim();
}

// WhatsApp order message শনাক্ত করা
function isOrderMessage(messageText) {
    const text = messageText.toLowerCase();

    // Website order message-এর জন্য
    const websiteOrder =
        text.includes('please verify my order details') &&
        text.includes('order details') &&
        /free fire\s*uid\s*:/i.test(messageText) &&
        /payment method\s*:/i.test(messageText) &&
        /amount sent\s*:/i.test(messageText) &&
        /transaction id\s*\(\s*trxid\s*\)\s*:/i.test(messageText) &&
        /sender number\s*:/i.test(messageText);

    // WhatsApp-এ পাঠানো order template-এর জন্য
    const hasপ্যাকেজ = /(?:package|প্যাকেজ)\s*:/i.test(messageText);
    const hasPrice = /price\s*:/i.test(messageText);
    const hasUID = /(?:free fire\s*)?uid\s*:/i.test(messageText);
    const hasTrxID = /(?:trx\s*id|trxid|transaction\s*id)\s*\/?\s*(?:number)?\s*:/i.test(messageText);

    const whatsappOrder =
        hasপ্যাকেজ &&
        hasPrice &&
        hasUID &&
        hasTrxID;

    return websiteOrder || whatsappOrder;
}


// বড় প্যাকেজের তালিকা: সাধারণ মেনুতে দেখানো হবে না
function getBigপ্যাকেজসমূহMessage() {
    return `👑 *FF ServicesPicks — Premium প্যাকেজসমূহ*

আপনি বড় ও দীর্ঘমেয়াদি প্যাকেজ দেখতে চেয়েছেন। ❤️
পছন্দের প্যাকেজ কোড পাঠিয়ে অর্ডার শুরু করতে পারেন।

━━━━━━━━━━━━━━━━━━
👑 *বড় প্যাকেজসমূহ*
━━━━━━━━━━━━━━━━━━

9️⃣ *Yearly Value (50+ Likes) (p9)*
💰 মূল্য: ৳৭৫০
⚡ প্রতিদিন: ৫০+ Likes
📅 ডেলিভারি সময়কাল: ৩৬৫ দিন
❤️ কমপক্ষে মোট: ১৮,২৫০+ Likes

🔟 *Lifetime Star (50+ Likes) (p10)*
💰 মূল্য: ৳১,০৫০
⚡ প্রতিদিন: ৫০+ Likes
♾️ অসীম সময় Likes পাবেন (যতদিন আপনার Free Fire ID সক্রিয় থাকবে)
📊 বছরে কমপক্ষে: ১৮,২৫০+ Likes
❤️ মোট Likes: অসীম — এর চেয়েও বেশি পেতে পারেন

1️⃣1️⃣ *Yearly Pro (80+ Likes) (p11)*
💰 মূল্য: ৳১,১৫০
⚡ প্রতিদিন: ৮০+ Likes
📅 ডেলিভারি সময়কাল: ৩৬৫ দিন
❤️ কমপক্ষে মোট: ২৯,২০০+ Likes

1️⃣2️⃣ *Lifetime VIP (200+ Likes) (p12)*
💰 মূল্য: ৳৫,০০০
⚡ প্রতিদিন: ২০০+ Likes
♾️ অসীম সময় Likes পাবেন (যতদিন আপনার Free Fire ID সক্রিয় থাকবে)
📊 বছরে কমপক্ষে: ৭৩,০০০+ Likes
❤️ মোট Likes: অসীম — এর চেয়েও বেশি পেতে পারেন

━━━━━━━━━━━━━━━━━━
📌 ৩০ / ৬০ / ৩৬৫ দিন হলো Likes ডেলিভারির সময়কাল; Likes-এর মেয়াদ নয়। উল্লেখিত মোট Likes হলো ন্যূনতম লক্ষ্যমাত্রা; এর চেয়ে বেশি Likes-ও পেতে পারেন। Permanent service supplier-এর শর্তসাপেক্ষ।

📩 অর্ডার করতে p9 থেকে p12-এর মধ্যে পছন্দের কোড পাঠান।
↩️ মূল মেনুতে যেতে "Menu" লিখুন।`;
}

const authFolder = 'auth_info_baileys';
let reconnectTimer = null;
let reconnectAttempts = 0;
let isStarting = false;

function scheduleReconnect(delay) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectToWhatsApp().catch(err => {
            console.error('WhatsApp reconnect failed:', err);
            scheduleReconnect(Math.min(5000 * (2 ** reconnectAttempts++), 60000));
        });
    }, delay);
}

async function connectToWhatsApp() {
    if (isStarting) return;
    isStarting = true;

    let sock;
    try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // WhatsApp device-linking requires a current WhatsApp Web client revision.
    let waVersion;
    try {
        const latest = await fetchLatestWaWebVersion();
        waVersion = latest?.version;
        if (Array.isArray(waVersion)) {
            console.log(`Using live WhatsApp Web version: ${waVersion.join('.')}`);
        } else {
            console.warn('Live WhatsApp Web version unavailable; using Baileys default.');
        }
    } catch (versionError) {
        console.error('Could not fetch live WhatsApp Web version; using Baileys default:', versionError);
    }

    sock = makeWASocket({
        ...(waVersion ? { version: waVersion } : {}),
        logger: pino({ level: 'warn' }),
        auth: state,
        browser: ['Windows', 'Chrome', '115.0.0.0']
    });

    // Pairing code
    if (!sock.authState.creds.registered) {
        const phoneNumber = '8801951722651';

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(
                    `✨ YOUR PAIRING CODE IS: ${code?.match(/.{1,4}/g)?.join('-') || code}`
                );
            } catch (err) {
                console.log('Error requesting pairing code:', err);
            }
        }, 4000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

            console.log('WhatsApp connection closed. Status:', statusCode ?? 'unknown');

            if (loggedOut) {
                console.log('Session logged out. Clearing old session so a fresh pairing code can be generated.');
                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
                reconnectAttempts = 0;
                scheduleReconnect(3000);
            } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
                // 515 is a normal Baileys restart signal: keep the saved session and
                // immediately create a fresh socket. Never delete auth data for this code.
                console.log('WhatsApp requested a socket restart (515). Keeping session and reconnecting now...');
                reconnectAttempts = 0;
                scheduleReconnect(1000);
            } else {
                const delay = Math.min(5000 * (2 ** reconnectAttempts), 60000);
                reconnectAttempts++;
                console.log(`Reconnecting WhatsApp in ${Math.ceil(delay / 1000)} seconds...`);
                scheduleReconnect(delay);
            }
        } else if (connection === 'open') {
            reconnectAttempts = 0;
            console.log('✅ FF ServicesPicks WhatsApp Bot successfully connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // অটো রিপ্লাই ও মেনু হ্যান্ডলার
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages?.[0];

            if (!msg?.message) return;

            const senderID = msg.key.remoteJid;

            // Group chat-এ bot reply করবে না
            if (!senderID || senderID.endsWith('@g.us') || senderID === 'status@broadcast') {
                return;
            }

            const messageText = getMessageText(msg.message);
            if (!messageText) return;

            const text = messageText.trim().toLowerCase();
            const currentTime = Date.now();

            // Admin নিজের WhatsApp থেকে কোনো customer chat-এ !big পাঠালে
            // ওই customer-এর chat-এই বড় প্যাকেজের তালিকা দেখানো হবে।
            if (msg.key.fromMe) {
                if (['!big', '/big', '!vip-প্যাকেজs'].includes(text)) {
                    // Admin-এর trigger message customer chat থেকে delete করে শুধু প্যাকেজের তালিকা পাঠাও
                    try {
                        await sock.sendMessage(senderID, { delete: msg.key });
                    } catch (deleteError) {
                        console.error('Could not delete admin trigger message:', deleteError);
                    }

                    userState.set(senderID, 'viewing_big_প্যাকেজs');
                    await sock.sendMessage(senderID, {
                        text: getBigপ্যাকেজসমূহMessage()
                    });
                    console.log(`👑 Admin opened big প্যাকেজs for ${senderID}`);
                }
                return;
            }
            const lastTime = lastUserActivity.get(senderID) || 0;
            const oneHour = 60 * 60 * 1000;
            const twentyFourHours = 24 * oneHour;

            const holdUntil = orderHoldUntil.get(senderID) || 0;

            // 24 ঘণ্টার hold চললে আর কোনো auto-reply নয়
            if (holdUntil > currentTime) {
                return;
            }

            // Hold শেষ হয়ে গেলে মুছে ফেলো
            if (holdUntil !== 0 && holdUntil <= currentTime) {
                orderHoldUntil.delete(senderID);
                saveOrderHolds();
            }

            // Admin কাস্টমারকে যে গোপন keyword দেবেন, সেটি লিখলেই বড় প্যাকেজ খুলবে।
            if (text === 'ffvip') {
                userState.set(senderID, 'viewing_big_প্যাকেজs');
                lastUserActivity.set(senderID, currentTime);
                await sock.sendMessage(senderID, {
                    text: getBigপ্যাকেজসমূহMessage()
                });
                return;
            }

            // FIX: Website অথবা WhatsApp order format শনাক্ত করা
            if (isOrderMessage(messageText)) {
                orderHoldUntil.set(senderID, currentTime + twentyFourHours);
                saveOrderHolds();

                // অর্ডার জমা দেওয়ার পর আগের payment state সরিয়ে দাও
                userState.delete(senderID);
                supportUsers.delete(senderID);
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `✅ *আপনার অর্ডার আমরা পেয়েছি!* 📥

আপনার অর্ডারের তথ্য অ্যাডমিনের যাচাইয়ের জন্য জমা হয়েছে। অ্যাডমিন আপনার UID ও পেমেন্টের তথ্য যাচাই করে WhatsApp-এ জানাবেন।

⏳ পরবর্তী ২৪ ঘণ্টা এই চ্যাটে বটের অটো-রিপ্লাই বন্ধ থাকবে। এই সময়ে আপনার মেসেজগুলো অ্যাডমিন নিজে দেখতে পারবেন।

⚠️ পেমেন্ট যাচাই না হওয়া পর্যন্ত অর্ডারটি কনফার্ম নয়।

ধন্যবাদ! ❤️`
                });

                console.log(`✅ Order received from ${senderID}. Auto-reply paused for 24 hours.`);
                return;
            }

            // ইউজার সাপোর্ট মোডে থাকলে
            if (supportUsers.has(senderID)) {
                if (text === 'menu' || text === 'মেনু') {
                    supportUsers.delete(senderID);
                    userState.delete(senderID);
                } else {
                    return;
                }
            }

            // মূল মেনু / Welcome
            if (
                text === 'menu' ||
                text === 'মেনু' ||
                text === 'hi' ||
                text === 'hello' ||
                text === 'হাই' ||
                text === 'হ্যালো' ||
                lastTime === 0 ||
                currentTime - lastTime > twentyFourHours
            ) {
                supportUsers.delete(senderID);
                userState.set(senderID, 'main_menu');
                lastUserActivity.set(senderID, currentTime);

                const welcomeText = `🎮 *FF ServicesPicks-এ স্বাগতম!* ❤️

আপনার Free Fire ID-এর জন্য Likes প্যাকেজ দেখুন।

🌐 Website: https://sptopup.pages.dev/`;

                await sock.sendMessage(senderID, {
                    text: `${welcomeText}

👇 পছন্দের অপশনের নম্বর লিখুন:

1️⃣ 🔥 Likes প্যাকেজ ও মূল্য
2️⃣ 💳 পেমেন্টের নিয়ম
3️⃣ 📋 অর্ডার করার নিয়ম
4️⃣ ❓ সাধারণ প্রশ্ন ও নিরাপত্তা
5️⃣ 💬 Admin-এর সাথে যোগাযোগ
${trialRequestedUsers.has(senderID) ? '' : '6️⃣ 🎁 বিনামূল্যে ২০০+ লাইক ট্রায়াল\n'}

🤖 এটি আমাদের স্বয়ংক্রিয় Bot Menu।

↩️ মূল মেনুতে ফিরতে \`Menu\` লিখুন।`
                });

                return;
            }

            // Free Trial: UID গ্রহণ, Admin-কে জানানো
            if (userState.get(senderID) === 'awaiting_trial_uid') {
                if (!/^\d{8,12}$/.test(text)) {
                    await sock.sendMessage(senderID, {
                        text: `⚠️ সঠিক Free Fire UID দিন। UID শুধু ৮–১২টি সংখ্যা হতে হবে। Password বা OTP দেবেন না।`
                    });
                    return;
                }

                userState.delete(senderID);
                trialRequestedUsers.add(senderID);
                lastUserActivity.set(senderID, currentTime);

                const adminJid = '8801951722651@s.whatsapp.net';
                await sock.sendMessage(adminJid, {
                    text: `🎁 *নতুন FREE TRIAL অনুরোধ*

👤 Customer: ${senderID}
🎮 Free Fire UID: ${messageText}
❤️ Trial: 200+ Likes

অনুগ্রহ করে UID যাচাই করে ম্যানুয়ালি Trial দিন।`
                });

                await sock.sendMessage(senderID, {
                    text: `✅ *আপনার UID পাওয়া গেছে!* ❤️

🎁 200+ Likes Free Trial-এর অনুরোধটি Admin-কে জানানো হয়েছে।

⏳ যাচাই করে যত দ্রুত সম্ভব Trial দেওয়া হবে।

ধন্যবাদ FF ServicesPicks-এর সাথে থাকার জন্য!`
                });
                return;
            }

            // অপশন ১: প্যাকেজ ও দাম
            if (
                text === '1' ||
                text.includes('প্যাকেজ') ||
                text.includes('like') ||
                text.includes('প্যাকেজ') ||
                text.includes('দাম')
            ) {
                userState.set(senderID, 'viewing_প্যাকেজs');
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `🔥 *FF ServicesPicks — Starter প্যাকেজসমূহ*

শুরু করার জন্য সাশ্রয়ী প্যাকেজগুলো নিচে দেওয়া হলো। ❤️
পছন্দের প্যাকেজ কোড (p1–p8) পাঠিয়ে অর্ডার শুরু করুন।

━━━━━━━━━━━━━━━━━━
📦 *Starter প্যাকেজসমূহ*
━━━━━━━━━━━━━━━━━━

1️⃣ *Starter (30+ Likes) (p1)*
💰 মূল্য: ৳৭০
⚡ প্রতিদিন: ৩০+ Likes
📅 ডেলিভারি সময়কাল: ৩০ দিন
❤️ কমপক্ষে মোট: ৯০০+ Likes

2️⃣ *Value (50+ Likes) (p2)*
💰 মূল্য: ৳১২০
⚡ প্রতিদিন: ৫০+ Likes
📅 ডেলিভারি সময়কাল: ৩০ দিন
❤️ কমপক্ষে মোট: ১,৫০০+ Likes

3️⃣ *Starter Plus (30+ Likes) (p3)*
💰 মূল্য: ৳১১০
⚡ প্রতিদিন: ৩০+ Likes
📅 ডেলিভারি সময়কাল: ৬০ দিন
❤️ কমপক্ষে মোট: ১,৮০০+ Likes

4️⃣ *Pro (80+ Likes) (p4)*
💰 মূল্য: ৳১৫০
⚡ প্রতিদিন: ৮০+ Likes
📅 ডেলিভারি সময়কাল: ৩০ দিন
❤️ কমপক্ষে মোট: ২,৪০০+ Likes

5️⃣ *Value Plus (50+ Likes) (p5)*
💰 মূল্য: ৳১৮০
⚡ প্রতিদিন: ৫০+ Likes
📅 ডেলিভারি সময়কাল: ৬০ দিন
❤️ কমপক্ষে মোট: ৩,০০০+ Likes

6️⃣ *Special (150+ Likes) (p6)*
💰 মূল্য: ৳২২০
⚡ প্রতিদিন: ১৫০+ Likes
📅 ডেলিভারি সময়কাল: ৩০ দিন
❤️ কমপক্ষে মোট: ৪,৫০০+ Likes

7️⃣ *🔥 জনপ্রিয় — Ultra (200+ Likes) (p7)*
💰 মূল্য: ৳২৫০
🎁 *৭ দিনের অফার*
⚡ প্রতিদিন: ২০০+ Likes
📅 ডেলিভারি সময়কাল: ৩০ দিন
❤️ কমপক্ষে মোট: ৬,০০০+ Likes

8️⃣ *Pro Plus (80+ Likes) (p8)*
💰 মূল্য: ৳২৮০
⚡ প্রতিদিন: ৮০+ Likes
📅 ডেলিভারি সময়কাল: ৬০ দিন
❤️ কমপক্ষে মোট: ৪,৮০০+ Likes

━━━━━━━━━━━━━━━━━━
💬 *আরও বড় প্যাকেজ নিতে চান?*
Yearly ও Lifetime-এর মতো বড় প্যাকেজের জন্য Admin-এর সঙ্গে যোগাযোগ করুন। Admin আপনাকে বড় প্যাকেজের তালিকা দেখিয়ে দেবেন।

📌 ৩০ / ৬০ দিন হলো Likes ডেলিভারির সময়কাল; Likes-এর মেয়াদ নয়। উল্লেখিত মোট Likes হলো ন্যূনতম লক্ষ্যমাত্রা; এর চেয়ে বেশি Likes-ও পেতে পারেন।

📩 অর্ডার করতে p1 থেকে p8-এর মধ্যে পছন্দের কোড পাঠান।
↩️ মূল মেনুতে যেতে "Menu" লিখুন!`
                });

                return;
            }

            // প্যাকেজ কোড
            const regularপ্যাকেজCodes = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
            const bigপ্যাকেজCodes = ['p9', 'p10', 'p11', 'p12'];

            if (regularপ্যাকেজCodes.includes(text) || bigপ্যাকেজCodes.includes(text)) {
                const isBigপ্যাকেজCode = bigপ্যাকেজCodes.includes(text);
                const requiredState = isBigপ্যাকেজCode ? 'viewing_big_প্যাকেজs' : 'viewing_প্যাকেজs';

                if (userState.get(senderID) !== requiredState) {
                    await sock.sendMessage(senderID, {
                        text: isBigপ্যাকেজCode
                            ? `⚠️ *বড় প্যাকেজের তালিকা আগে খুলুন।*

Admin-এর সঙ্গে যোগাযোগ করুন অথবা Admin দেওয়া access keyword লিখুন।

↩️ মেনু দেখতে "Menu" লিখুন।`
                            : `⚠️ *প্রথমে প্যাকেজ লিস্ট দেখে তারপর কোড দিন!*

প্রথমে চ্যাটে 1 লিখে Starter প্যাকেজসমূহ দেখুন। তারপর p1 থেকে p8-এর মধ্যে পছন্দের কোড পাঠান।

↩️ মেনু দেখতে "Menu" লিখুন।`
                    });
                    return;
                }

                lastUserActivity.set(senderID, currentTime);

                const প্যাকেজs = {
                    p1: ['Starter (30+ Likes)', '৳৭০'],
                    p2: ['Value (50+ Likes)', '৳১২০'],
                    p3: ['Starter Plus (30+ Likes)', '৳১১০'],
                    p4: ['Pro (80+ Likes)', '৳১৫০'],
                    p5: ['Value Plus (50+ Likes)', '৳১৮০'],
                    p6: ['Special (150+ Likes)', '৳২২০'],
                    p7: ['Ultra (200+ Likes) — ৭ দিনের অফার', '৳২৫০'],
                    p8: ['Pro Plus (80+ Likes)', '৳২৮০'],
                    p9: ['Yearly Value (50+ Likes)', '৳৭৫০'],
                    p10: ['Lifetime Star (50+ Likes)', '৳১,০৫০'],
                    p11: ['Yearly Pro (80+ Likes)', '৳১,১৫০'],
                    p12: ['Lifetime VIP (200+ Likes)', '৳৫,০০০']
                };

                const [pkgName, pkgPrice] = প্যাকেজs[text];

                userState.set(senderID, 'awaiting_payment_info');

                await sock.sendMessage(senderID, {
                    text: `🎉 *অভিনন্দন! আপনার পছন্দের প্যাকেজটি সফলভাবে সিলেক্ট হয়েছে।*

📦 *নির্বাচিত প্যাকেজ:* ${pkgName}
💰 *মূল্য:* ${pkgPrice} *(বাজারে সবচেয়ে সাশ্রয়ী ও কম দাম!)*

---

🛠️ *অর্ডার কনফার্ম করার ধাপসমূহ:*

💳 *ধাপ ১: পেমেন্টের মাধ্যম বেছে নিন*
নির্বাচিত প্যাকেজের সঠিক টাকা নিচের যেকোনো একটি নম্বরে Send Money করুন:
📱 *bKash:* \`01733054857\`
📱 *Nagad:* \`01951722651\`

টাকা পাঠানোর আগে payment method, নম্বর ও amount মিলিয়ে নিন।

⚠️ *ধাপ ২: তথ্য পাঠানো*
পরের মেসেজটি কপি করে আপনার তথ্য বসিয়ে চ্যাটে পাঠিয়ে দিন! 🚀`
                });

                await sock.sendMessage(senderID, {
                    text: `প্যাকেজ: ${pkgName}
Price: ${pkgPrice}
UID: [এখানে আপনার গেমের UID দিন]
Payment Method: [bKash/Nagad]
TrxID/Number: [TrxID অথবা যে bKash/Nagad নম্বর থেকে টাকা পাঠিয়েছেন]`
                });

                return;
            }

            // প্যাকেজ সিলেক্ট করার পর অন্য সাধারণ মেসেজে ভুল confirmation যেন না যায়।
            // সঠিক order template উপরের isOrderMessage() অংশে ধরা হবে।
            if (userState.get(senderID) === 'awaiting_payment_info') {
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `⚠️ *অর্ডারের তথ্য সম্পূর্ণ হয়নি।*

দয়া করে নিচের তথ্যগুলোসহ মেসেজটি পাঠান:

প্যাকেজ: [প্যাকেজের নাম]
Price: [প্যাকেজের দাম]
UID: [আপনার গেমের UID]
Payment Method: [bKash/Nagad]
TrxID/Number: [TrxID অথবা যে bKash/Nagad নম্বর থেকে টাকা পাঠিয়েছেন]

এই ফরম্যাটে তথ্য পাঠালে অর্ডার গ্রহণের confirmation পাবেন।`
                });

                return;
            }

            // অপশন ২: পেমেন্ট পদ্ধতি
            if (
                text === '2' ||
                text.includes('payment') ||
                text.includes('bkash') ||
                text.includes('nagad') ||
                text.includes('বিকাশ') ||
                text.includes('নগদ') ||
                text.includes('টাকা')
            ) {
                userState.set(senderID, 'main_menu');
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `💳 *bKash / Nagad পেমেন্ট নির্দেশিকা* 🌟

আপনার পছন্দের মাধ্যম বেছে নিয়ে নির্বাচিত প্যাকেজের সঠিক টাকা Send Money করুন:
📱 *bKash:* \`01733054857\`
📱 *Nagad:* \`01951722651\`

⚠️ *টাকা পাঠানোর পর তথ্য পাঠানোর নিয়ম:*
নিচের ফরম্যাটটি কপি করে আপনার তথ্য দিয়ে পাঠান:

প্যাকেজ: [আপনার পছন্দের প্যাকেজের নাম]
Price: [প্যাকেজের দাম]
UID: [এখানে আপনার গেমের UID দিন]
Payment Method: [bKash/Nagad]
TrxID/Number: [TrxID অথবা যে bKash/Nagad নম্বর থেকে টাকা পাঠিয়েছেন]

↩️ মূল মেনুতে ফিরে যেতে "Menu" লিখুন।`
                });

                return;
            }

            // অপশন ৩: অর্ডার করার নিয়ম
            if (
                text === '3' ||
                text.includes('rules') ||
                text.includes('অর্ডার') ||
                text.includes('নিয়ম')
            ) {
                userState.set(senderID, 'main_menu');
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `📋 *খুব সহজেই যেভাবে অর্ডার করবেন:*

১️⃣ প্রথমে চ্যাটে 1 লিখে প্যাকেজ লিস্ট দেখুন।
২️⃣ পছন্দের প্যাকেজ কোড পাঠান।
৩️⃣ bKash (\`01733054857\`) অথবা Nagad (\`01951722651\`)—যে মাধ্যমে পেমেন্ট করবেন, সেই নম্বরে সঠিক টাকা Send Money করুন।
৪️⃣ এরপর নিচের ফরম্যাটটি কপি করে তথ্য দিয়ে পাঠান:

প্যাকেজ: [প্যাকেজের নাম]
Price: [প্যাকেজের দাম]
UID: [UID দিন]
Payment Method: [bKash/Nagad]
TrxID/Number: [TrxID অথবা যে bKash/Nagad নম্বর থেকে টাকা পাঠিয়েছেন]

অর্ডার মেসেজ পাঠালে বট confirmation দেবে। অ্যাডমিন পেমেন্ট যাচাই করে অর্ডার কনফার্ম করবেন। ✅

↩️ মূল মেনুতে যেতে "Menu" লিখুন।`
                });

                return;
            }

            // অপশন ৪: নিরাপত্তা
            if (
                text === '4' ||
                text.includes('faq') ||
                text.includes('safety') ||
                text.includes('সতর্কতা')
            ) {
                userState.set(senderID, 'main_menu');
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `❓ *সাধারণ কিছু প্রশ্ন (FAQ)*

❤️ *আমি কি প্যাকেজে উল্লেখিত সংখ্যার চেয়ে কম Likes পাব?*
না। প্রতিদিনের Likes Target-কে ন্যূনতম হিসাব হিসেবে ধরা হয়েছে। আপনি উল্লেখিত সংখ্যার কম নয়, বরং এর চেয়েও বেশি Likes পেতে পারেন। Lifetime প্যাকেজে আপনার Free Fire ID সক্রিয় থাকা পর্যন্ত Likes দেওয়া চলবে।

🎮 *Free Fire ID কি ban হবে?*
না, আমাদের থেকে likes নেওয়ার জন্য আপনার Free Fire ID-তে login করতে হয় না। আমরা আমাদের নিজস্ব ID/account ব্যবহার করে likes করি, তাই আপনার game password বা OTP দেওয়ার প্রয়োজন নেই।

❤️ *আপনার ID নিয়ে ভয় পাওয়ার কিছু নেই!* নিশ্চিন্তে আমাদের সার্ভিস থেকে likes নিন এবং নিজের gaming experience উপভোগ করুন। 😊

🔢 *UID-তে letter দেওয়া যাবে?*
না। Free Fire UID-তে শুধু সংখ্যা দিতে হবে—কোনো letter, space বা symbol নয়। UID ৫–২০ ডিজিটের হতে হবে। Submit করার আগে UID ভালোভাবে মিলিয়ে নিন।

💳 *কীভাবে পেমেন্ট করব?*
bKash (\`01733054857\`) অথবা Nagad (\`01951722651\`)—আপনার পছন্দের মাধ্যমে নির্বাচিত প্যাকেজের সঠিক amount Send Money করুন। টাকা পাঠানোর আগে payment method, নম্বর ও amount যাচাই করুন।

✅ *অর্ডার কখন confirm হবে?*
পেমেন্ট ও অর্ডারের তথ্য আমরা হাতে যাচাই করে WhatsApp-এ confirmation দিলে অর্ডার confirm হবে।

🔐 *নিরাপত্তা টিপস:* Game password, account password, bKash/Nagad PIN বা OTP কাউকে দেবেন না। FF ServicesPicks কখনো এগুলো চায় না।

↩️ মেনুতে যেতে "Menu" লিখুন।`
                });

                return;
            }

            // অপশন ৬: Free Trial
            if (text === '6' || text.includes('free trial') || text.includes('trial')) {
                supportUsers.delete(senderID);
                userState.set(senderID, 'awaiting_trial_uid');
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `🎁 *200+ Likes FREE TRIAL!* ❤️

Trial পেতে আপনার Free Fire UID পাঠান।

⚠️ শুধু UID দিন। Password বা OTP নয়।`
                });
                return;
            }

            // অপশন ৫: কাস্টমার সাপোর্ট
            if (
                text === '5' ||
                text.includes('support') ||
                text.includes('admin') ||
                text.includes('সাহায্য')
            ) {
                supportUsers.add(senderID);
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `💬 *FF ServicesPicks — Admin Support*

আপনার মেসেজটি পেয়েছি। ❤️

আমাদের Admin বর্তমানে ব্যস্ত আছেন।

⏳ যত দ্রুত সম্ভব আপনার সাথে যোগাযোগ করবেন। অনুগ্রহ করে অপেক্ষা করুন।

🤖 এটি একটি Automated Reply।`
                });

                return;
            }

            // ভুল মেসেজ: ১ ঘণ্টার anti-spam timer
            const lastErrorTime = lastErrorActivity.get(senderID) || 0;

            if (currentTime - lastErrorTime > oneHour) {
                lastErrorActivity.set(senderID, currentTime);
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `🤖 *FF ServicesPicks Auto Reply*

দুঃখিত, আপনার মেসেজটি বুঝতে পারিনি। 😊

📦 প্যাকেজ: \`1\`
❓ প্রশ্ন ও নিরাপত্তা: \`4\`
💬 Admin: \`5\`
${trialRequestedUsers.has(senderID) ? '' : '🎁 বিনামূল্যে ট্রায়াল: \\`6\\`\\n'}

আপনার মেসেজটি Admin-এর কাছে পৌঁছেছে। ❤️

আমাদের Admin বর্তমানে ব্যস্ত আছেন। যত দ্রুত সম্ভব আপনার সাথে যোগাযোগ করবেন। অনুগ্রহ করে অপেক্ষা করুন।

↩️ মূল মেনু: \`Menu\`

🤖 এটি একটি স্বয়ংক্রিয় উত্তর।`
                });
            }
        } catch (err) {
            console.error('Message handler error:', err);
        }
    });
    } catch (err) {
        console.error('WhatsApp connection setup error:', err);
        scheduleReconnect(Math.min(5000 * (2 ** reconnectAttempts++), 60000));
    } finally {
        isStarting = false;
    }
}

connectToWhatsApp().catch(err => {
    console.error('WhatsApp connection error:', err);
    scheduleReconnect(5000);
});
