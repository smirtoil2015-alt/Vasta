// Vasta notification helper registration.
// Firebase Cloud Messaging background push wiring is intentionally configured
// through the project's Firebase/VAPID settings rather than storing secrets here.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => "focus" in client);
    return existing ? existing.focus() : self.clients.openWindow("/");
  }));
});
