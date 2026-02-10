const axios = require('axios');
const admin = require('firebase-admin');

// Gunakan config dari GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runReport() {
    try {
        console.log("Memulai pengambilan data...");
        const configSnap = await db.doc('target/global').get();
        // Perbaikan: .exists adalah properti, bukan fungsi ()
        const targetGoal = configSnap.exists ? configSnap.data().profitGoal : 1000000;
        
        const transSnap = await db.collection('transactions').get();
        let branchData = {};
        for(let i=0; i<=12; i++) branchData[i.toString().padStart(2, '0')] = { profit: 0 };

        const now = new Date();
        transSnap.forEach(doc => {
            const d = doc.data();
            const t = d.timestamp ? d.timestamp.toDate() : null;
            // Filter hanya transaksi bulan ini
            if (t && t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear()) {
                if (branchData[d.branch_code]) {
                    branchData[d.branch_code].profit += d.total_profit || 0;
                }
            }
        });

        const top4 = Object.entries(branchData)
            .sort((a, b) => b[1].profit - a[1].profit)
            .slice(0, 4);

        let msg = `📊 *REKAPITULASI 5156 HARI INI*\n\n🏆 *TOP 4 PERFORMER:*\n`;
        top4.forEach((b, i) => {
            const percent = ((b[1].profit / targetGoal) * 100).toFixed(0);
            msg += `${i+1}️⃣ *Cabang ${b[0]}*: Rp ${Math.floor(b[1].profit).toLocaleString('id-ID')} (${percent}%)\n`;
        });

        console.log("Mencoba kirim ke Telegram ID:", process.env.TELEGRAM_CHAT_ID);

        // Kirim ke Telegram
        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: 'Markdown'
        });
        
        console.log("Berhasil kirim ke Telegram!");
    } catch (e) { 
        console.error("Gagal mengirim:", e.message); 
    }
}

runReport();
