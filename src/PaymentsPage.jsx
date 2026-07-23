import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { calculateCleanerBalances } from "./services/cleanerBalanceService";

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
    loadPayments();
  }, []);

  const currentPayments = calculateCleanerBalances("", payments);
  const currentPaidByCleaner = Object.fromEntries(
    currentPayments.map((row) => [row.cleaner_name, row.total_paid])
  );

  return (
    <section className="page">

      <div className="hero">
        <p className="eyebrow">Virements</p>
        <h2>Suivi des règlements</h2>
      </div>

      <div className="card">
        <h3>Ajouter un virement</h3>

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
        <h3>Virements pris en compte dans les balances</h3>

        <p className="muted">Uniquement les virements enregistrés après le dernier virement noté « solde » de chaque personne.</p>

        <p>Jennifer : {Number(currentPaidByCleaner.Jennifer || 0).toFixed(2)} €</p>
        <p>Rachida : {Number(currentPaidByCleaner.Rachida || 0).toFixed(2)} €</p>
        <p>Gaelle : {Number(currentPaidByCleaner.Gaelle || 0).toFixed(2)} €</p>
      </div>

      <div className="card">
        <h3>Historique</h3>

        {payments.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10
            }}
          >
            <div>
              <strong>{p.cleaner_name}</strong>
              {" - "}
              {Number(p.amount).toFixed(2)} €
              {" "}
              ({p.note || "Sans note"})
            </div>

            <button
              onClick={() => deletePayment(p.id)}
            >
              ❌
            </button>
          </div>
        ))}
      </div>

    </section>
  );
}
