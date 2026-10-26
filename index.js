const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false // QR কোড বন্ধ রাখা হলো
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
            console.log('✅ WhatsApp bot successfully connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // যদি আগে কানেক্ট করা না থাকে, তবে ক্লাউড লগেই Pairing Code জেনারেট করে দেখাবে
    if (!sock.authState.creds.registered) {
        // আপনার বোট নম্বরটি এখানে দেশের কোডসহ বসিয়ে দিন (যেমন: 8801951722651)
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

    // মেসেজ হ্যান্ডলিং লজিক
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderID = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!messageText) return;

        const text = messageText.trim().toLowerCase();

        if (text === 'hi' || text === 'hello' || text === 'menu' || text === 'ff') {
            await sock.sendMessage(senderID, { 
                text: `🎮 *FF ServicesPicks-এ স্বাগতম!*\nপ্রোফাইল সুন্দর করুন Likes-এর সাথে!\n\n1️⃣ Package o dam\n2️⃣ bKash payment poddhoti\n3️⃣ Order niyom\n4️⃣ Support\n\n1, 2, 3 ba 4 likhe reply din.` 
            });
        } 
        else if (text === '1') {
            await sock.sendMessage(senderID, { text: `👑 50+ Likes Permanent Package\n• Dam: ৳1,050\n• Protidin 50+ Likes target` });
        } 
        else if (text === '2') {
            await sock.sendMessage(senderID, { text: `💳 bKash Send Money: 01733054857` });
        } 
        else if (text === '3') {
            await sock.sendMessage(senderID, { text: `📋 UID o TrxID likhe chat-e pathiye din.` });
        }
        else if (text === '4') {
            await sock.sendMessage(senderID, { text: `💬 Admin-er sathe jogajoger jonno opeksha korun.` });
        }
    });
}

connectToWhatsApp();
