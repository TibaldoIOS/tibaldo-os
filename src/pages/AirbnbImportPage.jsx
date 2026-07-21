import { useState } from "react";

export default function AirbnbImportPage() {
  const [file, setFile] = useState(null);

  return (
    <div style={{ padding: 30 }}>
      <h1>📄 Import Airbnb</h1>

      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          marginTop: 20,
        }}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        {file && (
          <div style={{ marginTop: 20 }}>
            ✅ {file.name}
          </div>
        )}
      </div>
    </div>
  );
}
