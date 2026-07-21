export const brainNodes = [
  {
    id: "uzi",
    title: "Uzi",
    description: "Suivi gestation et mise bas",
    tags: ["bengal","reproduction","sante"]
  },

  {
    id: "bananiers",
    title: "Location bananiers",
    description: "Développer l'activité événementielle",
    tags: ["plantes","evenementiel","revenus"]
  },

  {
    id: "melezio",
    title: "Mélézio",
    description: "Appartement Airbnb",
    tags: ["airbnb","immobilier","revenus"]
  }
];

export function createNode(title) {
  return {
    id: crypto.randomUUID(),
    title,
    description: "",
    tags: []
  };
}
