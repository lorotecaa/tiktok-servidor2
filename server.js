// ===============================
// 📦 SERVIDOR PRINCIPAL TIKTOK (CONECTADO CON TIKTOK-LIVE-CONNECTOR)
// ===============================

// Dependencias
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { WebcastPushConnection } = require("tiktok-live-connector");
require("dotenv").config();

// ===============================
// 🌐 CONFIGURACIÓN EXPRESS
// ===============================
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;

// Carpeta pública
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// ⚙️ CONEXIÓN A TIKTOK LIVE
// ===============================
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "@tu_usuario_tiktok";

const tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);

tiktokLiveConnection.connect().then((state) => {
  console.log(`✅ Conectado a la sala de ${TIKTOK_USERNAME}`);
}).catch((err) => {
  console.error("❌ Error al conectar con TikTok:", err);
});

// 🎁 Evento de regalo recibido
tiktokLiveConnection.on('gift', (data) => {
  const giftData = {
    userId: data.uniqueId,
    nickname: data.nickname,
    profilePictureUrl: data.profilePictureUrl,
    diamondCount: data.diamondCount || 0,
    giftName: data.giftName,
    repeatCount: data.repeatCount,
    streakable: data.streakable
  };

  console.log(`🎁 ${giftData.nickname} envió ${giftData.giftName} x${giftData.repeatCount}`);
  io.emit("new_gift", giftData); // 🔁 Enviar a todos los clientes conectados
});

// 💬 Evento de mensaje en el chat
tiktokLiveConnection.on('chat', (data) => {
  io.emit("new_chat", {
    user: data.uniqueId,
    comment: data.comment
  });
});

// ❤️ Evento de likes
tiktokLiveConnection.on('like', (data) => {
  io.emit("new_like", {
    user: data.uniqueId,
    likeCount: data.likeCount
  });
});

// ===============================
// ⚡ CONFIGURACIÓN SOCKET.IO
// ===============================
const VALID_STREAMER_IDS = [
  "@yosoytoniu",
  "lorotecayt",
  "otro_usuario_autorizado"
];

io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado:", socket.id);

  socket.on("join_room", (data) => {
    if (data && data.streamerId) {
      const streamerId = data.streamerId;
      if (VALID_STREAMER_IDS.includes(streamerId)) {
        socket.join(streamerId);
        console.log(`🔗 [${streamerId}] Cliente unido a la sala.`);
      } else {
        console.log(`❌ ERROR: ID Inválido (${streamerId}) intentó unirse.`);
        socket.emit("id_invalido", {
          streamerId: streamerId,
          message: "ID no autorizado. Por favor, comunícate con el administrador."
        });
      }
    }
  });

  socket.on("iniciar_subasta", (data) => {
    console.log("🚀 Subasta iniciada");
    io.emit("subasta_iniciada", data);
  });

  socket.on("sync_time", (time) => {
    socket.broadcast.emit("update_time", time);
  });

  socket.on("finalizar_subasta", () => {
    console.log("⏹️ Subasta finalizada.");
    io.emit("subasta_finalizada");
  });

  socket.on("activar_alerta_snipe_visual", () => {
    console.log("⚡ ALERTA SNIPE ACTIVADA");
    io.emit("activar_alerta_snipe_visual");
  });

  socket.on("anunciar_ganador", (ganador) => {
    console.log("🏆 Ganador:", ganador);
    io.emit("anunciar_ganador", ganador);
  });

  socket.on("limpiar_listas", () => {
    console.log("🧹 Limpiando listas...");
    io.emit("limpiar_listas_clientes");
  });
});

// ===============================
// 🚀 INICIAR SERVIDOR
// ===============================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
