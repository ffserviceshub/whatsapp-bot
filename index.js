
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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
    const hasPackage = /package\s*:/i.test(messageText);
    const hasPrice = /price\s*:/i.test(messageText);
    const hasUID = /(?:free fire\s*)?uid\s*:/i.test(messageText);
    const hasTrxID = /(?:trx\s*id|trxid|transaction\s*id)\s*\/?\s*(?:number)?\s*:/i.test(messageText);

    const whatsappOrder =
        hasPackage &&
        hasPrice &&
        hasUID &&
        hasTrxID;

    return websiteOrder || whatsappOrder;
}

async function connectToWhatsApp() {
    const authFolder = 'auth_info_baileys';
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
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
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log('Connection closed, reconnecting...', shouldReconnect);

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log('Session expired. Cleaning old session cache...');

                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
            }

            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ FF ServicesPicks WhatsApp Bot successfully connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // অটো রিপ্লাই ও মেনু হ্যান্ডলার
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages?.[0];

            if (!msg?.message || msg.key.fromMe) return;

            const senderID = msg.key.remoteJid;

            // Group chat-এ bot reply করবে না
            if (!senderID || senderID.endsWith('@g.us') || senderID === 'status@broadcast') {
                return;
            }

            const messageText = getMessageText(msg.message);
            if (!messageText) return;

            const text = messageText.trim().toLowerCase();
            const currentTime = Date.now();
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

                let welcomeText = `🎮 *FF ServicesPicks-এ আপনাকে স্বাগতম!* 🚀

🔥 *বাজারে সবচেয়ে কম দামে* আপনার ফ্রি ফায়ার প্রোফাইলকে আরও আকর্ষণীয় ও প্রিমিয়াম করতে আমাদের সাশ্রয়ী মাসিক ও মেয়াদী লাইক প্যাকেজগুলো দেখে নিতে পারেন। ♥️`;

                if (lastTime !== 0 && currentTime - lastTime > twentyFourHours) {
                    welcomeText = `✨ *Welcome Back! দীর্ঘদিন পর আমাদের চ্যাটে আপনাকে আবার ফিরে পেয়ে খুব ভালো লাগলো!* 🥰

সবাইয়ের চেয়ে অনেক কম দামে সেরা সার্ভিস দিতে আমরা সবসময় আপনার পাশে আছি। ♥️`;
                }

                await sock.sendMessage(senderID, {
                    text: `${welcomeText}

🌐 *অফিশিয়াল ওয়েবসাইট:*
https://fflike.pages.dev/

👇 নিচের অপশনগুলোর সামনে থাকা *নম্বরটি* চ্যাটে লিখে পাঠিয়ে দিন:

1️⃣ 🔥 মেয়াদি লাইক প্যাকেজ ও সাশ্রয়ী মূল্য
2️⃣ 💳 bKash / Nagad পেমেন্ট করার নিয়ম
3️⃣ 📋 খুব সহজে যেভাবে অর্ডার করবেন
4️⃣ ❓ সাধারণ কিছু প্রশ্ন (FAQ)
5️⃣ 💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন

*💡 টিপস:* যেকোনো সময় মূল মেনুতে ফিরে আসতে চ্যাটে শুধু "Menu" লিখে পাঠান।`
                });

                return;
            }

            // অপশন ১: প্যাকেজ ও দাম
            if (
                text === '1' ||
                text.includes('package') ||
                text.includes('like') ||
                text.includes('প্যাকেজ') ||
                text.includes('দাম')
            ) {
                userState.set(senderID, 'viewing_packages');
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `🔥 *FF ServicesPicks — মাসিক ও মেয়াদী লাইক প্যাকেজসমূহ*

✨ *বিশেষ ঘোষণা:* বাজারের অন্যান্য সেবাদাতা প্রতিষ্ঠানের তুলনায় আমাদের প্যাকেজগুলোর দাম অনেক কম এবং সাশ্রয়ী! 💯

👇 আপনার পছন্দের প্যাকেজটির সামনে থাকা কোডটি (যেমন: p1, p2, p3...) চ্যাটে লিখে পাঠিয়ে অর্ডার শুরু করুন:

p1️⃣ *Ultra Package* — দাম: ৳২৫০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: ৩০ দিন
p2️⃣ *60-Day Value* — দাম: ৳২২০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৬০ দিন
p3️⃣ *150+ Likes Package* — দাম: ৳২২০ | ডেইলি: ১৫০+ লাইক ♥️ | মেয়াদ: ৩০ দিন
p4️⃣ *60-Day Pro* — দাম: ৳৩২০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৬০ দিন
p5️⃣ *Yearly Value* — দাম: ৳৮০০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন
p6️⃣ *👑 50+ Permanent* — দাম: ৳১,০৫০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: আজীবন
p7️⃣ *🌟 Yearly Pro* — দাম: ৳১,২০০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন
p8️⃣ *💎 200+ Permanent* — দাম: ৳৫,০০০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: আজীবন

🌐 বিস্তারিত দেখতে ভিজিট করুন:
https://fflike.pages.dev/

↩️ মূল মেনুতে যেতে চ্যাটে "Menu" লিখে পাঠান!`
                });

                return;
            }

            // প্যাকেজ কোড
            if (['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(text)) {
                if (userState.get(senderID) !== 'viewing_packages') {
                    await sock.sendMessage(senderID, {
                        text: `⚠️ *প্রথমে প্যাকেজ লিস্ট দেখে তারপর কোড দিন!*

প্রথমে চ্যাটে 1 লিখে প্যাকেজ লিস্ট দেখুন। তারপর p1 থেকে p8-এর মধ্যে পছন্দের কোড পাঠান।

↩️ মেনু দেখতে "Menu" লিখুন।`
                    });
                    return;
                }

                lastUserActivity.set(senderID, currentTime);

                const packages = {
                    p1: ['Ultra Package (২০০+ লাইক, ৩০ দিন)', '৳২৫০'],
                    p2: ['60-Day Value (৫০+ লাইক, ৬০ দিন)', '৳২২০'],
                    p3: ['150+ Likes Package (১৫০+ লাইক, ৩০ দিন)', '৳২২০'],
                    p4: ['60-Day Pro (৮০+ লাইক, ৬০ দিন)', '৳৩২০'],
                    p5: ['Yearly Value (৫০+ লাইক, ৩৬৫ দিন)', '৳৮০০'],
                    p6: ['50+ Likes Permanent (আজীবন)', '৳১,০৫০'],
                    p7: ['Yearly Pro (৮০+ লাইক, ৩৬৫ দিন)', '৳১,২০০'],
                    p8: ['200+ Likes Permanent (আজীবন)', '৳৫,০০০']
                };

                const [pkgName, pkgPrice] = packages[text];

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
                    text: `Package: ${pkgName}
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

Package: [প্যাকেজের নাম]
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

Package: [আপনার পছন্দের প্যাকেজের নাম]
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
২️⃣ পছন্দের প্যাকেজ কোড (p1 থেকে p8) পাঠান।
৩️⃣ bKash (\`01733054857\`) অথবা Nagad (\`01951722651\`)—যে মাধ্যমে পেমেন্ট করবেন, সেই নম্বরে সঠিক টাকা Send Money করুন।
৪️⃣ এরপর নিচের ফরম্যাটটি কপি করে তথ্য দিয়ে পাঠান:

Package: [প্যাকেজের নাম]
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
                    text: `💬 *অ্যাডমিন ও কাস্টমার সাপোর্ট*
আপনার মেসেজটি এখানে লিখে পাঠান। খুব শীঘ্রই অ্যাডমিন আপনার সাথে সরাসরি কথা বলবেন! ❤️`
                });

                return;
            }

            // ভুল মেসেজ: ১ ঘণ্টার anti-spam timer
            const lastErrorTime = lastErrorActivity.get(senderID) || 0;

            if (currentTime - lastErrorTime > oneHour) {
                lastErrorActivity.set(senderID, currentTime);
                lastUserActivity.set(senderID, currentTime);

                await sock.sendMessage(senderID, {
                    text: `❌ দুঃখিত, আপনার কমান্ডটি বুঝতে পারিনি।

• প্যাকেজ দেখতে: Menu বা 1
• অর্ডার করার নিয়ম: 3
• নিরাপত্তা সতর্কতা: 4
• অ্যাডমিনের সাথে কথা বলতে: 5`
                });
            }
        } catch (err) {
            console.error('Message handler error:', err);
        }
    });
}

connectToWhatsApp().catch(err => {
    console.error('WhatsApp connection error:', err);
});
