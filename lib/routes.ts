/**
 * Rutas internas. Todo lo que el navegador pide debe vivir bajo /agendar o
 * /agendamiento-exitoso, que son los únicos prefijos que proxyea el Worker.
 */
export const API_ROUTES = {
  horarios: "/agendar/api/horarios",
  reservar: "/agendar/api/reservar",
  notificarConversion: "/agendar/api/notificar-conversion",
} as const;

export const SUCCESS_PATH = "/agendamiento-exitoso";
