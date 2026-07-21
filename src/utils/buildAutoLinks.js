import { autoLinks } from "../data/autoLinks";

export function buildAutoLinks(title) {
  const text = title.toLowerCase();

  const results = [];

  autoLinks.forEach((rule) => {
    const matched = rule.keywords.some((k) =>
      text.includes(k.toLowerCase())
    );

    if (matched) {
      rule.links.forEach((link) => {
        results.push(link);
      });
    }
  });

  return [...new Set(results)];
}
