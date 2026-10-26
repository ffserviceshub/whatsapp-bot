const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');

// Render 24/7 uptime নিশ্চিত করার জন্য Express Server
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🚀 FF ServicesPicks WhatsApp Bot is Running 24/7 Smoothly!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server is running on port ${PORT}`);
});

async function connectToWhatsApp() {
    // রেজিস্টার্ড না থাকলে পুরনো সেশন ফাইল অটোমেটিক ডিলিট করে দেওয়া হবে
    const authFolder = 'auth_info_baileys';
    
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const statusCode = (lastDisconnect.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            
            // সেশন এরর হলে ক্যাশ ডিলিট করে রিস্টার্ট করার লজিক
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log('Old session expired. Clearing cache...');
                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
            }
            
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ FF ServicesPicks WhatsApp Bot সফলভাবে ক্লাউডে যুক্ত হয়েছে!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Render Logs-এ Pairing Code পাওয়ার জন্য
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

    // Professional Smart Message Handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!messageText) return;

        const text = messageText.trim().toLowerCase();

        // অপশন ১: প্যাকেজ ও দামসমূহ
        if (text === '1' || text.includes('package') || text.includes('like') || text.includes('প্যাকেজ') || text.includes('দাম')) {
            await sock.sendMessage(senderID, { 
                text: `🔥 *FF ServicesPicks — প্রিমিয়াম ফ্রি ফায়ার লাইক প্যাকেজসমূহ (৳২০০+)* 

আমাদের জনপ্রিয় ও সেরা প্যাকেজগুলো দেখে নিন:

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

6️⃣ *👑 50+ Likes Permanent*
   • দাম: ৳১,০৫০ | ডেইলি: ৫০+ | মেয়াদ: Permanent

7️⃣ *🌟 Yearly Pro*
   • দাম: ৳১,২০০ | ডেইলি: ৮০+ | মেয়াদ: ৩৬৫ দিন

8️⃣ *💎 200+ Likes Permanent*
   • দাম: ৳৫,০০০ | ডেইলি: ২০০+ | মেয়াদ: Permanent

🌐 সব প্যাকেজ বিস্তারিত দেখতে আমাদের ওয়েবসাইট ভিজিট করুন:
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

↩️ মূল মেনুতে ফিরে যেতে **"Menu"** লিখে পাঠান!` 
            });
        } 
        // অপশন ২: পেমেন্ট পদ্ধতি
        else if (text === '2' || text.includes('payment') || text.includes('bkash') || text.includes('বিকাশ') || text.includes('টাকা')) {
            await sock.sendMessage(senderID, { 
                text: `💳 *bKash Send Money পেমেন্ট নির্দেশিকা*

প্যাকেজ কনফার্ম করতে সঠিক টাকা নিচের পার্সোনাল নম্বরে *Send Money* করুন:

📱 *bKash (Personal):* \`01733054857\`

⚠️ *পেমেন্ট করার পর যা করতে হবে:*
টাকা পাঠানোর পর চ্যাটে অবশ্যই আপনার:
১. *Free Fire UID* (শুধু সংখ্যা)
২. *Transaction ID (TrxID)* অথবা *Sender bKash Number*

লিখে পাঠিয়ে দিন। আমাদের টিম ম্যানুয়ালি পেমেন্ট যাচাই করার পর আপনার অর্ডার সফলভাবে কনফার্ম করে WhatsApp-এ জানিয়ে দেবে! ✅

↩️ মূল মেনুতে ফিরে যেতে **"Menu"** লিখে পাঠান!` 
            });
        } 
        // অপশন ৩: অর্ডার করার নিয়ম
        else if (text === '3' || text.includes('rules') || text.includes('অর্ডার') || text.includes('নিয়ম')) {
            await sock.sendMessage(senderID, { 
                text: `📋 *খুব সহজেই যেভাবে অর্ডার করবেন:*

১️⃣ আমাদের ওয়েবসাইট বা প্যাকেজ লিস্ট থেকে আপনার পছন্দের প্যাকেজটি সিলেক্ট করুন।
২️⃣ নির্দিষ্ট টাকা আমাদের bKash Personal নম্বরে (\`01733054857\`) *Send Money* করুন।
৩️⃣ এরপর আমাদের চ্যাটে নিচের ফরম্যাটটি পূরণ করে পাঠিয়ে দিন:

   💬 *UID:* [আপনার গেমের UID]
   💬 *TrxID / Sender Number:* [ট্রানজাকশন আইডি বা নম্বর]

৪️⃣ পেমেন্ট সফলভাবে যাচাই হওয়ার সাথে সাথেই আপনার অর্ডারটি কনফার্ম করে দেওয়া হবে! 🚀

↩️ মূল মেনুতে ফিরে যেতে **"Menu"** লিখে পাঠান!` 
            });
        }
        // অপশন ৪: নিরাপত্তা সতর্কতা ও FAQ
        else if (text === '4' || text.includes('faq') || text.includes('safety') || text.includes('সতর্কতা')) {
            await sock.sendMessage(senderID, { 
                text: `🛡️ *জরুরি নিরাপত্তা ও সাধারণ সতর্কতা:*

❌ *গেম পাসওয়ার্ড বা OTP:* FF ServicesPicks কখনো আপনার গেম পাসওয়ার্ড, ফেসবুক অ্যাকাউন্ট বা কোনো প্রকার OTP চাইবে না।
🔢 *সঠিক UID প্রদান:* Free Fire UID দেওয়ার সময় খুব ভালোভাবে চেক করে নেবেন (শুধু সংখ্যা)।
✋ *ম্যানুয়াল ভেরিফিকেশন:* WhatsApp-এ তথ্য পাঠানোর পর অ্যাডমিন হাতে যাচাই করার পরই সার্ভিস স্টার্ট হবে।

↩️ মূল মেনুতে ফিরে যেতে **"Menu"** লিখে পাঠান!` 
            });
        }
        // অপশন ৫: কাস্টমার সাপোর্ট
        else if (text === '5' || text.includes('support') || text.includes('admin') || text.includes('সাহায্য')) {
            await sock.sendMessage(senderID, { 
                text: `💬 *কাস্টমার সাপোর্ট ও সাহায্য*

আপনার অর্ডার বা পেমেন্ট সংক্রান্ত যে কোনো প্রয়োজনে একটি মেসেজ পাঠাক। আমাদের প্রতিনিধি দ্রুত আপনাকে সহায়তা করবেন! ❤️

↩️ মূল মেনুতে ফিরে যেতে **"Menu"** লিখে পাঠান!` 
            });
        }
        // ডিফল্ট মেনু
        else {
            await sock.sendMessage(senderID, { 
                text: `🎮 *FF ServicesPicks-এ আপনাকে স্বাগতম!* 
✦ আপনার প্রোফাইল, আপনার স্টাইল — Free Fire profile আরও সুন্দর করুন আস্থার সাথে Likes নিয়ে! 🌟

🌐 *অফিশিয়াল ওয়েবসাইট:*
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

আপনার প্রয়োজনীয় সেবার সামনে থাকা **নম্বরটি (১, ২, ৩, ৪ বা ৫)** লিখে পাঠিয়ে দিন:

1️⃣ 🔥 প্রিমিয়াম প্যাকেজ ও দামসমূহ (৳২০০+)
2️⃣ 💳 bKash পেমেন্ট পদ্ধতি ও নম্বর
3️⃣ 📋 অর্ডার করার সঠিক নিয়মাবলী
4️⃣ 🛡️ নিরাপত্তা সতর্কতা ও FAQ
5️⃣ 💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন

*💡 টিপস: যে কোনো সময় মেনুতে ফিরে আসতে চ্যাটে শুধু "Menu" লিখে পাঠান।*` 
            });
        }
    });
}

connectToWhatsApp();
