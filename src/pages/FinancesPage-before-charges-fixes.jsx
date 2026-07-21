<section className="tableCard">
  <details>
    <summary
      style={{
        cursor: "pointer",
        fontSize: "20px",
        fontWeight: "600",
        padding: "10px 0"
      }}
    >
      📄 Voir les {filteredLines.length} opérations
    </summary>

    <div className="tableWrap" style={{ marginTop: 20 }}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Banque</th>
            <th>Libellé</th>
            <th>Catégorie</th>
            <th>Entrée</th>
            <th>Sortie</th>
            <th>Net</th>
            <th>Pro ?</th>
          </tr>
        </thead>

        <tbody>
          {filteredLines.map((line) => (
            <tr key={line.id}>
              <td>{line.operation_date || "—"}</td>
              <td>{line.bank_name || "—"}</td>
              <td>{line.clean_label || line.raw_label}</td>
              <td>{line.detected_category || "Non classé"}</td>
              <td>{line.amount_in ? formatCurrency(line.amount_in) : "—"}</td>
              <td>{line.amount_out ? formatCurrency(line.amount_out) : "—"}</td>
              <td>{formatCurrency(line.amount)}</td>
              <td>
                {line.is_professional === true
                  ? "Oui"
                  : line.is_professional === false
                  ? "Non"
                  : "À vérifier"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {!filteredLines.length && (
      <p>Aucune ligne bancaire importée.</p>
    )}
  </details>
</section>