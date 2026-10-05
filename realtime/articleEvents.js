// realtime/articleEvents.js
// Diffusion temps réel (Server-Sent Events) des likes et commentaires

const clients = new Set();

// =====================================================
// GET /article/events : le client garde la connexion ouverte
// =====================================================

const abonner = (req, res) => {

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // Empêche les proxies (Render / Nginx) de bufferiser le flux
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();

  // Reconnexion automatique du client après 3 s en cas de coupure
  res.write('retry: 3000\n\n');

  // Battement régulier : évite que le proxy ferme une connexion inactive
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);

  clients.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });

};

// =====================================================
// ENVOYER UN ÉVÉNEMENT À TOUS LES CLIENTS CONNECTÉS
// =====================================================

const diffuser = (type, data) => {

  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

  clients.forEach(res => res.write(message));

};

module.exports = { abonner, diffuser };
