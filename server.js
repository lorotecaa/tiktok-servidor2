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

function configurarEventosTikTok(tiktokConn, streamerId, io) {

    // 🎁 Evento: regalo recibido (Lógica de Conteo, Filtro y Emisión de lista)
    tiktokConn.on("gift", (data) => {
    
    // 🛑 FILTRO CRÍTICO 1: Detener el conteo si la subasta no está activa
    if (subastaActiva === false) { 
        return; // Detiene la ejecución inmediatamente
    }

    // 🚨 FILTRO DE DUPLICIDAD 🚨
    // Solo contamos si data.repeatEnd es TRUE para el evento final de una racha (giftType: 1).
    // Los regalos ÚNICOS (giftType: 0) siempre pasan este filtro.
    if (data.giftType === 1 && data.repeatEnd === false) {
        console.log(`[IGNORADO - Duplicidad] Ignorando evento intermedio/de racha para: ${data.giftName}`);
        return; 
    }
    
    const userId = data.uniqueId;
    let diamantes = 0; // Se inicializa en 0 y se calcula a continuación.

    // ✅ LÓGICA ROBUSTA FINAL POR TIPO DE REGALO ✅

    // 1. Manejar REGALOS ÚNICOS/GRANDES (giftType: 0)
    // Para estos, data.diamondCount es el valor TOTAL más fiable.
    if (data.giftType === 0) {
        diamantes = data.diamondCount || 0;
        console.log(`[Cálculo - Único/Grande] Usando valor unitario (el más fiable): ${diamantes} 💎`);
    }
    // 2. Manejar REGALOS DE RACHA (giftType: 1)
    else if (data.giftType === 1) {
        // Opción A: Usar el valor total reportado por TikTok (el más fácil).
        if (data.totalDiamondCount > 0) {
            diamantes = data.totalDiamondCount;
            console.log(`[Cálculo - Racha] Usando totalDiamondCount (esperado): ${diamantes} 💎`);
        }
        // Opción B: Si falla (es 0), hacemos el cálculo de racha manual (el fallback).
        else if (data.diamondCount > 0) {
            diamantes = data.diamondCount * (data.repeatCount || 1);
            console.log(`[Cálculo - Racha Fallback] Calculando diamantes: ${diamantes} 💎`);
        }
    }
    
    // 1. CONTEO CENTRALIZADO: Lógica de acumulación
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
        io.to(streamerId).emit("update_participantes", participantes); // ✅ Ahora funciona

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
// 🛑 AÑADIR ESTA FUNCIÓN AQUÍ
function calcularGanador(listaParticipantes) {
    const participantesArray = Object.values(listaParticipantes);

    if (participantesArray.length === 0) {
        return null;
    }

    // Ordenar por cantidad descendente
    participantesArray.sort((a, b) => b.cantidad - a.cantidad);
    
    // Devolver el primero (el de mayor cantidad)
    return participantesArray[0];
}

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

            // 🛑 LLAMADA CRÍTICA: Se configura el event listener UNA SOLA VEZ
            configurarEventosTikTok(tiktokConn, streamerId, io); // ⬅️ AÑADIR 'io'
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
socket.on("reset_snipe_state_visual", () => {
    console.log("🚩 Bandera de Snipe Visual reseteada.");
    // Reemite la orden de resetear la bandera lógica en todos los Widgets
    io.emit("reset_snipe_state_visual"); 
});
socket.on("finalizar_subasta", () => {
    console.log("⏹️ Final de tiempo regular. Iniciando tiempo extra (Snipe)...");
    // 🛑 QUITAR: subastaActiva = false;

    io.emit("subasta_finalizada"); 
});
// server.js - Cerca de la línea 193
socket.on("subasta_terminada_total", () => {
    console.log("🛑 Subasta y tiempo extra FINALIZADOS. Deteniendo conteo.");
    subastaActiva = false; 

    // 1. 🥇 CALCULAR GANADOR
    const ganador = calcularGanador(participantes);
    
    if (ganador) {
        // 2. 🗑️ DEJAR SÓLO AL GANADOR EN LA LISTA GLOBAL
        // Creamos una nueva lista que solo contiene al ganador (usando su ID como clave)
        participantes = {
            [ganador.userId]: ganador
        };

        // 3. 📣 ANUNCIAR Y NOTIFICAR:
        // El dashboard usará esto para mostrar la animación, y el widget para el 'popup'.
        io.emit("anunciar_ganador", ganador); 
        
        // 4. 🖼️ ACTUALIZAR LISTA:
        // ¡CRÍTICO! Enviamos la nueva lista (que solo tiene al ganador) a todos los clientes.
        io.emit("update_participantes", participantes);
        
    } else {
        console.log("⚠️ No hubo participantes con donaciones. No se anuncia ganador.");
    }
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
socket.on("desactivar_alerta_snipe_visual", () => {
    console.log("🧹 ALERTA SNIPE DESACTIVADA");
    // Reemite la orden de limpieza a todos los clientes (widgets)
    io.emit("desactivar_alerta_snipe_visual"); 
});
  socket.on("limpiar_listas", () => {
    console.log("🧹 Limpiando listas...");
    
    // 🛑 CRÍTICO: VACÍAR LA LISTA GLOBAL DEL SERVIDOR
    participantes = {}; 
    
    // Notificar a los clientes que la lista está vacía
    io.emit("update_participantes", participantes); 
    
    // La línea io.emit("limpiar_listas_clientes"); YA NO ES NECESARIA, 
    // ya que el cliente debe escuchar "update_participantes"
});
});
// ===============================
// 🚀 INICIAR SERVIDOR
// ===============================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
