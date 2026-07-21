export function simplifyIdea(text) {
  const t = text.trim();

  const rules = [
    [/acheter\s+(\d+)\s+bananiers?.*location/i, "Acheter $1 bananiers pour la location événementielle"],
    [/barriere.*poule.*fond.*jardin/i, "Installer une barrière pour sécuriser les poules au fond du jardin"],
    [/creer.*offre.*bananier/i, "Créer une offre de location de bananiers"],
    [/acheter.*palmier/i, "Acheter des palmiers pour le stock événementiel"],
  ];

  for (const [regex, replacement] of rules) {
    if (regex.test(t)) {
      return t.replace(regex, replacement);
    }
  }

  return t.charAt(0).toUpperCase() + t.slice(1);
}
