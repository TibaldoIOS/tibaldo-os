import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import OpeningControlCenter from "./OpeningControlCenter";
import { EmployeePortal, OwnerTeamOverview } from "./EmployeePortal";
import "./privateModules.css";

function routeFromHash(role) {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (role === "EMPLOYEE") return "employee";
  return route === "team" ? "team" : "opening";
}

export default function PrivateModulesApp() {
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [route, setRoute] = useState("opening");
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function hydrate(nextSession) {
    setSession(nextSession);
    setMembership(null);
    if (!nextSession) { setReady(true); return; }
    const result = await supabase
      .from("tibaldo_app_memberships")
      .select("user_id, role")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();
    if (result.error) setMessage("L’autorisation n’a pas pu être vérifiée.");
    setMembership(result.data || null);
    setRoute(routeFromHash(result.data?.role));
    setReady(true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => hydrate(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(membership?.role));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [membership?.role]);

  async function signIn(event) {
    event.preventDefault(); setMessage("Connexion…");
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return setMessage("Adresse ou mot de passe incorrect.");
    setPassword(""); setMessage("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.hash = "";
  }

  function navigate(next) {
    window.location.hash = next;
    setRoute(next);
  }

  if (!ready) return <div className="privateSplash">Ouverture de Tibaldo…</div>;
  if (!session) return <main className="privateLogin">
    <section>
      <p className="eyebrow">TIBALDO · ESPACE PRIVÉ</p>
      <h1>Votre quotidien, au bon endroit.</h1>
      <p>Connectez-vous avec votre compte autorisé. Aucun compte ne peut être créé depuis cet écran.</p>
      <form onSubmit={signIn}>
        <label>Adresse e-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primaryAction" type="submit">Se connecter</button>
      </form>
      {message && <p className="inlineMessage" role="alert">{message}</p>}
    </section>
  </main>;

  if (!membership) return <main className="privateLogin"><section><p className="eyebrow">ACCÈS REFUSÉ</p><h1>Ce compte n’a pas accès à cet espace.</h1><p>L’accès est accordé côté serveur. Un lien direct ou un changement d’URL ne suffit pas.</p><button className="primaryAction" onClick={signOut}>Se déconnecter</button></section></main>;

  return <div className="privateShell">
    <a className="skipLink" href="#main-content">Aller au contenu</a>
    <header className="privateTopbar">
      <button className="brandButton" onClick={() => navigate(membership.role === "OWNER" ? "opening" : "employee")}><span>T</span><strong>Tibaldo</strong></button>
      {membership.role === "OWNER" && <nav aria-label="Modules privés"><button className={route === "opening" ? "active" : ""} onClick={() => navigate("opening")}>Ouverture boutique</button><button className={route === "team" ? "active" : ""} onClick={() => navigate("team")}>Équipe</button></nav>}
      <div className="topbarActions"><span className="roleBadge">{membership.role === "OWNER" ? "Owner" : "Personnel"}</span><button onClick={signOut}>Déconnexion</button></div>
    </header>
    {membership.role === "OWNER" && route === "opening" && <OpeningControlCenter session={session} />}
    {membership.role === "OWNER" && route === "team" && <OwnerTeamOverview session={session} />}
    {membership.role === "EMPLOYEE" && <EmployeePortal session={session} />}
  </div>;
}
