import axios from "axios";
import crypto from "crypto";

const BYBIT_KEY = "TA_CLE_API";
const BYBIT_SECRET = "TON_SECRET_API";
const TG_TOKEN = "TON_TOKEN_TELEGRAM";
const CHAT_ID = "TON_CHAT_ID"; // Exemple : -100123456789

function sign(params, secret) {
  const query = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function getPositions() {
  const params = { api_key: BYBIT_KEY, timestamp: Date.now() };
  params.sign = sign(params, BYBIT_SECRET);
  const res = await axios.get("https://api.bybit.com/v5/position/list", { params });
  return res.data.result.list;
}

async function sendMessage(msg) {
  await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    chat_id: CHAT_ID,
    text: msg,
    parse_mode: "Markdown"
  });
}

let lastPositions = {};

async function checkPositions() {
  try {
    const list = await getPositions();
    const open = list.filter(p => parseFloat(p.size) > 0);
    const current = {};

    for (const p of open) {
      const key = p.symbol;
      current[key] = p;

      if (!lastPositions[key]) {
        // --- NOUVELLE POSITION ---
        const side = p.side === "Buy" ? "?? Long" : "?? Short";
        const msg = `?? *Nouvelle position ouverte*\n\n` +
                    `• **${p.symbol}** ${side}\n` +
                    `• Taille: ${p.size}\n` +
                    `• Entrée: ${parseFloat(p.entryPrice).toFixed(2)} USDT\n` +
                    `• Levier: x${p.leverage}`;
        await sendMessage(msg);
      }
    }

    // Vérifie les positions fermées
    for (const key of Object.keys(lastPositions)) {
      if (!current[key]) {
        const p = lastPositions[key];
        const side = p.side === "Buy" ? "?? Long" : "?? Short";
        const pnl = parseFloat(p.unrealisedPnl).toFixed(2);
        const entry = parseFloat(p.entryPrice).toFixed(2);
        const msg = `? *Position fermée*\n\n` +
                    `• **${p.symbol}** ${side}\n` +
                    `• Entrée: ${entry} USDT\n` +
                    `• Profit: ${pnl} USDT`;
        await sendMessage(msg);
      }
    }

    lastPositions = current;
  } catch (e) {
    console.error("Erreur:", e.message);
  }
}

// Vérifie toutes les 10 secondes
setInterval(checkPositions, 10000);
checkPositions();