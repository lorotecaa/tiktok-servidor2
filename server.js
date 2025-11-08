// ===============================
// 🎯 TIKTOK SERVER - Conexión por Usuario dinámico
// ===============================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.get("/", (req, res) => {
    res.send("Servidor TikTok Live funcionando ✅");
});

// 💾 Guardar conexiones por streamerId
const conexiones = {};

// 🧠 Función para iniciar conexión TikTok dinámica
async function conectarTiktok(streamerId, tiktokUser) {
    if (conexiones[streamerId]) {
        console.log(`⚠️ Ya hay conexión para ${streamerId}`);
        return;
    }

    const username = tiktokUser?.replace("@", "") || streamerId;
    const tiktokConnection = new WebcastPushConnection(username);

    console.log(`🎥 Conectando con TikTok Live de @${username}`);

    try {
        await tiktokConnection.connect();
        console.log(`✅ Conectado a la transmisión de @${username}`);
    } catch (err) {
        console.log(`❌ No se pudo conectar con @${username}`);
        return;
    }

    conexiones[streamerId] = tiktokConnection;

    // 🪙 Cuando llega un regalo
    tiktokConnection.on("gift", (data) => {
        const regalo = {
            usuario: data.uniqueId,
            cantidad: data.diamondCount || 1,
            regalo: data.giftName || "Desconocido",
            avatar_url: data.profilePictureUrl || "",
            streamerId
        };
        console.log(`🎁 Nuevo regalo de ${regalo.usuario}: +${regalo.cantidad}`);
        io.to(streamerId).emit("new_gift", regalo);
    });

    // 💬 Mensajes opcionales (por si quieres agregarlos)
    tiktokConnection.on("chat", (msg) => {
        io.to(streamerId).emit("new_chat", {
            usuario: msg.uniqueId,
            comentario: msg.comment
        });
    });

    // ⚠️ Manejo de desconexión
    tiktokConnection.on("disconnected", () => {
        console.log(`⚠️ Desconectado de @${username}`);
        delete conexiones[streamerId];
    });
}

// ===============================
// 🎮 SOCKET.IO
// ===============================
io.on("connection", (socket) => {
    console.log("🟢 Nuevo cliente conectado.");

    // 🧩 Unirse a una sala
    socket.on("join_room", async ({ streamerId, tiktokUser }) => {
        socket.join(streamerId);
        console.log(`📡 Cliente unido a sala: ${streamerId}`);
        io.to(streamerId).emit("mensaje_servidor", `🎥 Conectando con TikTok Live de @${tiktokUser}`);

        // 🔥 Conectar TikTok dinámicamente
        conectarTiktok(streamerId, tiktokUser);
    });

    // 🪙 Evento simulado desde el dashboard
    socket.on("nuevo_regalo", (gift) => {
        io.to(gift.streamerId).emit("new_gift", gift);
    });

    // 🕹️ Eventos de control
    socket.on("iniciar_subasta", () => io.emit("subasta_iniciada"));
    socket.on("finalizar_subasta", () => io.emit("subasta_finalizada"));
    socket.on("anunciar_ganador", (g) => io.emit("ganador_anunciado", g));
    socket.on("limpiar_listas", () => io.emit("limpiar_listas"));
});

// ===============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
