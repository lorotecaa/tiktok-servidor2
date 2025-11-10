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
const normalizeGiftName = (name) => {
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/ñ/g, 'n')
        .replace(/\s/g, ''); 
};
const highValueGiftMap = {
    // Regalos de 1 Moneda (0.5 Diamantes)
    "Heart Me": 1,
    
    // Regalos de 100 - 449 Monedas (50 - 224.5 Diamantes)
    "Confeti": 50,
    "Cadenainfinita": 50,
    "Globosconformadecorazon": 74.5,
    "Lazo": 74.5,
    "Corazones": 99.5,
    "Sombrerodemurcielago": 149.5, // Tilde removida (o->o)
    "Bailarininflable": 150, // Tilde removida (i->i)
    "Koalaastronauta": 174.5,
    "Ocarelajada": 199.5,
    "Botindeculces": 224.5, // Tilde removida (u->u)
    
    // Regalos de 450 - 999 Monedas (225 - 499.5 Diamantes)
    "Gorrodivertido": 225,
    "Mentepoderosa": 225,
    "Sombrerodivertidode": 225, 
    "Coral": 249.5,
    "Espectaculofloral": 250, // Tilde removida (a->a)
    "Pistoladedinero": 250,
    "FloresXXXL": 250,
    "Manifestando": 250,
    "Calentamientoestelar": 250,
    "GafasdeDJ": 250,
    "Abracitos": 250,
    "Polaris": 250,
    "Coronadedragon": 250, // Tilde removida (o->o)
    "Cascodecarrera": 250,
    "Molasunmonton": 250, // Tilde removida (o->o)
    "Prince": 250,
    "Sacandounapequena": 250, // Ñ removida (n->n)
    "GafasdeRV": 250,
    "Sombreroorejitas": 250,
    "Alasradiantes": 300,
    "Cisne": 349.5,
    "Escenarioprincipal": 350,
    "Alascoloridas": 350,
    "Tren": 449.5,
    "Ondainfinita": 450,
    "Viajejuntos": 499.5,
    
    // Regalos de 1000 - 4888 Monedas (500 - 2444 Diamantes)
    "Alasdehadas": 500,
    "RitmoFlamenco": 500,
    "Jirafa": 500,
    "Galaxia": 500,
    "Oroinfinito": 500,
    "Amorsandia": 500, // Tilde removida (i->i)
    "Medusabrillante": 500,
    "Lamparamagica": 500, // Tilde removida (a->a)
    "SuperLIVEStar": 500, // Tilde removida (u->u)
    "Pluma": 500,
    "Fuegosartificiales": 544,
    "Refugiodelamor": 600,
    "Escenariovibrante": 700,
    "Coronadediamante": 749.5,
    "Bajocontrol": 750,
    "GoldeAlAhly": 750,
    "Estrellasfugaces": 790,
    "Navedenivel": 750,
    "Debutenlascarreras": 750,
    "Tarjetadefelicitacion": 750, // Tilde removida (o->o)
    "Futuroencuentro": 750,
    "Todoporunsueno": 750, // Ñ removida (n->n)
    "TrofeoEWC": 750,
    "Zorrodenuevecolas": 900,
    "Fuegosartificialesmisil": 999.5,
    "Coopervuelaacasa": 999.5,
    "Discoteca": 1000,
    "Ballenasumergida": 1075,
    "TirabesosconRosie": 1099.5,
    "ElpunetazodeRocky": 1099.5, // Ñ removida (n->n)
    "BotdeMonedasdeoro": 1099.5,
    "IslaCorazon": 1099.5, // Tilde removida (o->o)
    "Bandaanimal": 1250,
    "Acariciame": 1400, // Tilde removida (a->a)
    "Moto": 1494,
    "Camiondehielados": 1494,
    "Escalerasalafama": 1499.5,
    "Ositoritmico": 1499.5, // Tilde removida (i->i)
    "Lagodelamor": 1499.5,
    "Drifting": 1500,
    "Lluviademeteoritos": 1500,
    "Espirituvolador": 1999.5, // Tilde removida (i->i)
    "Tuconcierto": 2250,
    "Dragondefuego": 2444, // Tilde removida (o->o)
    "Jetprivado": 2444,
    "Leonelgatito": 2444, // Tilde removida (o->o)
    "Navedelheroe": 2499.5,
    "Amordecamello": 2499.5,
    "Avionesvolando": 2500,
    "Unicorniodefantasia": 2500,
    "Pistoladediamantes": 2500,
    "Aladelavictoria": 2500,
    
    // Regalos de Alto Valor (> 5000 Monedas / > 2500 Diamantes)
    "Lobodeldesierto": 2750,
    "Finalportodoloalto": 3000,
    "Trabajomuchoydisfruta": 3000,
    "Ciudaddelfuturo": 3000,
    "LapandilladeBu": 3000,
    "LeopardaLili": 3299.5,
    "Cochedeportivo": 3500,
    "DuneCar": 3850,
    "Escudodediamante": 3999.5,
    "LeoncitoLili": 4849.5,
    "Gloriaeneldesierto": 4999.5,
    "Bulevardelocaso": 5000,
    "Interstelar": 5000,
    "Halcon": 5499.5, // Tilde removida (o->o)
    "Cochedecarreras": 6000,
    "Mundodelacorona": 7499.5,
    "Sementalarabe": 7500,
    "Futuroviaje": 7500,
    "Saloninfinito": 7500, // Tilde removida (o->o)
    "Rosacosmica": 7500, // Tilde removida (o->o)
    "Quesigalafiesta": 7500,
    "PuentedelaBahiade": 7500, // Tilde removida (i->i)
    "Piramides": 7500, // Tilde removida (a->a)
    "Tigreblanco": 7999.5,
    "Parquedeatracciones": 8500,
    "Salondorado": 9000, // Tilde removida (o->o)
    "Transbordador": 10000,
    "ElsueñodeAdam": 12999.5, // Ñ removida (n->n)
    "Fenix": 12999.5, // Tilde removida (e->e)
    "Llamadedragon": 13499.5, // Tilde removida (o->o)
    "Leon": 14999.5, // Tilde removida (o->o)
    "Autodeportivodeoro": 14999.5,
    "LeoncitoLeon": 17000, // Tilde removida (o->o)
    "TikTokStars": 19999.5,
    "TikTokUniverse": 22499.5,
    
    // Regalos Globales Comunes que fallan (Welcome Seal, Lion, Universe, etc.)
    "WelcomeSeal": 10000, 
    "Lion": 14999.5, 
    "Universe": 22499.5, // Se asume que este es el nombre que usa la librería a veces
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
    // NOTA: Para regalos tipo 0 (grandes) no existe 'repeatEnd', se procesan una vez.
    if (data.giftType === 1 && data.repeatEnd === false) {
        console.log(`[IGNORADO - Duplicidad] Ignorando evento intermedio/de racha para: ${data.giftName}`);
        return; 
    }
    
    const userId = data.uniqueId;
    let diamantes = 0; // Se inicializa en 0.

    // ✅ PASO CRÍTICO: NORMALIZAR el nombre para la búsqueda en el mapa
    const giftNameKey = normalizeGiftName(data.giftName);
    const mapValue = highValueGiftMap[giftNameKey];

    // ✅ LÓGICA ROBUSTA FINAL POR TIPO DE REGALO (Con Prioridad al Mapa) ✅

    // 1. Manejar REGALOS ÚNICOS/GRANDES (giftType: 0)
    if (data.giftType === 0) {
        
        if (mapValue) {
            // ✅ PRIORIDAD A MAPA: Si el regalo está en el mapa, USAMOS ese valor.
            diamantes = mapValue;
            console.log(`[Cálculo - Manual/Universal] Asignando valor por nombre (${data.giftName}): ${diamantes} 💎`);
        } else {
            // Si NO está en el mapa, usamos el valor reportado por TikTok.
            diamantes = data.diamondCount || 0;
            console.log(`[Cálculo - Único/Grande] Usando valor reportado: ${diamantes} 💎`);
        }
    }
    // 2. Manejar REGALOS DE RACHA (giftType: 1)
    else if (data.giftType === 1) {
        
        if (mapValue) {
            // ✅ PRIORIDAD A MAPA: Multiplicamos el valor unitario del mapa por el conteo de repetición.
            diamantes = mapValue * (data.repeatCount || 1);
            console.log(`[Cálculo - Racha Manual] Calculando diamantes (Mapa * Repetición): ${diamantes} 💎`);
        }
        // Si NO está en el mapa, usamos el cálculo de racha de TikTok.
        else if (data.totalDiamondCount > 0) {
            diamantes = data.totalDiamondCount;
            console.log(`[Cálculo - Racha] Usando totalDiamondCount (esperado): ${diamantes} 💎`);
        }
        // Fallback si totalDiamondCount es 0.
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
