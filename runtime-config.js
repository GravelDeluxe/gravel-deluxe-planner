// Eigenbetrieb: Nginx und der Dev-Server leiten diese Endpunkte an den lokalen
// Stack weiter. Für Rundtouren zuerst `make setup` ausführen.
globalThis.GRAVEL_PLANNER_CONFIG = {
  brouterBase: '/brouter',
  orsBase: '/ors',
  orsRequiresKey: false,
};
