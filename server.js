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
// ===============================
// 💎 MAPA DE VALORES PARA REGALOS QUE FALLAN
// ===============================
const highValueGiftMap = {
    // Regalos de 1 Moneda (0.5 Diamantes) (Incluidos porque a veces fallan a 0)
    "HeartMe": 0.5,
    "Rose": 0.5,
    
    // Regalos de 100 - 449 Monedas (50 - 224.5 Diamantes)
    // Se usan los valores de las fotos anteriores:
    "Confeti": 50, // 100 Monedas
    "Cadenainfinita": 50, // 100 Monedas
    "Globosconformadecorazon": 74.5, // 149 Monedas
    "Lazo": 74.5, // 149 Monedas
    "Corazones": 99.5, // 199 Monedas
    "Sombrerodemurciélago": 149.5, // 299 Monedas
    "Bailaríninflable": 150, // 300 Monedas
    "Koalaastronauta": 174.5, // 349 Monedas
    "Ocarelajada": 199.5, // 399 Monedas
    "Botíndedulces": 224.5, // 449 Monedas
    
    // Regalos de 450 - 999 Monedas (225 - 499.5 Diamantes)
    "Gorrodivertido": 225, // 450 Monedas
    "Mentepoderosa": 225, // 450 Monedas
    "Sombrerodivertidode": 225, // 450 Monedas (Asumo que el nombre es truncado)
    "Coral": 249.5, // 499 Monedas
    "Espectáculofloral": 250, // 500 Monedas
    "Pistoladedinero": 250, // 500 Monedas
    "FloresXXXL": 250, // 500 Monedas
    "Manifestando": 250, // 500 Monedas
    "Calentamientoestelar": 250, // 500 Monedas
    "GafasdeDJ": 250, // 500 Monedas
    "Abracitos": 250, // 500 Monedas
    "Polaris": 250, // 500 Monedas
    "Coronadedragón": 250, // 500 Monedas
    "Cascodecarrera": 250, // 500 Monedas
    "Molasunmontón": 250, // 500 Monedas
    "Prince": 250, // 500 Monedas
    "Sacandounapequeña": 250, // 500 Monedas (Nombre truncado)
    "GafasdeRV": 250, // 500 Monedas
    "Sombreroorejitas": 250, // 500 Monedas
    "Alasradiantes": 300, // 600 Monedas
    "Cisne": 349.5, // 699 Monedas
    "Escenarioprincipal": 350, // 700 Monedas
    "Alascoloridas": 350, // 700 Monedas
    "Tren": 449.5, // 899 Monedas
    "Ondainfinita": 450, // 900 Monedas
    "Viajejuntos": 499.5, // 999 Monedas
    
    // Regalos de 1000 - 4888 Monedas (500 - 2444 Diamantes)
    "Alasdehadas": 500, // 1000 Monedas
    "RitmoFlamenco": 500, // 1000 Monedas
    "Jirafa": 500, // 1000 Monedas
    "Galaxia": 500, // 1000 Monedas
    "Oroinfinito": 500, // 1000 Monedas
    "Amorsandía": 500, // 1000 Monedas
    "Medusabrillante": 500, // 1000 Monedas
    "Lámparamágica": 500, // 1000 Monedas
    "SúperLIVEStar": 500, // 1000 Monedas
    "Pluma": 500, // 1000 Monedas
    "Fuegosartificiales": 544, // 1088 Monedas
    "Refugiodelamor": 600, // 1200 Monedas
    "Escenariovibrante": 700, // 1400 Monedas
    "Coronadediamante": 749.5, // 1499 Monedas
    "Bajocontrol": 750, // 1500 Monedas
    "GoldeAlAhly": 750, // 1500 Monedas
    "Estrellasfugaces": 790, // 1580 Monedas
    "Navedenivel": 750, // 1500 Monedas
    "Debutenlascarreras": 750, // 1500 Monedas
    "Tarjetadefelicitación": 750, // 1500 Monedas
    "Futuroencuentro": 750, // 1500 Monedas
    "Todoporunsueño": 750, // 1500 Monedas
    "TrofeoEWC": 750, // 1500 Monedas
    "Zorrodenuevecolas": 900, // 1800 Monedas
    "Fuegosartificialesmisil": 999.5, // 1999 Monedas
    "Coopervuelaacasa": 999.5, // 1999 Monedas
    "Discoteca": 1000, // 2000 Monedas
    "Ballenasumergida": 1075, // 2150 Monedas
    "TirabesosconRosie": 1099.5, // 2199 Monedas
    "ElpuñetazodeRocky": 1099.5, // 2199 Monedas
    "BotdeMonedasdeoro": 1099.5, // 2199 Monedas
    "IslaCorazón": 1099.5, // 2199 Monedas
    "Bandaanimal": 1250, // 2500 Monedas
    "Acaríciame": 1400, // 2800 Monedas
    "Moto": 1494, // 2988 Monedas
    "Camiondehielados": 1494, // 2988 Monedas
    "Escalerasalafama": 1499.5, // 2999 Monedas
    "Ositorítmico": 1499.5, // 2999 Monedas
    "Lagodelamor": 1499.5, // 2999 Monedas
    "Drifting": 1500, // 3000 Monedas
    "Lluviademeteoritos": 1500, // 3000 Monedas
    "Espírituvoador": 1999.5, // 3999 Monedas
    "Tuconcierto": 2250, // 4500 Monedas
    "Dragóndefuego": 2444, // 4888 Monedas
    "Jetprivado": 2444, // 4888 Monedas
    "Leónelgatito": 2444, // 4888 Monedas
    "Navedelheroe": 2499.5, // 4999 Monedas
    "Amordecamello": 2499.5, // 4999 Monedas
    "Avionesvolando": 2500, // 5000 Monedas
    "Unicornioedefantasia": 2500, // 5000 Monedas
    "Pistoladediamantes": 2500, // 5000 Monedas
    "Aladelavictoria": 2500, // 5000 Monedas
    
    // Regalos de Alto Valor (> 5000 Monedas / > 2500 Diamantes)
    "Lobodeldesierto": 2750, // 5500 Monedas
    "Finalportodoloalto": 3000, // 6000 Monedas
    "Trabajomuchoydisfruta": 3000, // 6000 Monedas
    "Ciudaddelfuturo": 3000, // 6000 Monedas
    "LapandilladeBu": 3000, // 6000 Monedas
    "LeopardaLili": 3299.5, // 6599 Monedas
    "Cochedeportivo": 3500, // 7000 Monedas
    "DuneCar": 3850, // 7700 Monedas
    "Escudodediamante": 3999.5, // 7999 Monedas
    "LeoncitoLili": 4849.5, // 9699 Monedas
    "Gloriaeneldesierto": 4999.5, // 9999 Monedas
    "Bulevardelocaso": 5000, // 10000 Monedas
    "Interstelar": 5000, // 10000 Monedas
    "Halcón": 5499.5, // 10999 Monedas
    "Cochedecarreras": 6000, // 12000 Monedas
    "Mundodelacorona": 7499.5, // 14999 Monedas
    "Sementalarabe": 7500, // 15000 Monedas
    "Futuroviaje": 7500, // 15000 Monedas
    "Salóninfinito": 7500, // 15000 Monedas
    "Rosacósmica": 7500, // 15000 Monedas
    "Quesigalafiesta": 7500, // 15000 Monedas
    "PuentedelaBahíade": 7500, // 15000 Monedas (Truncado)
    "Pirámides": 7500, // 15000 Monedas
    "Tigreblanco": 7999.5, // 15999 Monedas
    "Parquedeatracciones": 8500, // 17000 Monedas
    "Salóndorador": 9000, // 18000 Monedas
    "Transbordador": 10000, // 20000 Monedas
    "ElsueñodeAdam": 12999.5, // 25999 Monedas
    "Fénix": 12999.5, // 25999 Monedas
    "Llamadedragón": 13499.5, // 26999 Monedas
    "León": 14999.5, // 29999 Monedas
    "Autodeportivodeoro": 14999.5, // 29999 Monedas
    "LeoncitoLeón": 17000, // 34000 Monedas
    "TikTokStars": 19999.5, // 39999 Monedas
    "TikTokUniverse": 22499.5, // 44999 Monedas
};

function configurarEventosTikTok(tiktokConn, streamerId, io) {

    // 🎁 Evento: regalo recibido (Lógica de Conteo, Filtro y Emisión de lista)
    tiktokConn.on("gift", (data) => {
    
    // 🛑 FILTRO CRÍTICO 1: Detener el conteo si la subasta no está activa
    if (subastaActiva === false) { 
        return; 
    }

    // 🚨 FILTRO DE DUPLICIDAD 🚨
    // Solo contamos si data.repeatEnd es TRUE para el evento final de una racha (giftType: 1).
    if (data.giftType === 1 && data.repeatEnd === false) {
        console.log(`[IGNORADO - Duplicidad] Ignorando evento intermedio/de racha para: ${data.giftName}`);
        return; 
    }
    
    const userId = data.uniqueId;
    let diamantes = 0; // Se inicializa en 0.

    // ✅ LÓGICA ROBUSTA FINAL POR TIPO DE REGALO (Con Fallback por Nombre) ✅

    // 1. Manejar REGALOS ÚNICOS/GRANDES (giftType: 0)
    if (data.giftType === 0) {
        // Opción A: Intentar usar el valor reportado (el más fiable, pero a veces falla).
        diamantes = data.diamondCount || 0;

        // Opción B: Si data.diamondCount reportó 0 o 1, y es un regalo conocido, usar el mapa manual.
        const giftNameKey = data.giftName.replace(/\s/g, ''); 
        
        if (diamantes <= 1 && highValueGiftMap[giftNameKey]) {
             diamantes = highValueGiftMap[giftNameKey];
             console.log(`[Cálculo - Manual] Asignando valor por nombre (${data.giftName}): ${diamantes} 💎`);
        } else {
             console.log(`[Cálculo - Único/Grande] Usando valor reportado: ${diamantes} 💎`);
        }
    }
    // 2. Manejar REGALOS DE RACHA (giftType: 1)
    else if (data.giftType === 1) {
        // Opción A: Usar el valor total reportado por TikTok.
        if (data.totalDiamondCount > 0) {
            diamantes = data.totalDiamondCount;
            console.log(`[Cálculo - Racha] Usando totalDiamondCount (esperado): ${diamantes} 💎`);
        }
        // Opción B: Si falla (es 0), hacemos el cálculo de racha manual.
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

    // 2. Notificar al cliente: Enviar la lista de participantes procesada
    io.to(streamerId).emit("update_participantes", participantes); 

    // 3. Log para el dashboard
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
