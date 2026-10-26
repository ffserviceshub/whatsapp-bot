const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ FF ServicesPicks WhatsApp Bot সফলভাবে যুক্ত হয়েছে!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Render log-e pairing code paoar jonno number
    if (!sock.authState.creds.registered) {
        const phoneNumber = "8801951722651"; 
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n🔑 আপনার WhatsApp Pairing Code হলো: ${code}\n`);
            } catch (error) {
                console.log('Pairing code নিতে সমস্যা হয়েছে:', error);
            }
        }, 5000);
    }

    // Message Handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!messageText) return;

        const text = messageText.trim().toLowerCase();

        // 1. Main Menu
        if (text === 'hi' || text === 'hello' || text === 'menu' || text === 'ff' || text === 'শুরু') {
            await sock.sendMessage(senderID, { 
                text: `🎮 *FF ServicesPicks-এ স্বাগতম!*
✦ আপনার প্রোফাইল, আপনার স্টাইল — Free Fire profile আরও সুন্দর করুন Likes-এর সাথে! 🌟

🌐 *আমাদের অফিশিয়াল ওয়েবসাইট:*
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

দয়া করে নিচের অপশনগুলো থেকে বেছে নিতে ১, ২, ৩, ৪ বা ৫ লিখে পাঠান:

1️⃣ 🔥 প্রিমিয়াম প্যাকেজসমূহ (৳২০০+)
2️⃣ 💳 bKash পেমেন্ট পদ্ধতি
3️⃣ 📋 অর্ডার করার সঠিক নিয়ম
4️⃣ 🛡️ নিরাপত্তা ও গুরুত্বপূর্ণ সতর্কতা
5️⃣ 💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন` 
            });
        } 
        // 2. Option 1: Packages (৳200+)
        else if (text === '1' || text === 'packages' || text === 'package') {
            await sock.sendMessage(senderID, { 
                text: `🔥 *আমাদের স্পেশাল ফ্রি ফায়ার লাইক প্যাকেজসমূহ (৳২০০+):*

1️⃣ *Ultra Package*
• দাম: ৳২৫০ | ডেইলি: ২০০+ | মেয়াদ: ৩০ দিন

2️⃣ *60-Day Value*
• দাম: ৳২২০ | ডেইলি: ৫০+ | মেয়াদ: ৬০ দিন

3️⃣ *150+ Likes Package*
• দাম: ৳২২০ | ডেইলি: ১৫০+ | মেয়াদ: ৩০ দিন

4️⃣ *60-Day Pro*
• দাম: ৳৩২০ | ডেইলি: ৮০+ | মেয়াদ: ৬০ দিন

5️⃣ *Yearly Value*
• দাম: ৳৮০০ | ডেইলি: ৫০+ | মেয়াদ: ৩৬৫ দিন

6️⃣ *👑 50+ Likes Permanent Package*
• দাম: ৳১,০৫০ | ডেইলি: ৫০+ | মেয়াদ: Permanent

7️⃣ *🌟 Yearly Pro*
• দাম: ৳১,২০০ | ডেইলি: ৮০+ | মেয়াদ: ৩৬৫ দিন

8️⃣ *💎 200+ Likes Permanent Package*
• দাম: ৳৫,০০০ | ডেইলি: ২০০+ | মেয়াদ: Permanent

🌐 সব প্যাকেজ একসাথে দেখতে ওয়েবসাইট ভিজিট করুন:
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

🛒 *অর্ডার করার নিয়ম:*
পেমেন্ট সম্পন্ন করে আপনার *Free Fire UID* এবং *Transaction ID (TrxID)* বা *Sender bKash Number* লিখে আমাদের এখানে পাঠিয়ে দিন।` 
            });
        } 
        // 3. Option 2: Payment Details
        else if (text === '2' || text === 'payment') {
            await sock.sendMessage(senderID, { 
                text: `💳 *bKash Send Money পেমেন্ট পদ্ধতি:*

প্যাকেজের সঠিক টাকা নিচের পার্সোনাল নম্বরে *Send Money* করুন:
📱 *bKash (Personal):* \`01733054857\`

⚠️ *পেমেন্ট করার পর করণীয়:*
টাকা পাঠানোর পর চ্যাটে অবশ্যই আপনার:
১. *Free Fire UID*
২. *Transaction ID (TrxID)* অথবা *টাকা পাঠানো bKash মোবাইল নম্বর (Sender Number)* 

আমাদের এখানে লিখে পাঠান। পেমেন্ট ম্যানুয়ালি যাচাই করার পর আপনার অর্ডার কনফার্ম হলে WhatsApp-এ জানিয়ে দেওয়া হবে! ✅` 
            });
        } 
        // 4. Option 3: Order Instructions
        else if (text === '3' || text === 'rules') {
            await sock.sendMessage(senderID, { 
                text: `📋 *অর্ডার করার সহজ নিয়ম:*

১. ওয়েবসাইট ( https://ffserviceshub.github.io/FF-Like-ServicesPicks/ ) বা মেনু থেকে পছন্দের প্যাকেজ বেছে নিন।
২. bKash Send Money করুন: \`01733054857\` নম্বরে।
৩. চ্যাটে নিচের মতো করে তথ্যগুলো লিখে পাঠান:

💬 *UID:* [আপনার ফ্রি ফায়ার UID]
💬 *TrxID / Sender Number:* [ট্রানজাকশন আইডি অথবা যে নম্বর থেকে টাকা পাঠিয়েছেন]

৪. আমরা তথ্য যাচাই করার সাথে সাথে আপনার অর্ডার কনফার্মেশন মেসেজ WhatsApp-এ পেয়ে যাবেন! 📩` 
            });
        }
        // 5. Option 4: FAQ / Safety
        else if (text === '4' || text === 'faq') {
            await sock.sendMessage(senderID, { 
                text: `🛡️ *জরুরি নিরাপত্তা ও সাধারণ প্রশ্ন:*

❌ *পাসওয়ার্ড লাগবে না:* FF ServicesPicks কখনো আপনার গেম পাসওয়ার্ড, ফেসবুক পাসওয়ার্ড বা OTP চাইবে না।

🔢 *সঠিক UID দিন:* UID দেওয়ার সময় ভালো করে মিলিয়ে দিন (শুধু সংখ্যা)। ভুল UID-তে লাইক্স চলে গেলে সংশোধনের সুযোগ থাকবে না।

✅ *অর্ডার কনফার্মেশন:* মেসেজ পাঠালেই অর্ডার কনফার্ম নয়, অ্যাডমিন পেমেন্ট যাচাই করে WhatsApp-এ কনফার্ম করলে অর্ডার চালু হবে।` 
            });
        }
        // 6. Option 5: Support
        else if (text === '5' || text === 'support') {
            await sock.sendMessage(senderID, { 
                text: `💬 আপনার প্রশ্ন, সার্ভিস সংক্রান্ত বিষয় বা অর্ডার নিয়ে ছোট একটি মেসেজ লিখে পাঠান। আমাদের সাপোর্ট প্রতিনিধি দ্রুত আপনার সাথে কথা বলবেন! ❤️` 
            });
        }
    });
}

connectToWhatsApp();
