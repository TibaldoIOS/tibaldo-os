import test from "node:test";
import assert from "node:assert/strict";
import { calculateCleanerBalances, isBalancePayment } from "./cleanerBalanceService.js";

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

test("starts each cleaner balance after their latest settlement transfer", () => {
  const csv = [
    "Horodateur,Quel est ton prénom ?,Temps passé sur la prestation (minutes)",
    "19/07/2026,Gaelle,600",
    "20/07/2026,Gaëlle,120",
    "21/07/2026,Gaelle,60",
  ].join("\n");

  const [row] = calculateCleanerBalances(csv, [
    { cleaner_name: "Gaelle", amount: 500, payment_date: "2026-07-20", note: "Virement en solde" },
    { cleaner_name: "Gaelle", amount: 10, payment_date: "2026-07-21", note: "Acompte" },
  ], { mode: "current" });

  assert.equal(row.total_hours, 1);
  assert.equal(row.total_due, 15);
  assert.equal(row.total_paid, 10);
  assert.equal(row.balance, 5);
});

test("uses a different latest settlement date for each cleaner", () => {
  const csv = [
    "Horodateur,Quel est ton prénom ?,Temps passé sur la prestation (minutes)",
    "18/07/2026,Jennifer,60",
    "20/07/2026,Jennifer,120",
    "20/07/2026,Rachida,60",
    "22/07/2026,Rachida,180",
  ].join("\n");

  const result = calculateCleanerBalances(csv, [
    { cleaner_name: "Jennifer", amount: 30, payment_date: "2026-07-18", note: "Solde" },
    { cleaner_name: "Rachida", amount: 15, payment_date: "2026-07-20", note: "Compte soldé" },
  ], { mode: "current" });

  assert.equal(result.find((row) => row.cleaner_name === "Jennifer").balance, 30);
  assert.equal(result.find((row) => row.cleaner_name === "Rachida").balance, 45);
});

test("applies the same selected start and end dates to hours and payments", () => {
  const csv = [
    "Horodateur,Quel est ton prénom ?,Temps passé sur la prestation (minutes)",
    "20/07/2026,Jennifer,60",
    "21/07/2026,Jennifer,120",
    "22/07/2026,Jennifer,180",
  ].join("\n");

  const [row] = calculateCleanerBalances(csv, [
    { cleaner_name: "Jennifer", amount: 5, payment_date: "2026-07-20" },
    { cleaner_name: "Jennifer", amount: 10, payment_date: "2026-07-21" },
    { cleaner_name: "Jennifer", amount: 20, payment_date: "2026-07-22" },
  ], { startDate: "2026-07-21", endDate: "2026-07-21" });

  assert.equal(row.total_hours, 2);
  assert.equal(row.total_due, 30);
  assert.equal(row.total_paid, 10);
  assert.equal(row.balance, 20);
});

test("full history includes work and settlement payments from before the latest settlement", () => {
  const csv = [
    "Horodateur,Quel est ton prénom ?,Temps passé sur la prestation (minutes)",
    "18/07/2026,Jennifer,60",
    "20/07/2026,Jennifer,120",
    "22/07/2026,Jennifer,180",
  ].join("\n");

  const [row] = calculateCleanerBalances(csv, [
    { cleaner_name: "Jennifer", amount: 45, payment_date: "2026-07-20", note: "Solde" },
    { cleaner_name: "Jennifer", amount: 15, payment_date: "2026-07-22", note: "Acompte" },
  ], { mode: "all" });

  assert.equal(row.total_hours, 6);
  assert.equal(row.total_due, 90);
  assert.equal(row.total_paid, 60);
  assert.equal(row.balance, 30);
});

test("counts remuneration transfers by default, including settlement notes", () => {
  const csv = "Quel est ton prénom ?,Temps passé sur la prestation (minutes)\n";
  const result = calculateCleanerBalances(csv, [
    { cleaner_name: "Jennifer", amount: 120, payment_date: "2026-08-01", note: "Acompte" },
    { cleaner_name: "Rachida", amount: 302.25, payment_date: "2026-07-20", note: "Solde" },
    { cleaner_name: "Gaelle", amount: 300, payment_date: "2026-07-25", note: "Acompte" },
    { cleaner_name: "Gaelle", amount: 115, payment_date: "2026-07-15", note: "Solde" },
  ]);

  assert.equal(result.find((row) => row.cleaner_name === "Jennifer").total_paid, 120);
  assert.equal(result.find((row) => row.cleaner_name === "Rachida").total_paid, 302.25);
  assert.equal(result.find((row) => row.cleaner_name === "Gaelle").total_paid, 415);
});

test("excludes expense reimbursements from balances while keeping wage adjustments", () => {
  const csv = [
    "Horodateur,Quel est ton prénom ?,Temps passé sur la prestation (minutes)",
    "02/08/2026,Gaelle,660",
  ].join("\n");

  const [row] = calculateCleanerBalances(csv, [
    { cleaner_name: "Gaelle", amount: 27.16, payment_date: "2026-07-08", note: "Affiches Fives" },
    { cleaner_name: "Gaelle", amount: 62.34, payment_date: "2026-07-21", note: "Ajustement" },
  ]);

  assert.equal(row.total_due, 165);
  assert.equal(row.total_paid, 62.34);
  assert.equal(row.balance, 102.66);
  assert.equal(isBalancePayment({ note: "Affiches Fives" }), false);
  assert.equal(isBalancePayment({ note: "Remboursement achat produits" }), false);
  assert.equal(isBalancePayment({ note: "Ajustement" }), true);
});
