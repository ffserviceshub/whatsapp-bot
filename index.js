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

// ইউজারের সাপোর্ট মোড এবং ইউজারের প্রথম ভিজিট ট্র্যাক করার মেমোরি স্টোরেজ
const supportUsers = new Set();
const interactedUsers = new Set(); // যারা একবার মেনু দেখেছে তাদের ট্র্যাক করার জন্য

async function connectToWhatsApp() {
    const authFolder = 'auth_info_baileys';
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Windows", "Chrome", "115.0.0.0"]
    });

    // পেয়ারিং কোড জেনারেট করার লজিক
    if (!sock.authState.creds.registered) {
        const phoneNumber = "8801951722651"; // আপনার WhatsApp Business নম্বর
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`✨ YOUR PAIRING CODE IS: ${code?.match(/.{1,4}/g)?.join('-') || code}`);
            } catch (err) {
                console.log('Error requesting pairing code:', err);
            }
        }, 4000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const statusCode = (lastDisconnect.error)?.output?.statusCode;
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
            console.log('✅ FF ServicesPicks WhatsApp Bot সফলভাবে ক্লাউডে যুক্ত হয়েছে!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // অটো রিপ্লাই ও মেনু হ্যান্ডলার
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!messageText) return;

        const text = messageText.trim().toLowerCase();

        // ইউজার যদি সাপোর্ট মোডে থাকে
        if (supportUsers.has(senderID)) {
            if (text === 'menu' || text === 'মেনু') {
                supportUsers.delete(senderID);
            } else {
                return; // সাপোর্ট মোড চলাকালীন বোট অটো রিপ্লাই বন্ধ রাখবে
            }
        }

        // মেইন মেনু দেখার কমান্ড বা ইউজারের প্রথম মেসেজ
        if (text === 'menu' || text === 'মেনু' || !interactedUsers.has(senderID)) {
            interactedUsers.add(senderID); // ইউজারকে লিস্টে যুক্ত করা হলো যাতে পরবর্তী মেসেজগুলো ট্র্যাক করা যায়
            supportUsers.delete(senderID);
            
            await sock.sendMessage(senderID, { 
                text: `🎮 *FF ServicesPicks-এ আপনাকে স্বাগতম!* 

আপনার ফ্রি ফায়ার প্রোফাইলকে আরও আকর্ষণীয় করতে আমাদের কাছ থেকে খুব সহজেই লাইক নিতে পারেন। ♥️

🌐 *অফিশিয়াল ওয়েবসাইট:*
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

নিচের অপশনগুলোর সামনে থাকা *নম্বরটি (১ থেকে ৫)* চ্যাটে লিখে পাঠিয়ে দিন:

1️⃣ 🔥 লাইক প্যাকেজ ও দামসমূহ (৳২০০+)
2️⃣ 💳 বিকাশ (bKash) পেমেন্ট করার নিয়ম
3️⃣ 📋 খুব সহজে যেভাবে অর্ডার করবেন
4️⃣ 🛡️ জরুরি নিরাপত্তা ও সাধারণ সতর্কতা
5️⃣ 💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন

*💡 টিপস:* যেকোনো সময় মেইন মেনুতে ফিরে আসতে চ্যাটে শুধু **"Menu"** লিখে পাঠান।` 
            });
            return;
        }

        // অপশন ১: প্যাকেজ ও দামসমূহ
        if (text === '1' || text.includes('package') || text.includes('like') || text.includes('প্যাকেজ') || text.includes('দাম')) {
            await sock.sendMessage(senderID, { 
                text: `🔥 *FF ServicesPicks — প্রিমিয়াম ফ্রি ফায়ার লাইক প্যাকেজসমূহ* 

আপনার পছন্দের প্যাকেজটি বেছে নিন:

1️⃣ *Ultra Package* • দাম: ৳২৫০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: ৩০ দিন
2️⃣ *60-Day Value* • দাম: ৳২২০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৬০ দিন
3️⃣ *150+ Likes Package* • দাম: ৳২২০ | ডেইলি: ১৫০+ লাইক ♥️ | মেয়াদ: ৩০ দিন
4️⃣ *60-Day Pro* • দাম: ৳৩২০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৬০ দিন
5️⃣ *Yearly Value* • দাম: ৳৮০০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন
6️⃣ *👑 50+ Likes Permanent* • দাম: ৳১,০৫০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: আজীবন
7️⃣ *🌟 Yearly Pro* • দাম: ৳১,২০০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন
8️⃣ *💎 200+ Likes Permanent* • দাম: ৳৫,০০০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: আজীবন

🌐 বিস্তারিত দেখতে ভিজিট করুন:
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
        } 
        // অপশন ২: পেমেন্ট পদ্ধতি
        else if (text === '2' || text.includes('payment') || text.includes('bkash') || text.includes('বিকাশ') || text.includes('টাকা')) {
            await sock.sendMessage(senderID, { 
                text: `💳 *বিকাশ (bKash) পেমেন্ট নির্দেশিকা*

প্যাকেজ কনফার্ম করতে নিচের পার্সোনাল নম্বরে সঠিক টাকা *Send Money* করুন:
📱 *bKash Personal:* \`01733054857\`

⚠️ টাকা পাঠানোর পর চ্যাটে আপনার গেমের *UID* এবং *TrxID* বা বিকাশ নম্বর পাঠিয়ে দিন। ✅

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
        } 
        // অপশন ৩: অর্ডার করার সঠিক নিয়ম
        else if (text === '3' || text.includes('rules') || text.includes('অর্ডার') || text.includes('নিয়ম')) {
            await sock.sendMessage(senderID, { 
                text: `📋 *খুব সহজেই যেভাবে অর্ডার করবেন:*

১️⃣ প্রথমে চ্যাটে **1** লিখে প্যাকেজ পছন্দ করুন।
২️⃣ বিকাশ পার্সোনাল নম্বরে (\`01733054857\`) টাকা *Send Money* করুন।
৩️⃣ এরপর চ্যাটে আপনার **UID** এবং **TrxID** লিখে পাঠিয়ে দিন। 🚀

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
        }
        // অপশন ৪: নিরাপত্তা সতর্কতা
        else if (text === '4' || text.includes('faq') || text.includes('safety') || text.includes('সতর্কতা')) {
            await sock.sendMessage(senderID, { 
                text: `🛡️ *জরুরি নিরাপত্তা ও সতর্কতা:*
❌ গেম পাসওয়ার্ড বা OTP কাউকে দেবেন না। FF ServicesPicks কখনো পাসওয়ার্ড চায় না। সঠিক UID প্রদান করুন।

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
        }
        // অপশন ৫: কাস্টমার সাপোর্ট
        else if (text === '5' || text.includes('support') || text.includes('admin') || text.includes('সাহায্য')) {
            supportUsers.add(senderID);
            await sock.sendMessage(senderID, { 
                text: `💬 *কাস্টমার সাপোর্ট ও সাহায্য*
আপনার মেসেজটি এখানে লিখে পাঠান। খুব শীঘ্রই অ্যাডমিন আপনার সাথে কথা বলবেন! ❤️` 
            });
        }
        // ইউজার ভুল বা আবলতাবল কিছু লিখলে আপনার চাওয়া ফরম্যাটে মেসেজ দেবে
        else {
            await sock.sendMessage(senderID, { 
                text: `❌ দুঃখিত, আপনার কমান্ডটি বুঝতে পারিনি। 

• অর্ডার করতে ও সবকিছু জানতে চ্যাটে টাইপ করুন: **Menu**
• কীভাবে অর্ডার করবেন জানতে চ্যাটে টাইপ করুন: **3**
• অ্যাডমিনের সাথে যোগাযোগ বা সাপোর্টের জন্য টাইপ করুন: **4** বা **5**` 
            });
        }
    });
}

connectToWhatsApp();
