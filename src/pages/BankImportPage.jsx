import BankSmartUploadWidget from "./BankSmartUploadWidget";

export default function BankImportPage() {
  return (
    <div style={{ padding: 30 }}>
      <h1>📄 Import relevé bancaire</h1>
      <p>Import automatique des relevés PDF / CSV vers TibaldoOS.</p>
      <BankSmartUploadWidget />
    </div>
  );
}
