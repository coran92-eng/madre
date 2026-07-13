// Lightweight i18n (castellano / català). The dictionary covers navigation and
// shared chrome; page bodies default to Spanish and can be migrated key by key.

export type Lang = "es" | "ca";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "es", label: "Castellano" },
  { code: "ca", label: "Català" },
];

export const LANG_COOKIE = "madre_lang";

type Dict = Record<string, string>;

const es: Dict = {
  "nav.dashboard": "Inicio",
  "nav.panel": "Panel",
  "nav.employees": "Empleados",
  "nav.onboarding": "Onboarding",
  "nav.training": "Formación",
  "nav.vacations": "Vacaciones",
  "nav.absences": "Ausencias",
  "nav.schedule": "Horarios",
  "nav.swaps": "Cambios",
  "nav.timeclock": "Fichajes",
  "nav.tips": "Propinas",
  "nav.checklists": "Checklists",
  "nav.appcc": "APPCC",
  "nav.shiftlog": "Parte de turno",
  "nav.documents": "Documentos",
  "nav.contratacion": "Contratación",
  "nav.manual": "Manual",
  "nav.board": "Tablón",
  "nav.cash": "Caja",
  "nav.alerts": "Alertas",
  "nav.incidents": "Incidencias",
  "nav.locals": "Locales",
  "nav.users": "Usuarios",
  "nav.audit": "Actividad",
  "chrome.logout": "Cerrar sesión",
  "chrome.allLocals": "Todos los locales",
  "chrome.activeLocal": "Local activo",
  "chrome.language": "Idioma",
  "chrome.tempPassword": "Estás usando una contraseña temporal.",
  "chrome.changeNow": "Cámbiala ahora",
};

const ca: Dict = {
  "nav.dashboard": "Inici",
  "nav.panel": "Panell",
  "nav.employees": "Empleats",
  "nav.onboarding": "Onboarding",
  "nav.training": "Formació",
  "nav.vacations": "Vacances",
  "nav.absences": "Absències",
  "nav.schedule": "Horaris",
  "nav.swaps": "Canvis",
  "nav.timeclock": "Fitxatges",
  "nav.tips": "Propines",
  "nav.checklists": "Checklists",
  "nav.appcc": "APPCC",
  "nav.shiftlog": "Part de torn",
  "nav.documents": "Documents",
  "nav.contratacion": "Contractació",
  "nav.manual": "Manual",
  "nav.board": "Tauler",
  "nav.cash": "Caixa",
  "nav.alerts": "Alertes",
  "nav.incidents": "Incidències",
  "nav.locals": "Locals",
  "nav.users": "Usuaris",
  "nav.audit": "Activitat",
  "chrome.logout": "Tancar sessió",
  "chrome.allLocals": "Tots els locals",
  "chrome.activeLocal": "Local actiu",
  "chrome.language": "Idioma",
  "chrome.tempPassword": "Estàs fent servir una contrasenya temporal.",
  "chrome.changeNow": "Canvia-la ara",
};

const DICTS: Record<Lang, Dict> = { es, ca };

export function t(lang: Lang, key: string): string {
  return DICTS[lang]?.[key] ?? DICTS.es[key] ?? key;
}

export function normalizeLang(v: string | undefined | null): Lang {
  return v === "ca" ? "ca" : "es";
}
