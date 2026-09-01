import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  calculateCleanerBalances,
  isBalancePayment,
  isCanonicalPersonnelPayment,
} from "./services/cleanerBalanceService";

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [cleaner, setCleaner] = useState("Jennifer");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  async function loadPayments() {
    const { data } = await supabase
      .from("cleaner_payments")
      .select("*")
      .order("payment_date", { ascending: false });

    setPayments(data || []);
  }

  async function savePayment() {
    if (!amount) return;

    console.log("INSERT =>", JSON.stringify({
  cleaner_name: cleaner,
  payment_date: paymentDate,
  amount,
  amountNumber:parseFloat(String(amount).replace(",", ".")),
  note
}, null, 2));

const { data, error } = await supabase
      .from("cleaner_payments")
      .insert({
        cleaner_name: cleaner,
        payment_date: paymentDate,
        amount: parseFloat(String(amount).replace(",", ".")),
        note
      })
      .select();

    console.log("INSERT RESULT", data);
    console.log("INSERT ERROR", error);

    if (error) {
      alert(error.message);
      return;
    }

    setAmount("");
    setNote("");

    await loadPayments();
  }

  async function deletePayment(id) {
    await supabase
      .from("cleaner_payments")
      .delete()
      .eq("id", id);

    loadPayments();
  }

  useEffect(() => {
    // Loading on mount is the intended external synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPayments();
  }, []);

  const canonicalPayments = payments.filter(isCanonicalPersonnelPayment);
  const excludedPayments = payments.filter((payment) => !isCanonicalPersonnelPayment(payment));
  const allPayments = calculateCleanerBalances("", canonicalPayments);
  const paidByCleaner = Object.fromEntries(
    allPayments.map((row) => [row.cleaner_name, row.total_paid])
  );

  return (
    <section className="page">

      <div className="hero">
        <p className="eyebrow">Virements</p>
        <h2>Suivi des règlements</h2>
      </div>

      <div className="card">
        <h3>Ajouter un virement</h3>
        <p className="muted paymentFormHelp">Nature : paiement salaire. Les ajustements historiques et remboursements de frais ne se créent pas depuis ce formulaire.</p>

        <select
          value={cleaner}
          onChange={(e) => setCleaner(e.target.value)}
        >
          <option>Jennifer</option>
          <option>Rachida</option>
          <option>Gaelle</option>
        </select>

        <br /><br />

        <label>Date du virement</label>

        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />

        <br /><br />

        <input
          placeholder="Montant"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <br /><br />

        <input
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <br /><br />

        <button
          className="primary"
          onClick={savePayment}
        >
          Enregistrer le virement
        </button>
      </div>

      <div className="card">
        <h3>Tous les virements enregistrés</h3>

        <p className="muted">Les avances, soldes et ajustements sont repris dans les balances. Les remboursements de frais restent visibles dans l’historique mais sont exclus du calcul.</p>

        <p>Jennifer : {Number(paidByCleaner.Jennifer || 0).toFixed(2)} €</p>
        <p>Rachida : {Number(paidByCleaner.Rachida || 0).toFixed(2)} €</p>
        <p>Gaelle : {Number(paidByCleaner.Gaelle || 0).toFixed(2)} €</p>
      </div>

      <div className="card">
        <h3>Historique canonique ({canonicalPayments.length})</h3>

        {canonicalPayments.map((p) => (
          <div
            key={p.id}
            className={`paymentHistoryRow ${p.payment_kind === "LEGACY_ADJUSTMENT" ? "isAdjustment" : ""}`}
          >
            <div className="paymentHistoryContent">
              <div className="paymentHistoryIdentity">
                <strong>{p.cleaner_name}</strong>
                <strong className={Number(p.amount) < 0 ? "paymentNegative" : ""}>{Number(p.amount).toFixed(2)} €</strong>
              </div>
              <div>{p.note || "Sans note"}</div>
              <small>{p.payment_date}</small>
              {p.payment_kind === "LEGACY_ADJUSTMENT" && (
                <span className="paymentTypeBadge adjustmentBadge">Ajustement historique · hors virement bancaire</span>
              )}
              {p.legacy_classification === "LEGACY_BALANCE_CORRECTION_ORIGIN_NOT_PROVEN" && (
                <span className="paymentOriginWarning">Origine non démontrée</span>
              )}
              {!isBalancePayment(p) && (
                <span className="paymentTypeBadge reimbursementBadge">Remboursement de frais · hors balance</span>
              )}
            </div>

            <button
              className="paymentDeleteButton"
              aria-label={`Supprimer l'écriture ${p.cleaner_name} du ${p.payment_date}`}
              onClick={() => deletePayment(p.id)}
            >
              ❌
            </button>
          </div>
        ))}

        {excludedPayments.length > 0 && (
          <p className="paymentExcludedNotice">
            {excludedPayments.length} fixture synthétique exclue de l’historique canonique et des soldes.
          </p>
        )}
      </div>

      <style>{paymentsStyles}</style>

    </section>
  );
}

const paymentsStyles = `
.paymentFormHelp { margin-bottom: 16px; line-height: 1.45; }
.paymentHistoryRow { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 10px; padding: 14px; border: 1px solid rgba(31,77,58,.12); border-radius: 16px; background: #f7f4ef; }
.paymentHistoryRow.isAdjustment { border-color: #d3a897; background: #fbede8; }
.paymentHistoryContent { min-width: 0; display: grid; gap: 5px; overflow-wrap: anywhere; }
.paymentHistoryIdentity { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 18px; }
.paymentHistoryContent small { color: #6d6257; }
.paymentNegative { color: #a34836; }
.paymentTypeBadge, .paymentOriginWarning { width: fit-content; max-width: 100%; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .03em; }
.adjustmentBadge { color: #713d31; background: #f0cfc3; }
.reimbursementBadge { color: #27524a; background: #d8e9df; }
.paymentOriginWarning { color: #6f4913; background: #f5dfb8; }
.paymentDeleteButton { flex: 0 0 44px; width: 44px; min-height: 44px; padding: 0; }
.paymentExcludedNotice { margin-top: 16px; padding: 12px 14px; border-left: 4px solid #9a7a45; background: #f7efd9; line-height: 1.45; }
@media (max-width: 520px) {
  .paymentHistoryRow { padding: 12px; }
  .paymentHistoryIdentity { display: grid; }
}
`;
