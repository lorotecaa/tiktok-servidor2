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
let participantes = {};
let subastaActiva = false;


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

      // 🎁 Evento: regalo recibido (Lógica de Conteo, Filtro y Emisión de lista)
      tiktokConn.on("gift", (data) => {
        
        // 🛑 FILTRO CRÍTICO 1: Detener el conteo si la subasta no está activa
        if (subastaActiva === false) { 
            // Opcional: puedes dejar un console.log aquí para debug
            return; // Detiene la ejecución inmediatamente
        }

        // 🛑 FILTRO CRÍTICO 2: FILTRO DE REPETICIÓN (Bug TikFinity)
        if (data.repeatEnd === false && data.giftType !== 1) {
            return; // Ignoramos la racha intermedia
        }

        const userId = data.uniqueId;
        const diamantes = data.diamondCount || 0;
        
        // 1. CONTEO CENTRALIZADO: Lógica de acumulación en el servidor
        if (diamantes > 0) {
            if (participantes[userId]) {
                // Existe: acumular
                participantes[userId].cantidad += diamantes;
            } else {
                // Nuevo: crear
                participantes[userId] = {
                    userId: userId,
                    usuario: data.nickname,
                    cantidad: diamantes,
                    avatar_url: data.profilePictureUrl
                };
            }
        }

        console.log(`🎁 [${streamerId}] ${data.nickname} envió ${data.giftName} - Total acumulado: ${participantes[userId]?.cantidad || diamantes} 💎`);
        
        // 2. Notificar al cliente: Enviar la lista de participantes procesada
        io.to(streamerId).emit("update_participantes", participantes); // <-- ¡CRÍTICO para tu Widget!

        // 3. Log para el dashboard (El cliente aún escucha 'new_gift' para el log visual)
        io.to(streamerId).emit("new_gift", {
          userId: userId,
          nickname: data.nickname,
          giftName: data.giftName,
          diamondCount: diamantes 
        });
        
        // 4. Lógica de Snipe...
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
    subastaActiva = true; // ✅ Subasta activada 
    
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
    subastaActiva = false; // ✅ Subasta desactivada
    io.emit("subasta_finalizada");
  });

  socket.on("activar_alerta_snipe_visual", () => {
    console.log("⚡ ALERTA SNIPE ACTIVADA");
    io.emit("activar_alerta_snipe_visual");
  });

 socket.on("anunciar_ganador", (ganador) => {
    console.log("🏆 Ganador:", ganador);
    // 🛑 El servidor RE-EMITE la señal a todos los clientes (incluyendo el widget)
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
