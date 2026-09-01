# Synchronisation Personnel / Ménage — phase Google Forms A

## Autorités

- Source historique : le CSV publié du Google Sheet, conservé sans modification.
- Registre canonique : `public.housekeeping_entries` dans Supabase.
- Point de contrôle : `public.tibaldo_app_housekeeping_import_batches` avec URL/snapshot, nombre de lignes, checksum SHA-256, état et horodatage de vérification.

Le Sheet n'est jamais interrogé pour calculer un solde dans le nouveau module Personnel. Les soldes proviennent exclusivement de la projection serveur du registre canonique.

## Import contrôlé

1. Télécharger un snapshot CSV complet et figer sa date, son nombre de lignes et son SHA-256.
2. Construire pour chaque ligne un `source_record_id` déterministe composé du snapshot, du numéro de ligne source et d'un préfixe du hash du payload brut. Ce nom documente qu'il ne s'agit pas d'un identifiant natif Google Forms.
3. Conserver le payload brut, son hash, les libellés personne/logement, l'horodatage de soumission et les snapshots de taux.
4. Résoudre les personnes par alias canonique. Résoudre uniquement les logements dont l'alias est certifié ; laisser `property_id` vide et marquer `OWNER_REVIEW_REQUIRED` dans les autres cas.
5. Écrire par upsert sur l'identité unique `(source_system, source_record_id)`. Une relecture du même snapshot met à jour la même ligne et ne peut pas en créer une seconde.
6. Vérifier les compteurs, hashes distincts, totaux par personne, solde global et anomalies avant de passer le batch à `VERIFIED`.

## Garde-fous

- Ne jamais avancer le checkpoint si le total dû diffère du référentiel sans explication auditée.
- Ne jamais inventer `service_date` ou `property_id`. Tant qu'aucune date métier distincte n'existe dans le Form, utiliser `FORM_SUBMISSION_DATE_FALLBACK` et ne pas présenter l'heure de soumission comme heure travaillée.
- Ne jamais supprimer ni modifier le Google Form ou son Sheet dans cette phase.
- Conserver l'écriture anonyme historique tant que `PrestatairePage.jsx` l'utilise ; statut Wave 1 : `LEGACY_FORM_WRITE_STILL_REQUIRED`.
- En cas d'échec, marquer le batch `FAILED`. Le rollback cible uniquement les lignes portant son `source_system`/`import_batch_id`.

## Wave 2 — résolution et incrémental

- `Gare` est une propriété canonique. `Lily` est un alias vers le même UUID.
- `Tibado House` n'est jamais un alias de propriété : chaque ligne est résolue
  depuis son propre payload source.
- `NO_PROPERTY_REQUIRED` est un état terminal légitime, distinct de
  `PROPERTY_REVIEW_REQUIRED`.
- `tibaldo_app_resolve_property_mapping` applique une décision Owner idempotente,
  auditée en append-only, sans modifier le payload source.
- `tibaldo_app_sync_housekeeping_row` renvoie `NO_DUPLICATE` pour une identité et
  un hash déjà importés. Si le hash change, la ligne existante n'est pas écrasée :
  la fonction renvoie `REVIEW_REQUIRED` et journalise `IMPORT_CONFLICT`.
- L'écriture Jennifer de −91,50 EUR reste incluse dans la réconciliation sous la
  classification `LEGACY_BALANCE_CORRECTION_ORIGIN_NOT_PROVEN`. Ce n'est ni un
  paiement bancaire ni une allocation à une prestation.
