import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function RevenuePage() {
  const [revenues, setRevenues] = useState([]);
  const [category, setCategory] = useState("Airbnb");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [revenueDate, setRevenueDate] = useState(
    new Date().toISOString().slice(0,10)
  );

  async function loadRevenues() {
    const { data } = await supabase
      .from("business_revenue")
      .select("*")
      .order("revenue_date", { ascending:false });

    setRevenues(data || []);
  }

  async function saveRevenue() {
    if (!amount) return;

    const { error } = await supabase
      .from("business_revenue")
      .insert({
        revenue_date: revenueDate,
        category,
        amount: Number(amount),
        note
      });

    if (error) {
      alert(error.message);
      return;
    }

    setAmount("");
    setNote("");

    loadRevenues();
  }

  useEffect(() => {
    loadRevenues();
  }, []);

  const total = useMemo(
    () =>
      revenues.reduce(
        (s,r) => s + Number(r.amount || 0),
        0
      ),
    [revenues]
  );

  return (
    <section className="page">

      <div className="hero">
        <p className="eyebrow">Business</p>
        <h2>Revenus</h2>
      </div>

      <div className="card">

        <h3>Ajouter un revenu</h3>

        <input
          type="date"
          value={revenueDate}
          onChange={(e)=>setRevenueDate(e.target.value)}
        />

        <br /><br />

        <select
          value={category}
          onChange={(e)=>setCategory(e.target.value)}
        >
          <option>Airbnb</option>
          <option>Plantes</option>
          <option>Pet Sitting</option>
          <option>Location</option>
          <option>Bengals</option>
          <option>Autre</option>
        </select>

        <br /><br />

        <input
          placeholder="Montant"
          value={amount}
          onChange={(e)=>setAmount(e.target.value)}
        />

        <br /><br />

        <input
          placeholder="Note"
          value={note}
          onChange={(e)=>setNote(e.target.value)}
        />

        <br /><br />

        <button
          className="primary"
          onClick={saveRevenue}
        >
          ➕ Ajouter
        </button>

      </div>

      <div className="card">
        <h3>Total enregistré</h3>
        <h2>{total.toFixed(2)} €</h2>
      </div>

      <div className="card">

        <h3>Historique</h3>

        {revenues.map((r)=>(
          <div
            key={r.id}
            style={{
              display:"flex",
              justifyContent:"space-between",
              marginBottom:10
            }}
          >
            <div>
              <strong>{r.category}</strong>
              {" - "}
              {Number(r.amount).toFixed(2)} €
              {" "}
              ({r.note || "Sans note"})
            </div>

            <div>
              {r.revenue_date}
            </div>
          </div>
        ))}

      </div>

    </section>
  );
}
