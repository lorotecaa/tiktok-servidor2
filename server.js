// ===============================
// 📦 SERVIDOR PRINCIPAL TIKTOK (MULTI-USUARIO)
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

// Ruta para el Dashboard principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🛑 AÑADIDO: Ruta para el Widget
app.get("/widget", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// ⚙️ CONEXIONES TIKTOK POR USUARIO
// ===============================
const conexionesTikTok = {}; // Guardará conexiones por streamerId

io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado:", socket.id);

  socket.on("join_room", async (data) => {
    const streamerId = data?.streamerId?.replace("@", "");
    if (!streamerId) return;

    console.log(`📡 Cliente unido a sala: ${streamerId}`);
    socket.join(streamerId);

    // Si no existe una conexión activa para este streamer, crearla
    if (!conexionesTikTok[streamerId]) {
      console.log(`🎥 Conectando con TikTok Live de @${streamerId}`);

      const tiktokConn = new WebcastPushConnection(streamerId, {
        enableWebsocketUpgrade: true,
        requestOptions: { timeout: 10000 },
        disableEulerFallbacks: true
      });

      try {
        await tiktokConn.connect();
        console.log(`✅ Conectado a la transmisión de @${streamerId}`);
      } catch (err) {
        console.error(`❌ Error conectando con @${streamerId}:`, err);
        socket.emit("error_conexion", { message: "No se pudo conectar al Live." });
        return;
      }

      // Guardar conexión
      conexionesTikTok[streamerId] = tiktokConn;

      // 🎁 Evento: regalo recibido
      tiktokConn.on("gift", (data) => {
        const giftData = {
          userId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          diamondCount: data.diamondCount || 0,
          giftName: data.giftName,
          repeatCount: data.repeatCount,
          streakable: data.streakable
        };
        console.log(`🎁 [${streamerId}] ${giftData.nickname} envió ${giftData.giftName} x${giftData.repeatCount}`);
        io.to(streamerId).emit("new_gift", giftData);
      });

      // 💬 Evento: mensaje en el chat
      tiktokConn.on("chat", (data) => {
        io.to(streamerId).emit("new_chat", {
          user: data.uniqueId,
          comment: data.comment
        });
      });

      // ❤️ Evento: likes
      tiktokConn.on("like", (data) => {
        io.to(streamerId).emit("new_like", {
          user: data.uniqueId,
          likeCount: data.likeCount
        });
      });
    }
  });

  // ===============================
  // ⚡ EVENTOS DE SUBASTA
  // ===============================
  socket.on("iniciar_subasta", (data) => {
    
    // 🛑 SOLUCIÓN BUG TIKFINITY (Paso 1): Limpiar la lista de participantes acumulados
    participantes = {}; 
    
    console.log("🚀 Subasta iniciada y lista de participantes limpia.");
    
    // 🛑 SOLUCIÓN BUG TIKFINITY (Paso 2): Notificar a todos los clientes (widgets/dashboard) 
    // que la lista debe estar vacía. Tu cliente escuchará 'update_participantes'.
    io.emit("update_participantes", participantes); 
    
    // Lógica original:
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
