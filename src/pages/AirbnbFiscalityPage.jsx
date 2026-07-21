import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AirbnbFiscalityPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("airbnb_profitability")
      .select("*");

    setRows(data || []);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>🏠 Fiscalité Airbnb</h1>

      {rows.map((row) => (
        <div
          key={row.property_name}
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 10px 30px rgba(0,0,0,.08)"
          }}
        >
          <h2>{row.property_name}</h2>

          <p>
            💶 Revenus Airbnb :
            <strong>
              {" "}
              {Number(row.airbnb_revenue || 0).toLocaleString("fr-FR")} €
            </strong>
          </p>

          <p>
            📌 Charges :
            <strong>
              {" "}
              {Number(row.monthly_charges || 0).toLocaleString("fr-FR")} €
            </strong>
          </p>

          <p>
            📈 Résultat :
            <strong>
              {" "}
              {Number(row.estimated_profit || 0).toLocaleString("fr-FR")} €
            </strong>
          </p>
        </div>
      ))}
    </div>
  );
}