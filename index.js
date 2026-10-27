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

// ইউজারের সাপোর্ট মোড ট্র্যাক করার জন্য মেমোরি স্টোরেজ
const supportUsers = new Set();

async function connectToWhatsApp() {
    const authFolder = 'auth_info_baileys';
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Windows", "Chrome", "115.0.0.0"]
    });

    // পেয়ারিং কোড জেনারেট করার লজিক (লগআউট করার পর নতুন কোড পাওয়ার জন্য)
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
        
        // টেক্সট অথবা লিস্ট রেসপন্স ক্যাচ করার লজিক
        const messageText = msg.message.conversation || 
                            msg.message.extendedTextMessage?.text || 
                            msg.message.listResponseMessage?.singleSelectReply?.selectedRowId;
                            
        if (!messageText) return;

        const text = messageText.trim().toLowerCase();

        // ইউজার যদি যেকোনো সময় "menu" লিখে পাঠায়, তবে সাপোর্ট মোড কেটে যাবে এবং মূল লিস্ট মেনু চলে আসবে
        if (text === 'menu' || text === 'মেনু') {
            supportUsers.delete(senderID);
            
            const listMessage = {
                text: `🎮 *FF ServicesPicks-এ আপনাকে স্বাগতম!* \n\nআপনার ফ্রি ফায়ার প্রোফাইলকে আরও আকর্ষণীয় করতে আমাদের কাছ থেকে খুব সহজেই লাইক নিতে পারেন। ♥️\n\n🌐 অফিশিয়াল ওয়েবসাইট:\nhttps://ffserviceshub.github.io/FF-Like-ServicesPicks/\n\nনিচের **"View Menu"** বাটনে ক্লিক করে অপশনগুলো বেছে নিন:`,
                footer: "FF ServicesPicks Auto Bot",
                title: "✨ Main Menu ✨",
                buttonText: "👉 View Menu",
                sections: [
                    {
                        title: "সেবাসমূহ ও তথ্য",
                        rows: [
                            { title: "🔥 লাইক প্যাকেজ ও দামসমূহ", rowId: "1", description: "সকল প্রিমিয়াম ফ্রি ফায়ার লাইক প্যাকেজ" },
                            { title: "💳 বিকাশ (bKash) পেমেন্ট নিয়ম", rowId: "2", description: "টাকা পাঠানোর পার্সোনাল নম্বর ও নিয়ম" },
                            { title: "📋 খুব সহজে যেভাবে অর্ডার করবেন", rowId: "3", description: "ধাপে ধাপে অর্ডার করার সঠিক গাইডলাইন" },
                            { title: "🛡️ জরুরি নিরাপত্তা সতর্কতা", rowId: "4", description: "অ্যাকাউন্ট সেফটি ও গুরুত্বপূর্ণ টিপস" },
                            { title: "💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন", rowId: "5", description: "সরাসরি সাপোর্ট ও লাইভ চ্যাট মোড" }
                        ]
                    }
                ]
            };
            
            await sock.sendMessage(senderID, listMessage);
            return;
        }

        // ইউজার যদি ইতিমধ্যে সাপোর্ট মোডে থাকে
        if (supportUsers.has(senderID)) {
            return; 
        }

        // অপশন ১: প্যাকেজ ও দামসমূহ
        if (text === '1' || text.includes('package') || text.includes('like') || text.includes('প্যাকেজ') || text.includes('দাম')) {
            await sock.sendMessage(senderID, { 
                text: `🔥 *FF ServicesPicks — প্রিমিয়াম ফ্রি ফায়ার লাইক প্যাকেজসমূহ* 

আপনার পছন্দের প্যাকেজটি বেছে নিন:

1️⃣ *Ultra Package*
- দাম: ৳২৫০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: ৩০ দিন

2️⃣ *60-Day Value*
- দাম: ৳২২০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৬০ দিন

3️⃣ *150+ Likes Package*
- দাম: ৳২২০ | ডেইলি: ১৫০+ লাইক ♥️ | মেয়াদ: ৩০ দিন

4️⃣ *60-Day Pro*
- দাম: ৳৩২০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৬০ দিন

5️⃣ *Yearly Value*
- দাম: ৳৮০০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন

6️⃣ *👑 50+ Likes Permanent*
- দাম: ৳১,০৫০ | ডেইলি: ৫০+ লাইক ♥️ | মেয়াদ: আজীবন (Permanent)

7️⃣ *🌟 Yearly Pro*
- দাম: ৳১,২০০ | ডেইলি: ৮০+ লাইক ♥️ | মেয়াদ: ৩৬৫ দিন

8️⃣ *💎 200+ Likes Permanent*
- দাম: ৳৫,০০০ | ডেইলি: ২০০+ লাইক ♥️ | মেয়াদ: আজীবন (Permanent)

🌐 সব প্যাকেজের বিস্তারিত ও ফুল লিস্ট দেখতে ভিজিট করুন:
https://ffserviceshub.github.io/FF-Like-ServicesPicks/

↩️ মূল মেনুতে ফিরে যেতে চ্যাটে শুধু **"Menu"** লিখে পাঠান!` 
            });
        } 
        // অপশন ২: পেমেন্ট পদ্ধতি
        else if (text === '2' || text.includes('payment') || text.includes('bkash') || text.includes('বিকাশ') || text.includes('টাকা')) {
            await sock.sendMessage(senderID, { 
                text: `💳 *বিকাশ (bKash) পেমেন্ট নির্দেশিকা*

প্যাকেজ কনফার্ম করতে নিচের পার্সোনাল নম্বরে সঠিক টাকা *Send Money* করুন:

📱 *bKash Personal:* \`01733054857\`

⚠️ *টাকা পাঠানোর পর যা করবেন:*
টাকা পাঠানো শেষ হলে আমাদের চ্যাটে নিচের তথ্যগুলো লিখে পাঠিয়ে দিন:
১. আপনার *Free Fire UID* (শুধু গেমের সংখ্যা আইডি)
২. ট্রানজাকশন আইডি (*TrxID*) অথবা আপনার বিকাশ নম্বর

আমাদের টিম পেমেন্ট চেক করে খুব দ্রুত আপনার অর্ডার কনফার্ম করে দেবে! ✅

↩️ মূল মেনুতে ফিরে যেতে চ্যাটে শুধু **"Menu"** লিখে পাঠান!` 
            });
        } 
        // অপশন ৩: অর্ডার করার সঠিক নিয়ম
        else if (text === '3' || text.includes('rules') || text.includes('অর্ডার') || text.includes('নিয়ম')) {
            await sock.sendMessage(senderID, { 
                text: `📋 *খুব সহজেই যেভাবে অর্ডার করবেন:*

১️⃣ প্রথমে চ্যাটে **1** লিখে আমাদের প্যাকেজ লিস্ট দেখে আপনার পছন্দের প্যাকেজটি ঠিক করুন।
২️⃣ নির্দিষ্ট পরিমাণ টাকা আমাদের বিকাশ পার্সোনাল নম্বরে (\`01733054857\`) *Send Money* করুন।
৩️⃣ এরপর নিচের ফরম্যাটটি কপি করে এই চ্যাটে আপনার তথ্য দিয়ে পাঠিয়ে দিন:

   💬 *UID:* [আপনার গেমের UID দিন]
   💬 *TrxID/Number:* [বিকাশের ট্রানজাকশন আইডি বা আপনার নম্বর]

৪️⃣ পেমেন্ট সফলভাবে যাচাই হওয়ার সাথে সাথেই আপনার অর্ডারটি চালু করে দেওয়া হবে! 🚀

↩️ মূল মেনুতে ফিরে যেতে চ্যাটে শুধু **"Menu"** লিখে পাঠান!` 
            });
        }
        // অপশন ৪: নিরাপত্তা সতর্কতা ও FAQ
        else if (text === '4' || text.includes('faq') || text.includes('safety') || text.includes('সতর্কতা')) {
            await sock.sendMessage(senderID, { 
                text: `🛡️ *জরুরি নিরাপত্তা ও সতর্কতা:*

❌ *গেম পাসওয়ার্ড বা OTP:* FF ServicesPicks কখনো আপনার গেমের পাসওয়ার্ড, ফেসবুক বা জিমেইল অ্যাকাউন্ট কিংবা কোনো প্রকার OTP চাইবে না। নিজের পাসওয়ার্ড কাউকে দেবেন না।
🔢 *সঠিক UID প্রদান:* Free Fire UID দেওয়ার সময় খুব ভালোভাবে চেক করে নেবেন, ভুল UID দিলে লাইক অন্য অ্যাকাউন্টে চলে যেতে পারে।
✋ *ম্যানুয়াল ভেরিফিকেশন:* টাকা পাঠানোর পর চ্যাটে সঠিক তথ্য দিলে অ্যাডমিন নিজেই যাচাই করে সার্ভিস স্টার্ট করে দেবেন।

↩️ মূল মেনুতে ফিরে যেতে চ্যাটে শুধু **"Menu"** লিখে পাঠান!` 
            });
        }
        // অপশন ৫: কাস্টমার সাপোর্ট
        else if (text === '5' || text.includes('support') || text.includes('admin') || text.includes('সাহায্য')) {
            supportUsers.add(senderID);
            await sock.sendMessage(senderID, { 
                text: `💬 *কাস্টমার সাপোর্ট ও সাহায্য*

আপনার সমস্যা বা মেসেজটি এখানে লিখে পাঠান। আমাদের অ্যাডমিন খুব শীঘ্রই আপনার সাথে সরাসরি কথা বলবেন! ❤️

↩️ মূল মেনুতে আবার ফিরে যেতে চাইলে চ্যাটে যেকোনো সময় শুধু **"Menu"** লিখে পাঠান।` 
            });
        }
        // ডিফল্ট মেনু (লিস্ট বাটন সহ)
        else {
            const listMessage = {
                text: `🎮 *FF ServicesPicks-এ আপনাকে স্বাগতম!* \n\nআপনার ফ্রি ফায়ার প্রোফাইলকে আরও আকর্ষণীয় করতে আমাদের কাছ থেকে খুব সহজেই লাইক নিতে পারেন। ♥️\n\n🌐 অফিশিয়াল ওয়েবসাইট:\nhttps://ffserviceshub.github.io/FF-Like-ServicesPicks/\n\nনিচের **"View Menu"** বাটনে ক্লিক করে অপশনগুলো বেছে নিন:`,
                footer: "FF ServicesPicks Auto Bot",
                title: "✨ Main Menu ✨",
                buttonText: "👉 View Menu",
                sections: [
                    {
                        title: "সেবাসমূহ ও তথ্য",
                        rows: [
                            { title: "🔥 লাইক প্যাকেজ ও দামসমূহ", rowId: "1", description: "সকল প্রিমিয়াম ফ্রি ফায়ার লাইক প্যাকেজ" },
                            { title: "💳 বিকাশ (bKash) পেমেন্ট নিয়ম", rowId: "2", description: "টাকা পাঠানোর পার্সোনাল নম্বর ও নিয়ম" },
                            { title: "📋 খুব সহজে যেভাবে অর্ডার করবেন", rowId: "3", description: "ধাপে ধাপে অর্ডার করার সঠিক গাইডলাইন" },
                            { title: "🛡️ জরুরি নিরাপত্তা সতর্কতা", rowId: "4", description: "অ্যাকাউন্ট সেফটি ও গুরুত্বপূর্ণ টিপস" },
                            { title: "💬 অ্যাডমিনের সাথে সরাসরি কথা বলুন", rowId: "5", description: "সরাসরি সাপোর্ট ও লাইভ চ্যাট মোড" }
                        ]
                    }
                ]
            };
            
            await sock.sendMessage(senderID, listMessage);
        }
    });
}

connectToWhatsApp();
