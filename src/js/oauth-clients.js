/* The OAuth apps Nordlys signs in with, for the services that have no
   personal tokens (Google Tasks and Calendar, Microsoft To Do). A client id
   is not a secret; it names the app on the sign-in screen. Until one is
   filled in, those services say they arrive in the next update.

   To fill them in, see docs/integrations.md. */
(function (root) {
  "use strict";
  root.NordlysOAuthClients = {
    google: { clientId: "" },
    microsoft: { clientId: "" }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
