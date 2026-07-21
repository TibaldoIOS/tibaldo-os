import test from "node:test";
import assert from "node:assert/strict";
import { calculateCleanerBalances } from "./cleanerBalanceService.js";

test("reconciles all sheet hours and reimbursements with manual transfers", () => {
  const csv = [
    "Horodateur,Quel est ton prénom ?,Temps passé sur la prestation (minutes),Montant Achats,Combien de paires de draps as-tu nettoyées ?",
    '01/07/2026,"Jennifer",120,"10,50",2',
    '02/07/2026,"jennifer melezio",60,0,1',
    '03/07/2026,"Rachida",90,5,0',
  ].join("\n");

  const result = calculateCleanerBalances(csv, [
    { cleaner_name: "Jennifer", amount: 40 },
    { cleaner_name: "jennifer", amount: "5,50" },
    { cleaner_name: "Rachida", amount: 20 },
  ]);

  const jennifer = result.find((row) => row.cleaner_name === "Jennifer");
  assert.equal(jennifer.total_hours, 3);
  assert.equal(jennifer.total_due, 64.5);
  assert.equal(jennifer.total_paid, 45.5);
  assert.equal(jennifer.balance, 19);

  const rachida = result.find((row) => row.cleaner_name === "Rachida");
  assert.equal(rachida.total_due, 27.5);
  assert.equal(rachida.balance, 7.5);
});

test("keeps a cleaner with payments but no sheet rows to show an advance", () => {
  const csv = "Quel est ton prénom ?,Temps passé sur la prestation (minutes)\n";
  const [row] = calculateCleanerBalances(csv, [{ cleaner_name: "Gaëlle", amount: 30 }]);

  assert.equal(row.cleaner_name, "Gaelle");
  assert.equal(row.total_due, 0);
  assert.equal(row.balance, -30);
});
