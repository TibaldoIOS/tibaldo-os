export const OPENING_AT = "2026-09-26T18:00:00+02:00";

export const CATEGORIES = [
  "BOUTIQUE",
  "INFORMATIQUE",
  "PLANTES",
  "STOCK",
  "CHATS",
  "ADMINISTRATIF",
  "COMMUNICATION",
  "FOURNISSEURS",
  "OUVERTURE",
  "PERSONNEL",
];

export const PRIORITIES = ["P0_CRITICAL", "P1_IMPORTANT", "P2_CAN_WAIT"];
export const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "DEFERRED"];
export const EFFORTS = ["LIGHT", "NORMAL", "HEAVY"];

const task = (seedKey, title, dueDate, weekLabel, category, priority = "P1_IMPORTANT", effort = "NORMAL", description = null) => ({
  seed_key: seedKey,
  title,
  due_date: dueDate,
  week_label: weekLabel,
  category,
  priority,
  effort,
  status: "TODO",
  description,
});

export const OPENING_PLAN = [
  task("foundation-01", "Prioriser les derniers rempotages", "2026-08-31", "31 AOÛT–06 SEPT.", "PLANTES", "P0_CRITICAL", "NORMAL", "État connu : environ vingt rempotages restants. Ajuster le volume après comptage réel."),
  task("foundation-02", "Lister le matériel de stockage sec", "2026-08-31", "31 AOÛT–06 SEPT.", "STOCK", "P1_IMPORTANT", "LIGHT"),
  task("foundation-03", "Bloquer un créneau léger d’administration", "2026-09-01", "31 AOÛT–06 SEPT.", "ADMINISTRATIF", "P2_CAN_WAIT", "LIGHT"),
  task("foundation-04", "Trier les plantes par destination boutique", "2026-09-01", "31 AOÛT–06 SEPT.", "PLANTES", "P0_CRITICAL", "HEAVY"),
  task("foundation-05", "Choisir et commander l’imprimante à étiquettes adhésives", "2026-09-02", "31 AOÛT–06 SEPT.", "FOURNISSEURS", "P0_CRITICAL", "NORMAL"),
  task("foundation-06", "Préparer la structure des catégories du catalogue réel", "2026-09-02", "31 AOÛT–06 SEPT.", "INFORMATIQUE", "P0_CRITICAL", "NORMAL"),
  task("foundation-07", "Routine plantes et contrôle sanitaire", "2026-09-03", "31 AOÛT–06 SEPT.", "PLANTES", "P1_IMPORTANT", "NORMAL"),
  task("foundation-08", "Préparer le garage pour le stockage sec", "2026-09-04", "31 AOÛT–06 SEPT.", "STOCK", "P0_CRITICAL", "HEAVY", "Garage attendu autour du 4–5 septembre ; confirmer l’accès avant déplacement."),
  task("foundation-09", "Installer les premières zones de stockage sec si le garage est accessible", "2026-09-05", "31 AOÛT–06 SEPT.", "STOCK", "P1_IMPORTANT", "HEAVY"),
  task("foundation-10", "Bloc récupération et tâches personnelles", "2026-09-06", "31 AOÛT–06 SEPT.", "PERSONNEL", "P1_IMPORTANT", "LIGHT"),
  task("foundation-11", "Soins quotidiens des trois chatons", "2026-09-06", "31 AOÛT–06 SEPT.", "CHATS", "P0_CRITICAL", "NORMAL"),

  task("catalogue-01", "Définir la série photo des premiers produits", "2026-09-07", "07–13 SEPT.", "BOUTIQUE", "P0_CRITICAL", "NORMAL"),
  task("catalogue-02", "Photographier un premier lot de produits", "2026-09-08", "07–13 SEPT.", "BOUTIQUE", "P0_CRITICAL", "HEAVY"),
  task("catalogue-03", "Saisir et contrôler les premiers produits réels", "2026-09-09", "07–13 SEPT.", "STOCK", "P0_CRITICAL", "HEAVY"),
  task("catalogue-04", "Configurer et tester l’imprimante d’étiquettes", "2026-09-09", "07–13 SEPT.", "INFORMATIQUE", "P0_CRITICAL", "NORMAL"),
  task("catalogue-05", "Tester le cycle produit → stock → étiquette → Caisse", "2026-09-10", "07–13 SEPT.", "INFORMATIQUE", "P0_CRITICAL", "NORMAL"),
  task("catalogue-06", "Préparer les prix et contrôles TVA du lot d’ouverture", "2026-09-10", "07–13 SEPT.", "ADMINISTRATIF", "P0_CRITICAL", "NORMAL"),
  task("catalogue-07", "Préparer le message d’annonce de l’ouverture", "2026-09-11", "07–13 SEPT.", "COMMUNICATION", "P1_IMPORTANT", "NORMAL"),
  task("catalogue-08", "Définir le concours d’ouverture sans publication", "2026-09-11", "07–13 SEPT.", "COMMUNICATION", "P1_IMPORTANT", "NORMAL"),
  task("catalogue-09", "Point fournisseurs et livraisons restantes", "2026-09-12", "07–13 SEPT.", "FOURNISSEURS", "P1_IMPORTANT", "LIGHT"),
  task("catalogue-10", "Bloc léger : classement et petites corrections", "2026-09-13", "07–13 SEPT.", "ADMINISTRATIF", "P2_CAN_WAIT", "LIGHT"),
  task("catalogue-11", "Routine plantes et chatons", "2026-09-13", "07–13 SEPT.", "CHATS", "P0_CRITICAL", "NORMAL"),

  task("install-01", "Confirmer la remise des clés et l’accès au local", "2026-09-14", "14–20 SEPT.", "BOUTIQUE", "P0_CRITICAL", "LIGHT", "Accès attendu au plus tard autour du 17 septembre."),
  task("install-02", "Préparer le plan d’installation physique", "2026-09-14", "14–20 SEPT.", "BOUTIQUE", "P0_CRITICAL", "NORMAL"),
  task("install-03", "Nettoyage initial du local après accès", "2026-09-17", "14–20 SEPT.", "BOUTIQUE", "P0_CRITICAL", "HEAVY"),
  task("install-04", "Installer les zones de vente et de circulation", "2026-09-17", "14–20 SEPT.", "BOUTIQUE", "P0_CRITICAL", "HEAVY"),
  task("install-05", "Installer le matériel de Caisse", "2026-09-18", "14–20 SEPT.", "INFORMATIQUE", "P0_CRITICAL", "NORMAL"),
  task("install-06", "Installer l’étiquetage et les prix visibles", "2026-09-18", "14–20 SEPT.", "STOCK", "P0_CRITICAL", "HEAVY"),
  task("install-07", "Organiser la réserve et le stock sec", "2026-09-19", "14–20 SEPT.", "STOCK", "P1_IMPORTANT", "HEAVY"),
  task("install-08", "Préparer vitrine, enseigne et signalétique sans mutation DNS", "2026-09-19", "14–20 SEPT.", "BOUTIQUE", "P1_IMPORTANT", "NORMAL"),
  task("install-09", "Première passe merchandising", "2026-09-20", "14–20 SEPT.", "BOUTIQUE", "P0_CRITICAL", "HEAVY"),
  task("install-10", "Bloc récupération et soins plantes", "2026-09-20", "14–20 SEPT.", "PLANTES", "P1_IMPORTANT", "LIGHT"),

  task("final-01", "Inventaire physique du stock d’ouverture", "2026-09-21", "21–25 SEPT.", "STOCK", "P0_CRITICAL", "HEAVY"),
  task("final-02", "Réconcilier stock physique, Caisse et Shop", "2026-09-22", "21–25 SEPT.", "INFORMATIQUE", "P0_CRITICAL", "HEAVY"),
  task("final-03", "Verrouiller le traiteur et les boissons de l’ouverture", "2026-09-22", "21–25 SEPT.", "FOURNISSEURS", "P0_CRITICAL", "NORMAL"),
  task("final-04", "Finaliser communication et concours d’ouverture", "2026-09-23", "21–25 SEPT.", "COMMUNICATION", "P0_CRITICAL", "NORMAL"),
  task("final-05", "Contrôler les surfaces légales et Privacy avant activation publique", "2026-09-23", "21–25 SEPT.", "ADMINISTRATIF", "P0_CRITICAL", "NORMAL"),
  task("final-06", "Smoke complet Caisse / Shop / Jungle en BÊTA", "2026-09-24", "21–25 SEPT.", "INFORMATIQUE", "P0_CRITICAL", "HEAVY"),
  task("final-07", "Nettoyage final et contrôle éclairage", "2026-09-24", "21–25 SEPT.", "BOUTIQUE", "P0_CRITICAL", "HEAVY"),
  task("final-08", "Merchandising final et photos de contrôle", "2026-09-25", "21–25 SEPT.", "BOUTIQUE", "P0_CRITICAL", "HEAVY"),
  task("final-09", "Préparer le déroulé de la soirée d’ouverture", "2026-09-25", "21–25 SEPT.", "OUVERTURE", "P0_CRITICAL", "NORMAL"),
  task("final-10", "Préparer une liste courte de secours pour le jour J", "2026-09-25", "21–25 SEPT.", "OUVERTURE", "P1_IMPORTANT", "LIGHT"),
  task("final-11", "Soins plantes et chatons — charge volontairement légère", "2026-09-25", "21–25 SEPT.", "CHATS", "P0_CRITICAL", "LIGHT"),

  task("opening-01", "Contrôle sécurité, propreté et circulation", "2026-09-26", "26 SEPT. — OUVERTURE", "OUVERTURE", "P0_CRITICAL", "NORMAL"),
  task("opening-02", "Contrôle Caisse, matériel et connexion", "2026-09-26", "26 SEPT. — OUVERTURE", "INFORMATIQUE", "P0_CRITICAL", "NORMAL"),
  task("opening-03", "Contrôle prix, étiquettes et stock", "2026-09-26", "26 SEPT. — OUVERTURE", "STOCK", "P0_CRITICAL", "NORMAL"),
  task("opening-04", "Contrôle accueil, boissons et concours", "2026-09-26", "26 SEPT. — OUVERTURE", "OUVERTURE", "P0_CRITICAL", "NORMAL"),
  task("opening-05", "Pause, repas et préparation personnelle", "2026-09-26", "26 SEPT. — OUVERTURE", "PERSONNEL", "P0_CRITICAL", "LIGHT"),
  task("opening-06", "Ouvrir le Studio Végétal — 18:00", "2026-09-26", "26 SEPT. — OUVERTURE", "OUVERTURE", "P0_CRITICAL", "HEAVY"),
];

export function daysUntilOpening(now = new Date(), opening = new Date(OPENING_AT)) {
  return Math.max(0, Math.ceil((opening.getTime() - now.getTime()) / 86_400_000));
}

export function isOverdue(openingTask, todayIso) {
  return openingTask.status !== "DONE" && openingTask.due_date < todayIso;
}

export function progressFor(tasks) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((item) => item.status === "DONE").length / tasks.length) * 100);
}

export function tomorrowIso(todayIso) {
  const value = new Date(`${todayIso}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}
