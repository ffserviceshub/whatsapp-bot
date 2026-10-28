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

// মেমোরি স্টোরেজ: সাপোর্ট মোড, ইউজার স্টেট এবং ১ ঘণ্টার অ্যান্টি-স্প্যাম টাইমার
const supportUsers = new Set();
const userState = new Map(); // ইউজার কোথায় আছে (মেনু বা প্যাকেজ লিস্টে) তা ট্র্যাক করার জন্য
const lastUserActivity = new Map();
const lastErrorActivity = new Map();

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
        const currentTime = Date.now();
        const lastTime = lastUserActivity.get(senderID) || 0;
        const oneHour = 60 * 60 * 1000; // ১ ঘণ্টা সময় মিলিসেকেন্ডে
        const twentyFourHours = 24 * oneHour;

        // ইউজার যদি সাপোর্ট মোডে থাকে
        if (supportUsers.has(senderID)) {
            if (text === 'menu' || text === 'মেনু') {
                supportUsers.delete(senderID);
                userState.delete(senderID);
            } else {
                return; // সাপোর্ট মোড চলাকালীন বোট অটো রিপ্লাই বন্ধ রাখবে যাতে অ্যাডমিন সরাসরি কথা বলতে পারে
            }
        }

        // মূল মেনু দেখার কমান্ড অথবা অনেকদিন পর চ্যাটে ফিরলে সুদৃশ্য ওয়েলকাম মেসেজ
        if (text === 'menu' || text === 'মেনু' || text === 'hi' || text === 'hello' || text === 'হাই' || text === 'হ্যালো' || lastTime === 0 || (currentTime - lastTime > twentyFourHours)) {
            supportUsers.delete(senderID);
            userState.set(senderID, 'main_menu');
            lastUserActivity.set(senderID, currentTime);

            let welcomeText = `🎮 *FF ServicesPicks-এ আপনাকে স্বাগতম!* \n\nআপনার ফ্রি ফায়ার প্রোফাইলকে আরও আকর্ষণীয় করতে আমাদের কাছ থেকে খুব সহজেই লাইক নিতে পারেন। ♥️`;
            
            if (lastTime !== 0 && (currentTime - lastTime > twentyFourHours)) {
                welcomeText = `✨ *Welcome Back! দীর্ঘদিন পর আমাদের চ্যাটে আপনাকে আবার ফিরে পেয়ে খুব ভালো লাগলো!* 🥰\n\nফ্রি ফায়ার প্রোফাইলকে আরও দারুণ করতে আমরা সবসময় আপনার পাশে আছি। ♥️`;
            }

            await sock.sendMessage(senderID, { 
                text: `${welcomeText}\n\n🌐 *অফিশিয়াল ওয়েবসাইট:*\nhttps://ffserviceshub.github.io/FF-Like-ServicesPicks/\n\nনিচের অপশনগুলোর সামনে থাকা *নম্বরটি* চ্যাটে লিখে পাঠিয়ে দিন:\n\n1️⃣ 🔥 লাইক প্যাকেজ ও দামসমূহ (৳২০০+)\n2️⃣ 💳 বিকাশ (bKash) পেমেন্ট করার নিয়ম\n3️⃣ 📋 খুব সহজে যেভাবে অর্ডার করবেন\n4️⃣ 🛡️ জরুরি নিরাপত্তা ও সাধারণ সতর্কতা\n5️⃣ 💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন\n\n*💡 টিপস:* যেকোনো সময় মূল মেনুতে ফিরে আসতে চ্যাটে শুধু **"Menu"** লিখে পাঠান।` 
            });
            return;
        }

        // অপশন ১: প্যাকেজ ও দামসমূহ দেখানোর কমান্ড
        if (text === '1' || text.includes('package') || text.includes('like') || text.includes('প্যাকেজ') || text.includes('দাম')) {
            userState.set(senderID, 'viewing_packages'); // ইউজার এখন প্যাকেজ লিস্ট দেখছে তা সেট করা হলো
            lastUserActivity.set(senderID, currentTime);
            
            await sock.sendMessage(senderID, { 
                text: `🔥 *FF ServicesPicks — প্রিমিয়াম ফ্রি ফায়ার লাইক প্যাকেজসমূহ* 

প্রথমে নিচের তালিকা থেকে আপনার পছন্দের প্যাকেজটি দেখে নিন। 
*অর্ডার করার নিয়ম:* পছন্দের প্যাকেজটির সামনে থাকা কোডটি (যেমন: **p1**, **p2**, **p3**...) চ্যাটে লিখে পাঠিয়ে দিন!

p1️⃣ *Ultra Package* — দাম: ৳২৫০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: ৩০ দিন
p2️⃣ *60-Day Value* — দাম: ৳২২০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৬০ দিন
p3️⃣ *150+ Likes Package* — দাম: ৳২২০ | ডেইলি: ১৫০+ লাইক ♥️ | মেয়াদ: ৩০ দিন
p4️⃣ *60-Day Pro* — দাম: ৳৩২০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৬০ দিন
p5️⃣ *Yearly Value* — দাম: ৳৮০০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন
p6️⃣ *👑 50+ Likes Permanent* — দাম: ৳১,০৫০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: আজীবন
p7️⃣ *🌟 Yearly Pro* — দাম: ৳১,২০০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন
p8️⃣ *💎 200+ Likes Permanent* — দাম: ৳৫,০০০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: আজীবন

🌐 বিস্তারিত দেখতে ভিজিট করুন:
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
            return;
        } 

        // ইউজার যদি প্যাকেজ লিস্ট না দেখে হঠাত 'p1' বা অন্য কোনো কোড লেখে
        if (['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(text)) {
            if (userState.get(senderID) !== 'viewing_packages') {
                await sock.sendMessage(senderID, { 
                    text: `⚠️ *প্রথমে প্যাকেজ লিস্ট দেখে তারপর কোড দিন!* \n\nআপনি এখনো প্যাকেজ লিস্ট দেখেননি। প্রথমে চ্যাটে **1** লিখে বা **Menu** এ গিয়ে প্যাকেজ লিস্ট দেখে নিন, তারপর প্যাকেজ কোড (**p1** থেকে **p8**) লিখে পাঠাবেন।\n\n↩️ মেনু দেখতে চ্যাটে **"Menu"** লিখুন!` 
                });
                return;
            }

            lastUserActivity.set(senderID, currentTime);
            
            let pkgName = "";
            let pkgPrice = "";
            if (text === 'p1') { pkgName = "Ultra Package (২০০+ লাইক, ৩০ দিন)"; pkgPrice = "৳২৫০"; }
            else if (text === 'p2') { pkgName = "60-Day Value (৫০+ লাইক, ৬০ দিন)"; pkgPrice = "৳২২০"; }
            else if (text === 'p3') { pkgName = "150+ Likes Package (১৫০+ লাইক, ৩০ দিন)"; pkgPrice = "৳২২০"; }
            else if (text === 'p4') { pkgName = "60-Day Pro (৮০+ লাইক, ৬০ দিন)"; pkgPrice = "৳৩২০"; }
            else if (text === 'p5') { pkgName = "Yearly Value (৫০+ লাইক, ৩৬৫ দিন)"; pkgPrice = "৳৮০০"; }
            else if (text === 'p6') { pkgName = "50+ Likes Permanent (আজীবন)"; pkgPrice = "৳১,০৫০"; }
            else if (text === 'p7') { pkgName = "Yearly Pro (৮০+ লাইক, ৩৬৫ দিন)"; pkgPrice = "৳১,২০০"; }
            else if (text === 'p8') { pkgName = "200+ Likes Permanent (আজীবন)"; pkgPrice = "৳৫,০০০"; }

            await sock.sendMessage(senderID, { 
                text: `🎉 *আপনার প্যাকেজ সফলভাবে সিলেক্ট হয়েছে!* 

📦 *নির্বাচিত প্যাকেজ:* ${pkgName}
💰 *মূল্য:* ${pkgPrice}

অর্ডারটি কনফার্ম করতে এবার নিচের ধাপগুলো অনুসরণ করুন:

💳 *বিকাশ (bKash) পেমেন্ট নির্দেশিকা*
প্যাকেজ কনফার্ম করতে নিচের পার্সোনাল নম্বরে সঠিক টাকা *Send Money* করুন:
📱 *bKash Personal:* \`01733054857\`

⚠️ টাকা পাঠানোর পর চ্যাটে আপনার গেমের সঠিক *UID* এবং ট্রানজাকশন আইডি (*TrxID*) অথবা আপনার বিকাশ নম্বরটি পাঠিয়ে দিন। 

✅ পেমেন্ট যাচাই করে অ্যাডমিন খুব শীঘ্রই আপনার অর্ডারটি কনফার্ম করে দেবেন! 🚀

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
            return;
        }

        // অপশন ২: পেমেন্ট পদ্ধতি
        if (text === '2' || text.includes('payment') || text.includes('bkash') || text.includes('বিকাশ') || text.includes('টাকা')) {
            userState.set(senderID, 'main_menu');
            lastUserActivity.set(senderID, currentTime);
            await sock.sendMessage(senderID, { 
                text: `💳 *বিকাশ (bKash) পেমেন্ট নির্দেশিকা*

প্যাকেজ কনফার্ম করতে নিচের পার্সোনাল নম্বরে সঠিক টাকা *Send Money* করুন:
📱 *bKash Personal:* \`01733054857\`

⚠️ টাকা পাঠানোর পর চ্যাটে আপনার গেমের *UID* এবং *TrxID* বা বিকাশ নম্বর পাঠিয়ে দিন। ✅

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
            return;
        } 

        // অপশন ৩: অর্ডার করার সঠিক নিয়ম
        if (text === '3' || text.includes('rules') || text.includes('অর্ডার') || text.includes('নিয়ম')) {
            userState.set(senderID, 'main_menu');
            lastUserActivity.set(senderID, currentTime);
            await sock.sendMessage(senderID, { 
                text: `📋 *খুব সহজেই যেভাবে অর্ডার করবেন:*

১️⃣ প্রথমে চ্যাটে **1** লিখে আমাদের প্যাকেজ লিস্ট দেখে নিন।
২️⃣ আপনার পছন্দের প্যাকেজ কোডটি (যেমন: **p1** থেকে **p8**) চ্যাটে পাঠান।
৩️⃣ বিকাশ পার্সোনাল নম্বরে (\`01733054857\`) সঠিক টাকা *Send Money* করুন।
৪️⃣ এরপর চ্যাটে আপনার গেমের সঠিক **UID** এবং **TrxID/নম্বর** লিখে পাঠিয়ে দিন। 🚀

অ্যাডমিন যাচাই করে আপনার অর্ডার কনফার্ম করে দেবেন! ✅

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
            return;
        }

        // অপশন ৪: নিরাপত্তা সতর্কতা
        if (text === '4' || text.includes('faq') || text.includes('safety') || text.includes('সতর্কতা')) {
            userState.set(senderID, 'main_menu');
            lastUserActivity.set(senderID, currentTime);
            await sock.sendMessage(senderID, { 
                text: `🛡️ *জরুরি নিরাপত্তা ও সতর্কতা:*
❌ গেম পাসওয়ার্ড বা OTP কাউকে দেবেন না। FF ServicesPicks কখনো পাসওয়ার্ড চায় না। সঠিক UID প্রদান করুন।

↩️ মূল মেনুতে যেতে চ্যাটে **"Menu"** লিখুন!` 
            });
            return;
        }

        // অপশন ৫: কাস্টমার সাপোর্ট
        if (text === '5' || text.includes('support') || text.includes('admin') || text.includes('সাহায্য')) {
            supportUsers.add(senderID);
            lastUserActivity.set(senderID, currentTime);
            await sock.sendMessage(senderID, { 
                text: `💬 *অ্যাডমিন ও কাস্টমার সাপোর্ট*
আপনার মেসেজটি এখানে লিখে পাঠান। খুব শীঘ্রই অ্যাডমিন আপনার সাথে কথা বলবেন! ❤️` 
            });
            return;
        }

        // ভুল বা আবলতাবল মেসেজ লিখলে (১ ঘণ্টার টাইমার চেক করে)
        const lastErrorTime = lastErrorActivity.get(senderID) || 0;
        if (currentTime - lastErrorTime > oneHour) {
            lastErrorActivity.set(senderID, currentTime);
            lastUserActivity.set(senderID, currentTime);
            await sock.sendMessage(senderID, { 
                text: `❌ দুঃখিত, আপনার কমান্ডটি বুঝতে পারিনি। 

• অর্ডার করতে ও সবকিছু জানতে টাইপ করুন: **Menu** বা **1**
• কীভাবে অর্ডার করবেন জানতে টাইপ করুন: **3**
• জরুরি সতর্কতা জানতে টাইপ করুন: **4**
• অ্যাডমিনের সাথে সরাসরি কথা বলতে টাইপ করুন: **5**` 
            });
        } else {
            return;
        }
    });
}

connectToWhatsApp();
