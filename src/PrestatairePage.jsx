import { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const PRESTATAIRE_PIN = "2026";

const staffOptions = ["Jennifer", "Rachida", "Gaelle"];

const serviceOptions = [
  { id: "menage", label: "Ménage Airbnb", icon: "🧹", color: "green" },
  { id: "linge", label: "Linge / draps", icon: "🧺", color: "purple" },
  { id: "service_client", label: "Service client / mission", icon: "💬", color: "blue" },
  { id: "achat", label: "Achat uniquement", icon: "🛒", color: "orange" },
];

const productOptions = [
  "Papier toilette",
  "Nettoyants",
  "Javel",
  "Liquide vaisselle",
  "Café",
  "Éponge / lavette / gomme magique",
  "Vinaigre",
  "Autres",
];

const surfaceOptions = [
  "Hall bas",
  "1er escalier",
  "Hall 1er étage",
  "Salle de bain",
  "Cuisine",
  "Salon / Salle à manger",
  "2ème escalier",
  "Pallier chambre 1/2",
  "3ème escalier",
  "Pallier chambre 3/4",
];

const roomOptions = ["Chambre 1", "Chambre 2", "Chambre 3", "Chambre 4"];

export default function PrestatairePage() {
  const [pin, setPin] = useState("");
  const [pinOk, setPinOk] = useState(false);

  const [staffName, setStaffName] = useState("");
  const [serviceType, setServiceType] = useState("menage");
  const [minutes, setMinutes] = useState("");

  const [purchaseDone, setPurchaseDone] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsOther, setProductsOther] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [ticketFiles, setTicketFiles] = useState([]);

  const [property, setProperty] = useState("");
  const [surfaces, setSurfaces] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [remarks, setRemarks] = useState("");

  const [linenPairs, setLinenPairs] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [missionDescription, setMissionDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const selectedService = useMemo(
    () => serviceOptions.find((item) => item.id === serviceType),
    [serviceType]
  );

  function unlock(event) {
    event.preventDefault();
    if (pin.trim() === PRESTATAIRE_PIN) {
      setPinOk(true);
      setMessage("");
    } else {
      setMessage("Code incorrect.");
    }
  }

  function toggleValue(value, list, setter) {
    if (list.includes(value)) {
      setter(list.filter((item) => item !== value));
    } else {
      setter([...list, value]);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    if (!staffName) return setMessage("Choisis ton prénom.");
    if (!serviceType) return setMessage("Choisis le type de prestation.");

    if (serviceType === "menage") {
      if (!minutes) return setMessage("Indique le temps passé.");
      if (!property) return setMessage("Choisis le logement concerné.");
      if (property === "Fives" && surfaces.length === 0) return setMessage("Coche au moins une surface nettoyée pour Fives.");
      if (property === "Fives" && rooms.length === 0) return setMessage("Coche au moins une chambre préparée pour Fives.");
      if (!remarks.trim()) return setMessage("Ajoute une remarque, même courte.");
    }

    if (serviceType === "achat") {
      if (ticketFiles.length === 0) return setMessage("Ajoute le ticket de caisse.");
    }

    if (purchaseDone) {
      if (products.length === 0 && !productsOther.trim()) return setMessage("Indique les produits achetés.");
      if (!purchaseAmount) return setMessage("Indique le montant des achats.");
      if (ticketFiles.length === 0) return setMessage("Ajoute le ticket de caisse.");
    }

    if (serviceType === "linge") {
      if (!linenPairs) return setMessage("Indique le nombre de paires de draps nettoyées.");
    }

    if (serviceType === "service_client") {
      if (!minutes) return setMessage("Indique le temps passé.");
      if (!missionDescription.trim()) return setMessage("Décris la mission réalisée.");
    }

    setSubmitting(true);
    setMessage("Envoi en cours...");

    try {
      const today = new Date().toISOString().slice(0, 10);

      const ticketHashes = [];
      for (const file of ticketFiles) {
        ticketHashes.push(await fileHash(file));
      }

      const photoHashes = [];
      for (const file of photoFiles) {
        photoHashes.push(await fileHash(file));
      }

      const duplicateKey = await sha256Text([
        today,
        staffName,
        serviceType,
        minutes || "",
        property || "",
        surfaces.join("|"),
        rooms.join("|"),
        products.join("|"),
        productsOther || "",
        purchaseAmount || "",
        linenPairs || "",
        missionDescription || "",
        ticketHashes.join("|"),
        photoHashes.join("|"),
      ].join("__"));

      const baseFolder = `prestataire/${today}/${staffName.toLowerCase()}-${duplicateKey.slice(0, 14)}`;

      const ticketPaths = await uploadFiles(ticketFiles, `${baseFolder}/tickets`);
      const photoPaths = await uploadFiles(photoFiles, `${baseFolder}/photos`);

      const { error } = await supabase.from("housekeeping_entries").insert({
        staff_name: staffName,
        service_type: serviceType,

        minutes: minutes ? Number(minutes) : null,
        purchase_done: serviceType === "achat" ? true : purchaseDone,
        purchased_products: products,
        purchase_products_other: productsOther || null,
        purchase_amount: purchaseAmount ? toNumber(purchaseAmount) : 0,
        ticket_paths: ticketPaths,

        property: serviceType === "achat" ? null : (property || null),
        surfaces,
        rooms,
        remarks: remarks || null,

        linen_pairs: linenPairs ? Number(linenPairs) : null,
        photo_paths: photoPaths,

        mission_description: missionDescription || null,

        duplicate_key: duplicateKey,
        status: "envoye",
      });

      if (error) {
        if (error.code === "23505") {
          setMessage("Cette prestation semble déjà envoyée. Doublon bloqué ✅");
        } else {
          setMessage("Erreur Supabase : " + error.message);
        }
        setSubmitting(false);
        return;
      }

      setMessage("Merci, prestation envoyée ✅");

      setStaffName("");
      setServiceType("menage");
      setMinutes("");
      setPurchaseDone(false);
      setProducts([]);
      setProductsOther("");
      setPurchaseAmount("");
      setTicketFiles([]);
      setProperty("");
      setSurfaces([]);
      setRooms([]);
      setRemarks("");
      setLinenPairs("");
      setPhotoFiles([]);
      setMissionDescription("");
    } catch (error) {
      setMessage("Erreur : " + error.message);
    }

    setSubmitting(false);
  }

  if (!pinOk) {
    return (
      <div className="prestataireApp">
        <div className="loginPanel">
          <div className="logoBubble">T</div>
          <p className="eyebrow">Tibaldo</p>
          <h1>Espace prestataire</h1>
          <p className="lead">Déclaration ménage, linge, achat ou mission.</p>

          <form onSubmit={unlock}>
            <label>
              Code d’accès
              <input
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Code prestataire"
              />
            </label>

            <button className="mainButton" type="submit">Entrer</button>
          </form>

          {message && <div className="messageBox">{message}</div>}
        </div>

        <style>{prestataireStyles}</style>
      </div>
    );
  }

  return (
    <div className="prestataireApp">
      <header className="prestataireHeader">
        <div>
          <p className="eyebrow">Tibaldo</p>
          <h1>Espace prestataire</h1>
          <p>Formulaire test — plus simple et plus joli que Google Form.</p>
        </div>
        <div className="headerIcon">🧚‍♂️</div>
      </header>

      {message.includes("Merci") && (
        <div className="celebrationOverlay megaCelebration centerExplosion" aria-hidden="true">
          <span style={{ "--angle": "0deg", "--distance": "120px", "--delay": "0.0s", "--size": "18px" }}>✨</span>
          <span style={{ "--angle": "137deg", "--distance": "151px", "--delay": "0.018s", "--size": "25px" }}>⭐</span>
          <span style={{ "--angle": "274deg", "--distance": "182px", "--delay": "0.036s", "--size": "32px" }}>🌟</span>
          <span style={{ "--angle": "51deg", "--distance": "213px", "--delay": "0.05399999999999999s", "--size": "39px" }}>🎆</span>
          <span style={{ "--angle": "188deg", "--distance": "244px", "--delay": "0.072s", "--size": "46px" }}>🎇</span>
          <span style={{ "--angle": "325deg", "--distance": "275px", "--delay": "0.09s", "--size": "19px" }}>💫</span>
          <span style={{ "--angle": "102deg", "--distance": "306px", "--delay": "0.10799999999999998s", "--size": "26px" }}>🟡</span>
          <span style={{ "--angle": "239deg", "--distance": "337px", "--delay": "0.126s", "--size": "33px" }}>🟢</span>
          <span style={{ "--angle": "16deg", "--distance": "368px", "--delay": "0.144s", "--size": "40px" }}>🔵</span>
          <span style={{ "--angle": "153deg", "--distance": "399px", "--delay": "0.16199999999999998s", "--size": "47px" }}>🟣</span>
          <span style={{ "--angle": "290deg", "--distance": "430px", "--delay": "0.18s", "--size": "20px" }}>🧡</span>
          <span style={{ "--angle": "67deg", "--distance": "461px", "--delay": "0.19799999999999998s", "--size": "27px" }}>💛</span>
          <span style={{ "--angle": "204deg", "--distance": "132px", "--delay": "0.21599999999999997s", "--size": "34px" }}>✨</span>
          <span style={{ "--angle": "341deg", "--distance": "163px", "--delay": "0.23399999999999999s", "--size": "41px" }}>⭐</span>
          <span style={{ "--angle": "118deg", "--distance": "194px", "--delay": "0.252s", "--size": "48px" }}>🌟</span>
          <span style={{ "--angle": "255deg", "--distance": "225px", "--delay": "0.26999999999999996s", "--size": "21px" }}>🎆</span>
          <span style={{ "--angle": "32deg", "--distance": "256px", "--delay": "0.288s", "--size": "28px" }}>🎇</span>
          <span style={{ "--angle": "169deg", "--distance": "287px", "--delay": "0.306s", "--size": "35px" }}>💫</span>
          <span style={{ "--angle": "306deg", "--distance": "318px", "--delay": "0.32399999999999995s", "--size": "42px" }}>🟡</span>
          <span style={{ "--angle": "83deg", "--distance": "349px", "--delay": "0.34199999999999997s", "--size": "49px" }}>🟢</span>
          <span style={{ "--angle": "220deg", "--distance": "380px", "--delay": "0.36s", "--size": "22px" }}>🔵</span>
          <span style={{ "--angle": "357deg", "--distance": "411px", "--delay": "0.37799999999999995s", "--size": "29px" }}>🟣</span>
          <span style={{ "--angle": "134deg", "--distance": "442px", "--delay": "0.39599999999999996s", "--size": "36px" }}>🧡</span>
          <span style={{ "--angle": "271deg", "--distance": "473px", "--delay": "0.414s", "--size": "43px" }}>💛</span>
          <span style={{ "--angle": "48deg", "--distance": "144px", "--delay": "0.0s", "--size": "50px" }}>✨</span>
          <span style={{ "--angle": "185deg", "--distance": "175px", "--delay": "0.018s", "--size": "23px" }}>⭐</span>
          <span style={{ "--angle": "322deg", "--distance": "206px", "--delay": "0.036s", "--size": "30px" }}>🌟</span>
          <span style={{ "--angle": "99deg", "--distance": "237px", "--delay": "0.05399999999999999s", "--size": "37px" }}>🎆</span>
          <span style={{ "--angle": "236deg", "--distance": "268px", "--delay": "0.072s", "--size": "44px" }}>🎇</span>
          <span style={{ "--angle": "13deg", "--distance": "299px", "--delay": "0.09s", "--size": "51px" }}>💫</span>
          <span style={{ "--angle": "150deg", "--distance": "330px", "--delay": "0.10799999999999998s", "--size": "24px" }}>🟡</span>
          <span style={{ "--angle": "287deg", "--distance": "361px", "--delay": "0.126s", "--size": "31px" }}>🟢</span>
          <span style={{ "--angle": "64deg", "--distance": "392px", "--delay": "0.144s", "--size": "38px" }}>🔵</span>
          <span style={{ "--angle": "201deg", "--distance": "423px", "--delay": "0.16199999999999998s", "--size": "45px" }}>🟣</span>
          <span style={{ "--angle": "338deg", "--distance": "454px", "--delay": "0.18s", "--size": "18px" }}>🧡</span>
          <span style={{ "--angle": "115deg", "--distance": "125px", "--delay": "0.19799999999999998s", "--size": "25px" }}>💛</span>
          <span style={{ "--angle": "252deg", "--distance": "156px", "--delay": "0.21599999999999997s", "--size": "32px" }}>✨</span>
          <span style={{ "--angle": "29deg", "--distance": "187px", "--delay": "0.23399999999999999s", "--size": "39px" }}>⭐</span>
          <span style={{ "--angle": "166deg", "--distance": "218px", "--delay": "0.252s", "--size": "46px" }}>🌟</span>
          <span style={{ "--angle": "303deg", "--distance": "249px", "--delay": "0.26999999999999996s", "--size": "19px" }}>🎆</span>
          <span style={{ "--angle": "80deg", "--distance": "280px", "--delay": "0.288s", "--size": "26px" }}>🎇</span>
          <span style={{ "--angle": "217deg", "--distance": "311px", "--delay": "0.306s", "--size": "33px" }}>💫</span>
          <span style={{ "--angle": "354deg", "--distance": "342px", "--delay": "0.32399999999999995s", "--size": "40px" }}>🟡</span>
          <span style={{ "--angle": "131deg", "--distance": "373px", "--delay": "0.34199999999999997s", "--size": "47px" }}>🟢</span>
          <span style={{ "--angle": "268deg", "--distance": "404px", "--delay": "0.36s", "--size": "20px" }}>🔵</span>
          <span style={{ "--angle": "45deg", "--distance": "435px", "--delay": "0.37799999999999995s", "--size": "27px" }}>🟣</span>
          <span style={{ "--angle": "182deg", "--distance": "466px", "--delay": "0.39599999999999996s", "--size": "34px" }}>🧡</span>
          <span style={{ "--angle": "319deg", "--distance": "137px", "--delay": "0.414s", "--size": "41px" }}>💛</span>
          <span style={{ "--angle": "96deg", "--distance": "168px", "--delay": "0.0s", "--size": "48px" }}>✨</span>
          <span style={{ "--angle": "233deg", "--distance": "199px", "--delay": "0.018s", "--size": "21px" }}>⭐</span>
          <span style={{ "--angle": "10deg", "--distance": "230px", "--delay": "0.036s", "--size": "28px" }}>🌟</span>
          <span style={{ "--angle": "147deg", "--distance": "261px", "--delay": "0.05399999999999999s", "--size": "35px" }}>🎆</span>
          <span style={{ "--angle": "284deg", "--distance": "292px", "--delay": "0.072s", "--size": "42px" }}>🎇</span>
          <span style={{ "--angle": "61deg", "--distance": "323px", "--delay": "0.09s", "--size": "49px" }}>💫</span>
          <span style={{ "--angle": "198deg", "--distance": "354px", "--delay": "0.10799999999999998s", "--size": "22px" }}>🟡</span>
          <span style={{ "--angle": "335deg", "--distance": "385px", "--delay": "0.126s", "--size": "29px" }}>🟢</span>
          <span style={{ "--angle": "112deg", "--distance": "416px", "--delay": "0.144s", "--size": "36px" }}>🔵</span>
          <span style={{ "--angle": "249deg", "--distance": "447px", "--delay": "0.16199999999999998s", "--size": "43px" }}>🟣</span>
          <span style={{ "--angle": "26deg", "--distance": "478px", "--delay": "0.18s", "--size": "50px" }}>🧡</span>
          <span style={{ "--angle": "163deg", "--distance": "149px", "--delay": "0.19799999999999998s", "--size": "23px" }}>💛</span>
          <span style={{ "--angle": "300deg", "--distance": "180px", "--delay": "0.21599999999999997s", "--size": "30px" }}>✨</span>
          <span style={{ "--angle": "77deg", "--distance": "211px", "--delay": "0.23399999999999999s", "--size": "37px" }}>⭐</span>
          <span style={{ "--angle": "214deg", "--distance": "242px", "--delay": "0.252s", "--size": "44px" }}>🌟</span>
          <span style={{ "--angle": "351deg", "--distance": "273px", "--delay": "0.26999999999999996s", "--size": "51px" }}>🎆</span>
          <span style={{ "--angle": "128deg", "--distance": "304px", "--delay": "0.288s", "--size": "24px" }}>🎇</span>
          <span style={{ "--angle": "265deg", "--distance": "335px", "--delay": "0.306s", "--size": "31px" }}>💫</span>
          <span style={{ "--angle": "42deg", "--distance": "366px", "--delay": "0.32399999999999995s", "--size": "38px" }}>🟡</span>
          <span style={{ "--angle": "179deg", "--distance": "397px", "--delay": "0.34199999999999997s", "--size": "45px" }}>🟢</span>
          <span style={{ "--angle": "316deg", "--distance": "428px", "--delay": "0.36s", "--size": "18px" }}>🔵</span>
          <span style={{ "--angle": "93deg", "--distance": "459px", "--delay": "0.37799999999999995s", "--size": "25px" }}>🟣</span>
          <span style={{ "--angle": "230deg", "--distance": "130px", "--delay": "0.39599999999999996s", "--size": "32px" }}>🧡</span>
          <span style={{ "--angle": "7deg", "--distance": "161px", "--delay": "0.414s", "--size": "39px" }}>💛</span>
          <span style={{ "--angle": "144deg", "--distance": "192px", "--delay": "0.0s", "--size": "46px" }}>✨</span>
          <span style={{ "--angle": "281deg", "--distance": "223px", "--delay": "0.018s", "--size": "19px" }}>⭐</span>
          <span style={{ "--angle": "58deg", "--distance": "254px", "--delay": "0.036s", "--size": "26px" }}>🌟</span>
          <span style={{ "--angle": "195deg", "--distance": "285px", "--delay": "0.05399999999999999s", "--size": "33px" }}>🎆</span>
          <span style={{ "--angle": "332deg", "--distance": "316px", "--delay": "0.072s", "--size": "40px" }}>🎇</span>
          <span style={{ "--angle": "109deg", "--distance": "347px", "--delay": "0.09s", "--size": "47px" }}>💫</span>
          <span style={{ "--angle": "246deg", "--distance": "378px", "--delay": "0.10799999999999998s", "--size": "20px" }}>🟡</span>
          <span style={{ "--angle": "23deg", "--distance": "409px", "--delay": "0.126s", "--size": "27px" }}>🟢</span>
          <span style={{ "--angle": "160deg", "--distance": "440px", "--delay": "0.144s", "--size": "34px" }}>🔵</span>
          <span style={{ "--angle": "297deg", "--distance": "471px", "--delay": "0.16199999999999998s", "--size": "41px" }}>🟣</span>
          <span style={{ "--angle": "74deg", "--distance": "142px", "--delay": "0.18s", "--size": "48px" }}>🧡</span>
          <span style={{ "--angle": "211deg", "--distance": "173px", "--delay": "0.19799999999999998s", "--size": "21px" }}>💛</span>
          <span style={{ "--angle": "348deg", "--distance": "204px", "--delay": "0.21599999999999997s", "--size": "28px" }}>✨</span>
          <span style={{ "--angle": "125deg", "--distance": "235px", "--delay": "0.23399999999999999s", "--size": "35px" }}>⭐</span>
          <span style={{ "--angle": "262deg", "--distance": "266px", "--delay": "0.252s", "--size": "42px" }}>🌟</span>
          <span style={{ "--angle": "39deg", "--distance": "297px", "--delay": "0.26999999999999996s", "--size": "49px" }}>🎆</span>
          <span style={{ "--angle": "176deg", "--distance": "328px", "--delay": "0.288s", "--size": "22px" }}>🎇</span>
          <span style={{ "--angle": "313deg", "--distance": "359px", "--delay": "0.306s", "--size": "29px" }}>💫</span>
          <span style={{ "--angle": "90deg", "--distance": "390px", "--delay": "0.32399999999999995s", "--size": "36px" }}>🟡</span>
          <span style={{ "--angle": "227deg", "--distance": "421px", "--delay": "0.34199999999999997s", "--size": "43px" }}>🟢</span>
          <span style={{ "--angle": "4deg", "--distance": "452px", "--delay": "0.36s", "--size": "50px" }}>🔵</span>
          <span style={{ "--angle": "141deg", "--distance": "123px", "--delay": "0.37799999999999995s", "--size": "23px" }}>🟣</span>
          <span style={{ "--angle": "278deg", "--distance": "154px", "--delay": "0.39599999999999996s", "--size": "30px" }}>🧡</span>
          <span style={{ "--angle": "55deg", "--distance": "185px", "--delay": "0.414s", "--size": "37px" }}>💛</span>
          <span style={{ "--angle": "192deg", "--distance": "216px", "--delay": "0.0s", "--size": "44px" }}>✨</span>
          <span style={{ "--angle": "329deg", "--distance": "247px", "--delay": "0.018s", "--size": "51px" }}>⭐</span>
          <span style={{ "--angle": "106deg", "--distance": "278px", "--delay": "0.036s", "--size": "24px" }}>🌟</span>
          <span style={{ "--angle": "243deg", "--distance": "309px", "--delay": "0.05399999999999999s", "--size": "31px" }}>🎆</span>
          <span style={{ "--angle": "20deg", "--distance": "340px", "--delay": "0.072s", "--size": "38px" }}>🎇</span>
          <span style={{ "--angle": "157deg", "--distance": "371px", "--delay": "0.09s", "--size": "45px" }}>💫</span>
          <span style={{ "--angle": "294deg", "--distance": "402px", "--delay": "0.10799999999999998s", "--size": "18px" }}>🟡</span>
          <span style={{ "--angle": "71deg", "--distance": "433px", "--delay": "0.126s", "--size": "25px" }}>🟢</span>
          <span style={{ "--angle": "208deg", "--distance": "464px", "--delay": "0.144s", "--size": "32px" }}>🔵</span>
          <span style={{ "--angle": "345deg", "--distance": "135px", "--delay": "0.16199999999999998s", "--size": "39px" }}>🟣</span>
          <span style={{ "--angle": "122deg", "--distance": "166px", "--delay": "0.18s", "--size": "46px" }}>🧡</span>
          <span style={{ "--angle": "259deg", "--distance": "197px", "--delay": "0.19799999999999998s", "--size": "19px" }}>💛</span>
          <span style={{ "--angle": "36deg", "--distance": "228px", "--delay": "0.21599999999999997s", "--size": "26px" }}>✨</span>
          <span style={{ "--angle": "173deg", "--distance": "259px", "--delay": "0.23399999999999999s", "--size": "33px" }}>⭐</span>
          <span style={{ "--angle": "310deg", "--distance": "290px", "--delay": "0.252s", "--size": "40px" }}>🌟</span>
          <span style={{ "--angle": "87deg", "--distance": "321px", "--delay": "0.26999999999999996s", "--size": "47px" }}>🎆</span>
          <span style={{ "--angle": "224deg", "--distance": "352px", "--delay": "0.288s", "--size": "20px" }}>🎇</span>
          <span style={{ "--angle": "1deg", "--distance": "383px", "--delay": "0.306s", "--size": "27px" }}>💫</span>
          <span style={{ "--angle": "138deg", "--distance": "414px", "--delay": "0.32399999999999995s", "--size": "34px" }}>🟡</span>
          <span style={{ "--angle": "275deg", "--distance": "445px", "--delay": "0.34199999999999997s", "--size": "41px" }}>🟢</span>
          <span style={{ "--angle": "52deg", "--distance": "476px", "--delay": "0.36s", "--size": "48px" }}>🔵</span>
          <span style={{ "--angle": "189deg", "--distance": "147px", "--delay": "0.37799999999999995s", "--size": "21px" }}>🟣</span>
          <span style={{ "--angle": "326deg", "--distance": "178px", "--delay": "0.39599999999999996s", "--size": "28px" }}>🧡</span>
          <span style={{ "--angle": "103deg", "--distance": "209px", "--delay": "0.414s", "--size": "35px" }}>💛</span>
          <span style={{ "--angle": "240deg", "--distance": "240px", "--delay": "0.0s", "--size": "42px" }}>✨</span>
          <span style={{ "--angle": "17deg", "--distance": "271px", "--delay": "0.018s", "--size": "49px" }}>⭐</span>
          <span style={{ "--angle": "154deg", "--distance": "302px", "--delay": "0.036s", "--size": "22px" }}>🌟</span>
          <span style={{ "--angle": "291deg", "--distance": "333px", "--delay": "0.05399999999999999s", "--size": "29px" }}>🎆</span>
          <span style={{ "--angle": "68deg", "--distance": "364px", "--delay": "0.072s", "--size": "36px" }}>🎇</span>
          <span style={{ "--angle": "205deg", "--distance": "395px", "--delay": "0.09s", "--size": "43px" }}>💫</span>
          <span style={{ "--angle": "342deg", "--distance": "426px", "--delay": "0.10799999999999998s", "--size": "50px" }}>🟡</span>
          <span style={{ "--angle": "119deg", "--distance": "457px", "--delay": "0.126s", "--size": "23px" }}>🟢</span>
          <span style={{ "--angle": "256deg", "--distance": "128px", "--delay": "0.144s", "--size": "30px" }}>🔵</span>
          <span style={{ "--angle": "33deg", "--distance": "159px", "--delay": "0.16199999999999998s", "--size": "37px" }}>🟣</span>
          <span style={{ "--angle": "170deg", "--distance": "190px", "--delay": "0.18s", "--size": "44px" }}>🧡</span>
          <span style={{ "--angle": "307deg", "--distance": "221px", "--delay": "0.19799999999999998s", "--size": "51px" }}>💛</span>
          <span style={{ "--angle": "84deg", "--distance": "252px", "--delay": "0.21599999999999997s", "--size": "24px" }}>✨</span>
          <span style={{ "--angle": "221deg", "--distance": "283px", "--delay": "0.23399999999999999s", "--size": "31px" }}>⭐</span>
          <span style={{ "--angle": "358deg", "--distance": "314px", "--delay": "0.252s", "--size": "38px" }}>🌟</span>
          <span style={{ "--angle": "135deg", "--distance": "345px", "--delay": "0.26999999999999996s", "--size": "45px" }}>🎆</span>
          <span style={{ "--angle": "272deg", "--distance": "376px", "--delay": "0.288s", "--size": "18px" }}>🎇</span>
          <span style={{ "--angle": "49deg", "--distance": "407px", "--delay": "0.306s", "--size": "25px" }}>💫</span>
          <span style={{ "--angle": "186deg", "--distance": "438px", "--delay": "0.32399999999999995s", "--size": "32px" }}>🟡</span>
          <span style={{ "--angle": "323deg", "--distance": "469px", "--delay": "0.34199999999999997s", "--size": "39px" }}>🟢</span>
          <span style={{ "--angle": "100deg", "--distance": "140px", "--delay": "0.36s", "--size": "46px" }}>🔵</span>
          <span style={{ "--angle": "237deg", "--distance": "171px", "--delay": "0.37799999999999995s", "--size": "19px" }}>🟣</span>
          <span style={{ "--angle": "14deg", "--distance": "202px", "--delay": "0.39599999999999996s", "--size": "26px" }}>🧡</span>
          <span style={{ "--angle": "151deg", "--distance": "233px", "--delay": "0.414s", "--size": "33px" }}>💛</span>
          <span style={{ "--angle": "288deg", "--distance": "264px", "--delay": "0.0s", "--size": "40px" }}>✨</span>
          <span style={{ "--angle": "65deg", "--distance": "295px", "--delay": "0.018s", "--size": "47px" }}>⭐</span>
          <span style={{ "--angle": "202deg", "--distance": "326px", "--delay": "0.036s", "--size": "20px" }}>🌟</span>
          <span style={{ "--angle": "339deg", "--distance": "357px", "--delay": "0.05399999999999999s", "--size": "27px" }}>🎆</span>
          <span style={{ "--angle": "116deg", "--distance": "388px", "--delay": "0.072s", "--size": "34px" }}>🎇</span>
          <span style={{ "--angle": "253deg", "--distance": "419px", "--delay": "0.09s", "--size": "41px" }}>💫</span>
          <span style={{ "--angle": "30deg", "--distance": "450px", "--delay": "0.10799999999999998s", "--size": "48px" }}>🟡</span>
          <span style={{ "--angle": "167deg", "--distance": "121px", "--delay": "0.126s", "--size": "21px" }}>🟢</span>
          <span style={{ "--angle": "304deg", "--distance": "152px", "--delay": "0.144s", "--size": "28px" }}>🔵</span>
          <span style={{ "--angle": "81deg", "--distance": "183px", "--delay": "0.16199999999999998s", "--size": "35px" }}>🟣</span>
          <span style={{ "--angle": "218deg", "--distance": "214px", "--delay": "0.18s", "--size": "42px" }}>🧡</span>
          <span style={{ "--angle": "355deg", "--distance": "245px", "--delay": "0.19799999999999998s", "--size": "49px" }}>💛</span>
          <span style={{ "--angle": "132deg", "--distance": "276px", "--delay": "0.21599999999999997s", "--size": "22px" }}>✨</span>
          <span style={{ "--angle": "269deg", "--distance": "307px", "--delay": "0.23399999999999999s", "--size": "29px" }}>⭐</span>
          <span style={{ "--angle": "46deg", "--distance": "338px", "--delay": "0.252s", "--size": "36px" }}>🌟</span>
          <span style={{ "--angle": "183deg", "--distance": "369px", "--delay": "0.26999999999999996s", "--size": "43px" }}>🎆</span>
          <span style={{ "--angle": "320deg", "--distance": "400px", "--delay": "0.288s", "--size": "50px" }}>🎇</span>
          <span style={{ "--angle": "97deg", "--distance": "431px", "--delay": "0.306s", "--size": "23px" }}>💫</span>
          <span style={{ "--angle": "234deg", "--distance": "462px", "--delay": "0.32399999999999995s", "--size": "30px" }}>🟡</span>
          <span style={{ "--angle": "11deg", "--distance": "133px", "--delay": "0.34199999999999997s", "--size": "37px" }}>🟢</span>
          <span style={{ "--angle": "148deg", "--distance": "164px", "--delay": "0.36s", "--size": "44px" }}>🔵</span>
          <span style={{ "--angle": "285deg", "--distance": "195px", "--delay": "0.37799999999999995s", "--size": "51px" }}>🟣</span>
          <span style={{ "--angle": "62deg", "--distance": "226px", "--delay": "0.39599999999999996s", "--size": "24px" }}>🧡</span>
          <span style={{ "--angle": "199deg", "--distance": "257px", "--delay": "0.414s", "--size": "31px" }}>💛</span>
          <span style={{ "--angle": "336deg", "--distance": "288px", "--delay": "0.0s", "--size": "38px" }}>✨</span>
          <span style={{ "--angle": "113deg", "--distance": "319px", "--delay": "0.018s", "--size": "45px" }}>⭐</span>
          <span style={{ "--angle": "250deg", "--distance": "350px", "--delay": "0.036s", "--size": "18px" }}>🌟</span>
          <span style={{ "--angle": "27deg", "--distance": "381px", "--delay": "0.05399999999999999s", "--size": "25px" }}>🎆</span>
          <span style={{ "--angle": "164deg", "--distance": "412px", "--delay": "0.072s", "--size": "32px" }}>🎇</span>
          <span style={{ "--angle": "301deg", "--distance": "443px", "--delay": "0.09s", "--size": "39px" }}>💫</span>
          <span style={{ "--angle": "78deg", "--distance": "474px", "--delay": "0.10799999999999998s", "--size": "46px" }}>🟡</span>
          <span style={{ "--angle": "215deg", "--distance": "145px", "--delay": "0.126s", "--size": "19px" }}>🟢</span>
          <span style={{ "--angle": "352deg", "--distance": "176px", "--delay": "0.144s", "--size": "26px" }}>🔵</span>
          <span style={{ "--angle": "129deg", "--distance": "207px", "--delay": "0.16199999999999998s", "--size": "33px" }}>🟣</span>
          <span style={{ "--angle": "266deg", "--distance": "238px", "--delay": "0.18s", "--size": "40px" }}>🧡</span>
          <span style={{ "--angle": "43deg", "--distance": "269px", "--delay": "0.19799999999999998s", "--size": "47px" }}>💛</span>
        </div>
      )}

      <form className="formFlow" onSubmit={submit}>
        <section className="stepCard">
          <p className="stepNumber">01</p>
          <h2>Qui es-tu ?</h2>

          <div className="choiceGrid">
            {staffOptions.map((name) => (
              <button
                key={name}
                type="button"
                className={staffName === name ? "choice active" : "choice"}
                onClick={() => setStaffName(name)}
              >
                <span className="avatarCircle">{name.slice(0, 1)}</span>
                <strong>{name}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="stepCard">
          <p className="stepNumber">02</p>
          <h2>Type de prestation</h2>

          <div className="serviceGrid">
            {serviceOptions.map((service) => (
              <button
                key={service.id}
                type="button"
                className={serviceType === service.id ? `serviceCard ${service.color} active` : `serviceCard ${service.color}`}
                onClick={() => setServiceType(service.id)}
              >
                <span>{service.icon}</span>
                <strong>{service.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="stepCard highlight">
          <p className="stepNumber">03</p>
          <h2>{serviceType === "achat" ? "🛒 Achat uniquement" : `${selectedService?.icon} Détails`}</h2>

          {(serviceType === "menage" || serviceType === "service_client") && (
            <label>
              Temps passé sur la prestation en minutes
              <input
                type="number"
                min="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Ex : 90"
              />
            </label>
          )}

          {serviceType === "menage" && (
            <>
              <label>
                Logement concerné
                <select value={property} onChange={(e) => setProperty(e.target.value)}>
                  <option value="">Choisir</option>
                  <option value="Melezio">Melezio</option>
                  <option value="Fives">Fives</option>
                </select>
              </label>

              {property === "Fives" && (
                <>
                  <div className="fieldGroup">
                    <h3>Surfaces communes nettoyées</h3>
                    <div className="pillGrid">
                      {surfaceOptions.map((surface) => (
                        <button
                          key={surface}
                          type="button"
                          className={surfaces.includes(surface) ? "pill active" : "pill"}
                          onClick={() => toggleValue(surface, surfaces, setSurfaces)}
                        >
                          {surface}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="fieldGroup">
                    <h3>Chambres préparées</h3>
                    <div className="pillGrid rooms">
                      {roomOptions.map((room) => (
                        <button
                          key={room}
                          type="button"
                          className={rooms.includes(room) ? "pill active" : "pill"}
                          onClick={() => toggleValue(room, rooms, setRooms)}
                        >
                          {room}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <label>
                Remarques
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Dégradations, casses, anomalies, retard check-out, linge présent, etc."
                />
              </label>
            </>
          )}

          {serviceType === "linge" && (
            <>
              <label>
                Combien de paires de draps as-tu nettoyées ?
                <select value={linenPairs} onChange={(e) => setLinenPairs(e.target.value)}>
                  <option value="">Choisir</option>
                  <option value="1">1 paire</option>
                  <option value="2">2 paires</option>
                  <option value="3">3 paires</option>
                  <option value="4">4 paires</option>
                  <option value="5">5 paires</option>
                </select>
              </label>

              <label>
                Photos si besoin
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => setPhotoFiles([...e.target.files])}
                />
              </label>
            </>
          )}

          {serviceType === "achat" && (
            <div className="achatPanel">
              <p className="achatIntro">
                Ajoute simplement le ticket de caisse. Le montant et les produits seront analysés automatiquement.
              </p>

              <div className="achatCard achatOrange megaTicketCard">
                <div className="achatCardHeader">
                  <span>🧾</span>
                  <h3>Ticket de caisse obligatoire</h3>
                </div>

                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => setTicketFiles([...e.target.files])}
                />

                <p className="miniHelp">
                  Photo, capture écran ou PDF accepté. L’analyse OCR se fera côté Tibaldo OS.
                </p>
              </div>

              <div className="achatCard achatPurple">
                <div className="achatCardHeader">
                  <span>💬</span>
                  <h3>Remarque si besoin</h3>
                </div>

                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optionnel : contexte, urgence, produit particulier..."
                />
              </div>

              
            </div>
          )}

          {serviceType === "service_client" && (
            <label>
              Description de la mission
              <textarea
                value={missionDescription}
                onChange={(e) => setMissionDescription(e.target.value)}
                placeholder="Ex : réponse client, appel, gestion problème, coordination..."
              />
            </label>
          )}
        </section>

        {serviceType === "menage" && (
          <section className="stepCard purchaseCard">
            <p className="stepNumber">04</p>
            <h2>Achats / ticket</h2>

            <div className="yesNo">
              <button
                type="button"
                className={!purchaseDone ? "yesNoButton active" : "yesNoButton"}
                onClick={() => setPurchaseDone(false)}
              >
                Pas d’achat
              </button>
              <button
                type="button"
                className={purchaseDone ? "yesNoButton active" : "yesNoButton"}
                onClick={() => setPurchaseDone(true)}
              >
                Achat effectué
              </button>
            </div>

            {purchaseDone && (
              <>
                <div className="fieldGroup">
                  <h3>Produits achetés</h3>
                  <div className="pillGrid">
                    {productOptions.map((product) => (
                      <button
                        key={product}
                        type="button"
                        className={products.includes(product) ? "pill active" : "pill"}
                        onClick={() => toggleValue(product, products, setProducts)}
                      >
                        {product}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Autres produits
                  <input
                    value={productsOther}
                    onChange={(e) => setProductsOther(e.target.value)}
                    placeholder="Ex : sacs poubelle, savon..."
                  />
                </label>

                <label>
                  Montant achats
                  <input
                    inputMode="decimal"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    placeholder="Ex : 12,50"
                  />
                </label>

                <label>
                  Ticket de caisse
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(e) => setTicketFiles([...e.target.files])}
                  />
                </label>
              </>
            )}
          </section>
        )}

        <section className="recapCard">
          <h2>Récapitulatif</h2>
          <div className="recapGrid">
            <span>Prénom</span><strong>{staffName || "—"}</strong>
            <span>Prestation</span><strong>{selectedService?.label}</strong>
            <span>Temps</span><strong>{minutes ? `${minutes} min` : "—"}</strong>
            {serviceType !== "achat" && (
              <>
                <span>Logement</span><strong>{property || "—"}</strong>
              </>
            )}
            <span>Chambres</span><strong>{rooms.length ? rooms.join(", ") : "—"}</strong>
            <span>Achats</span><strong>{serviceType === "achat" || purchaseDone ? `${purchaseAmount || "0"} €` : "Non"}</strong>
            <span>Tickets</span><strong>{ticketFiles.length}</strong>
            <span>Photos</span><strong>{photoFiles.length}</strong>
          </div>

          <div className="submitPanel">
            <div className="rainbowBar" />
            <h3>Tout est bon ?</h3>
            <p>Vérifie rapidement le récapitulatif, puis envoie ta prestation.</p>

            <button className="submitButton" type="submit" disabled={submitting}>
              {submitting ? "Envoi en cours..." : "Envoyer la prestation"}
            </button>
          </div>

          {message && (
            <div className={message.includes("Merci") ? "messageBox success celebration" : "messageBox"}>
              {message.includes("Merci") && (
                <div className="stars">
                  <span>✨</span>
                  <span>⭐</span>
                  <span>🎆</span>
                  <span>✨</span>
                  <span>⭐</span>
                </div>
              )}
              <strong>{message}</strong>
              {message.includes("Merci") && <small>Tu peux fermer la page ou déclarer une autre prestation.</small>}
            </div>
          )}
        </section>
      </form>

      <style>{prestataireStyles}</style>
    </div>
  );
}

async function uploadFiles(files, folder) {
  const paths = [];

  for (const file of files) {
    const cleanName = sanitizeFileName(file.name);
    const path = `${folder}/${Date.now()}-${cleanName}`;

    const { error } = await supabase.storage
      .from("tibaldo-documents")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;
    paths.push(path);
  }

  return paths;
}

async function fileHash(file) {
  const buffer = await file.arrayBuffer();
  return sha256Buffer(buffer);
}

async function sha256Text(text) {
  const encoder = new TextEncoder();
  return sha256Buffer(encoder.encode(text));
}

async function sha256Buffer(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFileName(fileName) {
  return String(fileName || "document")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function toNumber(value) {
  const cleaned = String(value || "")
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

const prestataireStyles = `
* { box-sizing: border-box; }

body {
  margin: 0;
}

.prestataireApp {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 195, 113, .34), transparent 34%),
    radial-gradient(circle at top right, rgba(111, 177, 153, .35), transparent 30%),
    linear-gradient(135deg, #fff7ec 0%, #edf7ef 55%, #f5efff 100%);
  color: #163c2e;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 18px;
}

.loginPanel,
.prestataireHeader,
.stepCard,
.recapCard {
  width: min(760px, 100%);
  margin: 0 auto 16px;
  background: rgba(255,255,255,.82);
  border: 1px solid rgba(22,60,46,.08);
  border-radius: 30px;
  padding: 22px;
  box-shadow: 0 18px 50px rgba(22,60,46,.10);
  backdrop-filter: blur(10px);
}

.loginPanel {
  margin-top: 8vh;
  max-width: 460px;
}

.logoBubble {
  width: 58px;
  height: 58px;
  border-radius: 21px;
  background: #163c2e;
  color: white;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 950;
  margin-bottom: 14px;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  color: #9a704b;
  letter-spacing: .14em;
  font-size: 11px;
  font-weight: 950;
}

h1, h2, h3, p {
  margin-top: 0;
}

h1 {
  font-size: clamp(32px, 7vw, 54px);
  line-height: .95;
  color: #163c2e;
  margin-bottom: 10px;
}

h2 {
  font-size: 25px;
  color: #163c2e;
  margin-bottom: 16px;
}

h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #163c2e;
}

.lead,
.prestataireHeader p {
  color: #695d50;
  line-height: 1.55;
}

.prestataireHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.headerIcon {
  width: 70px;
  height: 70px;
  border-radius: 26px;
  background: #ffe7bc;
  display: grid;
  place-items: center;
  font-size: 38px;
  flex: 0 0 auto;
}

.formFlow {
  display: grid;
  gap: 16px;
}

.stepNumber {
  width: 44px;
  height: 44px;
  background: #163c2e;
  color: white;
  display: grid;
  place-items: center;
  border-radius: 16px;
  font-weight: 950;
}

.highlight {
  background: rgba(255,255,255,.9);
}

.purchaseCard {
  background: rgba(255,248,231,.92);
}

.choiceGrid,
.serviceGrid,
.pillGrid,
.yesNo {
  display: grid;
  gap: 10px;
}

.choiceGrid {
  grid-template-columns: repeat(3, 1fr);
}

.serviceGrid {
  grid-template-columns: 1fr;
}

.choice,
.serviceCard,
.pill,
.yesNoButton {
  border: 0;
  border-radius: 22px;
  background: #f6f1e9;
  color: #163c2e;
  padding: 16px;
  font-weight: 900;
  text-align: center;
  cursor: pointer;
}

.choice span,
.serviceCard span {
  display: block;
  font-size: 30px;
  margin-bottom: 8px;
}

.avatarCircle {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  background: rgba(22,60,46,.12);
  color: #163c2e;
  display: grid !important;
  place-items: center;
  font-size: 22px !important;
  font-weight: 950;
  margin: 0 auto 10px !important;
}

.choice.active .avatarCircle {
  background: rgba(255,255,255,.22);
  color: white;
}

.choice.active,
.pill.active,
.yesNoButton.active {
  background: #163c2e;
  color: white;
}

.serviceCard {
  min-height: 112px;
}

.serviceCard.green.active { background: #1f7a4d; color: white; }
.serviceCard.purple.active { background: #7557b8; color: white; }
.serviceCard.blue.active { background: #276f9f; color: white; }
.serviceCard.orange.active { background: #d97818; color: white; }

label {
  display: grid;
  gap: 8px;
  color: #163c2e;
  font-weight: 900;
  margin: 14px 0;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid rgba(22,60,46,.12);
  border-radius: 18px;
  padding: 15px;
  background: white;
  color: #1f1f1f;
  font: inherit;
}

textarea {
  min-height: 120px;
  resize: vertical;
}

.fieldGroup {
  margin: 18px 0;
}

.pillGrid {
  grid-template-columns: repeat(2, 1fr);
}

.pillGrid.rooms {
  grid-template-columns: repeat(2, 1fr);
}

.yesNo {
  grid-template-columns: 1fr 1fr;
}

.mainButton {
  width: 100%;
  border: 0;
  border-radius: 22px;
  background: #163c2e;
  color: white;
  padding: 17px 18px;
  font-weight: 950;
  font-size: 17px;
  cursor: pointer;
  box-shadow: 0 14px 35px rgba(22,60,46,.18);
}

.submitPanel {
  margin-top: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.88));
  color: #163c2e;
  border-radius: 30px;
  padding: 22px;
  box-shadow: 0 18px 45px rgba(0,0,0,.16);
  overflow: hidden;
  position: relative;
}

.submitPanel h3 {
  color: #163c2e;
  font-size: 24px;
  margin: 12px 0 6px;
}

.submitPanel p {
  color: #695d50;
  margin-bottom: 18px;
}

.rainbowBar {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff5f6d, #ffc371, #47d16c, #4facfe, #b465da, #ff5f6d);
  background-size: 300% 100%;
  animation: rainbowMove 3s linear infinite;
  box-shadow: 0 8px 20px rgba(255, 126, 95, .35);
}

.submitButton {
  width: 100%;
  border: 0;
  border-radius: 26px;
  background: linear-gradient(135deg, #163c2e, #1f7a4d);
  color: white;
  padding: 22px 20px;
  font-weight: 950;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 18px 42px rgba(22,60,46,.28);
  transform: translateY(0);
  transition: transform .18s ease, box-shadow .18s ease;
}

.submitButton::after {
  content: " ✅";
}

.submitButton:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 52px rgba(22,60,46,.34);
}

.submitButton:disabled {
  opacity: .7;
  transform: none;
}

.submitButton:disabled::after {
  content: "";
}

.messageBox.success.celebration {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #dfffe9, #fff7c8, #ffe1f3);
  color: #145c36;
  text-align: center;
  padding: 24px 16px;
  border: 2px solid rgba(20,92,54,.12);
  animation: popSuccess .45s ease-out;
}

.messageBox.success.celebration strong {
  display: block;
  font-size: 24px;
  margin-top: 12px;
}

.messageBox.success.celebration small {
  display: block;
  margin-top: 8px;
  color: #3f6f55;
  font-weight: 800;
}

.stars {
  position: relative;
  height: 44px;
}

.stars span {
  position: absolute;
  font-size: 28px;
  animation: firework 1.2s ease-out infinite;
}

.stars span:nth-child(1) { left: 10%; top: 14px; animation-delay: 0s; }
.stars span:nth-child(2) { left: 28%; top: 2px; animation-delay: .15s; }
.stars span:nth-child(3) { left: 48%; top: 10px; animation-delay: .3s; }
.stars span:nth-child(4) { left: 68%; top: 0; animation-delay: .45s; }
.stars span:nth-child(5) { left: 86%; top: 16px; animation-delay: .6s; }

@keyframes rainbowMove {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

@keyframes popSuccess {
  0% { transform: scale(.94); opacity: .2; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes firework {
  0% { transform: translateY(18px) scale(.4) rotate(0deg); opacity: 0; }
  35% { opacity: 1; }
  100% { transform: translateY(-18px) scale(1.15) rotate(18deg); opacity: 0; }
}

.messageBox {
  margin-top: 14px;
  padding: 14px;
  border-radius: 18px;
  background: #fff3cd;
  color: #735600;
  font-weight: 850;
}

.messageBox.success {
  background: #def7e8;
  color: #145c36;
}

.recapCard {
  background: #163c2e;
  color: white;
}

.recapCard h2 {
  color: white;
}

.recapGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: rgba(255,255,255,.12);
  border-radius: 22px;
  padding: 16px;
  margin-bottom: 16px;
}

.recapGrid span {
  color: rgba(255,255,255,.72);
}

.recapGrid strong {
  text-align: right;
}


.softIntro {
  color: #695d50;
  background: rgba(255,255,255,.58);
  border-radius: 18px;
  padding: 12px 14px;
  font-weight: 800;
}

.celebrationOverlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  overflow: hidden;
}

.celebrationOverlay span {
  position: absolute;
  font-size: clamp(24px, 6vw, 54px);
  animation: fullFirework 1.8s ease-out forwards;
  opacity: 0;
  filter: drop-shadow(0 8px 14px rgba(0,0,0,.22));
}

.celebrationOverlay span:nth-child(1) { left: 8%; top: 82%; animation-delay: 0s; }
.celebrationOverlay span:nth-child(2) { left: 18%; top: 74%; animation-delay: .08s; }
.celebrationOverlay span:nth-child(3) { left: 28%; top: 86%; animation-delay: .16s; }
.celebrationOverlay span:nth-child(4) { left: 38%; top: 78%; animation-delay: .24s; }
.celebrationOverlay span:nth-child(5) { left: 48%; top: 90%; animation-delay: .32s; }
.celebrationOverlay span:nth-child(6) { left: 58%; top: 76%; animation-delay: .40s; }
.celebrationOverlay span:nth-child(7) { left: 68%; top: 88%; animation-delay: .48s; }
.celebrationOverlay span:nth-child(8) { left: 78%; top: 80%; animation-delay: .56s; }
.celebrationOverlay span:nth-child(9) { left: 88%; top: 84%; animation-delay: .64s; }
.celebrationOverlay span:nth-child(10) { left: 12%; top: 62%; animation-delay: .72s; }
.celebrationOverlay span:nth-child(11) { left: 32%; top: 58%; animation-delay: .80s; }
.celebrationOverlay span:nth-child(12) { left: 52%; top: 64%; animation-delay: .88s; }
.celebrationOverlay span:nth-child(13) { left: 72%; top: 60%; animation-delay: .96s; }
.celebrationOverlay span:nth-child(14) { left: 22%; top: 46%; animation-delay: 1.04s; }
.celebrationOverlay span:nth-child(15) { left: 82%; top: 48%; animation-delay: 1.12s; }

@keyframes fullFirework {
  0% {
    transform: translateY(80px) scale(.3) rotate(0deg);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  60% {
    transform: translateY(-220px) scale(1.35) rotate(22deg);
    opacity: 1;
  }
  100% {
    transform: translateY(-330px) scale(.8) rotate(46deg);
    opacity: 0;
  }
}

.messageBox.success.celebration {
  background: linear-gradient(120deg, #ff4d6d, #ffb703, #38b000, #00bbf9, #9b5de5, #ff4d6d) !important;
  background-size: 400% 400% !important;
  color: white !important;
  border: 0 !important;
  border-radius: 32px !important;
  box-shadow: 0 24px 70px rgba(155,93,229,.35), 0 18px 42px rgba(255,77,109,.28) !important;
  animation: rainbowSuccess 2.5s ease infinite, popSuccess .45s ease-out !important;
}

.messageBox.success.celebration strong {
  color: white !important;
  text-shadow: 0 3px 12px rgba(0,0,0,.22);
}

.messageBox.success.celebration small {
  color: rgba(255,255,255,.92) !important;
}

@keyframes rainbowSuccess {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}











.messageBox.success.celebration {
  background: linear-gradient(120deg, #ff006e, #fb5607, #ffbe0b, #38b000, #00bbf9, #8338ec, #ff006e) !important;
  background-size: 500% 500% !important;
  color: white !important;
  border: 0 !important;
  border-radius: 36px !important;
  box-shadow:
    0 30px 90px rgba(131,56,236,.38),
    0 20px 60px rgba(255,0,110,.30),
    inset 0 0 0 2px rgba(255,255,255,.22) !important;
  animation: rainbowSuccess 1.8s ease infinite, popSuccess .45s ease-out !important;
}

.messageBox.success.celebration::before {
  content: "🎉 ✨ 🎆 BRAVO 🎆 ✨ 🎉";
  display: block;
  font-size: 20px;
  font-weight: 950;
  margin-bottom: 12px;
  letter-spacing: .05em;
}

.messageBox.success.celebration strong {
  color: white !important;
  text-shadow: 0 4px 16px rgba(0,0,0,.30);
  font-size: 28px !important;
}

.messageBox.success.celebration small {
  color: rgba(255,255,255,.96) !important;
  font-size: 15px;
}



.centerExplosion {
  position: fixed;
  inset: 0;
  z-index: 99999;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(255,255,255,.28), rgba(255,255,255,.08) 22%, transparent 48%);
  animation: explosionFade 2.8s ease-out forwards;
}

.centerExplosion::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 34vmin;
  height: 34vmin;
  border-radius: 999px;
  transform: translate(-50%, -50%) scale(.2);
  background:
    radial-gradient(circle, rgba(255,255,255,.95), rgba(255,215,0,.75) 24%, rgba(255,0,110,.45) 44%, transparent 68%);
  animation: centerFlash 1s ease-out forwards;
  filter: blur(1px);
}

.centerExplosion span {
  position: absolute;
  left: 50%;
  top: 50%;
  font-size: var(--size);
  opacity: 0;
  transform:
    translate(-50%, -50%)
    rotate(var(--angle))
    translateX(0)
    rotate(calc(-1 * var(--angle)))
    scale(.25);
  animation: explodeFromCenter 2.4s cubic-bezier(.12,.75,.24,1) forwards;
  animation-delay: var(--delay);
  filter: drop-shadow(0 8px 14px rgba(0,0,0,.25));
}

.centerExplosion span:nth-child(3n) {
  animation-duration: 2.8s;
}

.centerExplosion span:nth-child(5n) {
  animation-duration: 2.1s;
}

.centerExplosion span:nth-child(7n) {
  filter: drop-shadow(0 0 14px rgba(255,255,255,.9));
}

@keyframes explodeFromCenter {
  0% {
    opacity: 0;
    transform:
      translate(-50%, -50%)
      rotate(var(--angle))
      translateX(0)
      rotate(calc(-1 * var(--angle)))
      scale(.2);
  }

  12% {
    opacity: 1;
  }

  58% {
    opacity: 1;
    transform:
      translate(-50%, -50%)
      rotate(var(--angle))
      translateX(var(--distance))
      rotate(calc(-1 * var(--angle)))
      scale(1.35);
  }

  100% {
    opacity: 0;
    transform:
      translate(-50%, -50%)
      rotate(var(--angle))
      translateX(calc(var(--distance) * 1.25))
      rotate(calc(-1 * var(--angle)))
      scale(.55);
  }
}

@keyframes centerFlash {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(.15);
  }

  22% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.7);
  }
}

@keyframes explosionFade {
  0% { opacity: 1; }
  78% { opacity: 1; }
  100% { opacity: 0; }
}



/* ===== ACHAT UNIQUEMENT - STYLE PREMIUM ===== */

.stepCard.highlight {
  background:
    radial-gradient(circle at top left, rgba(255, 190, 11, .14), transparent 32%),
    radial-gradient(circle at bottom right, rgba(0, 187, 249, .12), transparent 34%),
    rgba(255,255,255,.92);
}

.softIntro {
  color: #5e5148;
  background: linear-gradient(135deg, #fff4d8, #fffaf0);
  border: 1px solid rgba(217, 120, 24, .18);
  border-radius: 24px;
  padding: 16px 18px;
  font-weight: 900;
  box-shadow: 0 12px 26px rgba(217,120,24,.08);
}

.colorBlock {
  margin: 22px 0;
  padding: 22px;
  border-radius: 32px;
  border: 2px solid rgba(255,255,255,.72);
  box-shadow:
    0 18px 44px rgba(22,60,46,.10),
    inset 0 1px 0 rgba(255,255,255,.75);
  position: relative;
  overflow: hidden;
}

.colorBlock::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: .42;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 10%, rgba(255,255,255,.86), transparent 22%),
    radial-gradient(circle at 92% 88%, rgba(255,255,255,.55), transparent 26%);
}

.colorBlock > * {
  position: relative;
  z-index: 1;
}

.colorBlock h3,
.colorBlock,
.colorBlock label {
  color: #143d2f;
}

.colorBlock h3,
.colorBlock > label,
.colorBlock {
  font-weight: 950;
}

.greenBlock {
  background:
    linear-gradient(135deg, rgba(191, 239, 207, .95), rgba(235, 255, 241, .98));
  border-color: rgba(31, 122, 77, .18);
}

.yellowBlock {
  background:
    linear-gradient(135deg, rgba(255, 232, 151, .95), rgba(255, 250, 229, .98));
  border-color: rgba(191, 143, 0, .18);
}

.blueBlock {
  background:
    linear-gradient(135deg, rgba(181, 223, 255, .95), rgba(239, 249, 255, .98));
  border-color: rgba(39, 111, 159, .18);
}

.orangeBlock {
  background:
    linear-gradient(135deg, rgba(255, 198, 147, .95), rgba(255, 241, 229, .98));
  border-color: rgba(217, 120, 24, .20);
}

.purpleBlock {
  background:
    linear-gradient(135deg, rgba(222, 197, 255, .95), rgba(250, 245, 255, .98));
  border-color: rgba(117, 87, 184, .20);
}

.colorBlock input,
.colorBlock textarea,
.colorBlock select {
  background: rgba(255,255,255,.95);
  border: 2px solid rgba(22,60,46,.10);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.85),
    0 8px 18px rgba(22,60,46,.06);
}

.colorBlock input:focus,
.colorBlock textarea:focus {
  outline: none;
  border-color: rgba(22,60,46,.38);
  box-shadow:
    0 0 0 4px rgba(22,60,46,.08),
    0 12px 24px rgba(22,60,46,.08);
}

.colorBlock .pill {
  background: rgba(255,255,255,.76);
  border: 1px solid rgba(22,60,46,.08);
  box-shadow: 0 8px 18px rgba(22,60,46,.06);
}

.colorBlock .pill.active {
  background: linear-gradient(135deg, #163c2e, #1f7a4d);
  color: white;
  box-shadow: 0 12px 24px rgba(22,60,46,.20);
}

.orangeBlock input[type="file"] {
  background: white;
  border: 2px dashed rgba(217, 120, 24, .42);
  padding: 18px;
}

.purpleBlock textarea {
  min-height: 150px;
}



/* ===== ACHAT UNIQUEMENT - BLOCS VISUELS FORTS ===== */

.achatPanel {
  display: grid;
  gap: 22px;
  margin-top: 18px;
}

.achatIntro {
  margin: 0;
  padding: 18px 20px;
  border-radius: 26px;
  background: linear-gradient(135deg, #163c2e, #246b4c);
  color: white;
  font-weight: 950;
  text-align: center;
  box-shadow: 0 16px 36px rgba(22,60,46,.20);
}

.achatCard {
  border-radius: 34px;
  padding: 24px;
  color: #102f24;
  box-shadow:
    0 20px 48px rgba(22,60,46,.14),
    inset 0 1px 0 rgba(255,255,255,.55);
  border: 2px solid rgba(255,255,255,.72);
  position: relative;
  overflow: hidden;
}

.achatCard::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,.58), transparent 28%),
    radial-gradient(circle at bottom right, rgba(255,255,255,.35), transparent 30%);
  pointer-events: none;
}

.achatCard > * {
  position: relative;
  z-index: 1;
}

.achatCardHeader {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.achatCardHeader span {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.78);
  box-shadow: 0 10px 22px rgba(0,0,0,.08);
  font-size: 28px;
  flex: 0 0 auto;
}

.achatCardHeader h3 {
  margin: 0;
  font-size: 25px;
  line-height: 1.05;
  color: #102f24;
}

.achatGreen {
  background: linear-gradient(135deg, #7ee2a8, #dfffea);
}

.achatYellow {
  background: linear-gradient(135deg, #ffd166, #fff4c2);
}

.achatBlue {
  background: linear-gradient(135deg, #8ecaff, #e2f3ff);
}

.achatOrange {
  background: linear-gradient(135deg, #ffad69, #ffe0c2);
}

.achatPurple {
  background: linear-gradient(135deg, #c5a3ff, #f0e4ff);
}

.achatCard input,
.achatCard textarea {
  background: rgba(255,255,255,.94);
  border: 2px solid rgba(16,47,36,.14);
  border-radius: 22px;
  padding: 18px;
  color: #102f24;
  font-weight: 850;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.85),
    0 10px 22px rgba(16,47,36,.08);
}

.achatCard input::placeholder,
.achatCard textarea::placeholder {
  color: rgba(16,47,36,.52);
  font-weight: 850;
}

.achatCard input:focus,
.achatCard textarea:focus {
  outline: none;
  border-color: rgba(16,47,36,.48);
  box-shadow:
    0 0 0 5px rgba(16,47,36,.10),
    0 14px 28px rgba(16,47,36,.12);
}

.achatCard textarea {
  min-height: 160px;
}

.achatCard input[type="file"] {
  border: 3px dashed rgba(16,47,36,.32);
  background: rgba(255,255,255,.84);
  padding: 22px;
}

.achatCard .pill {
  background: rgba(255,255,255,.76);
  color: #102f24;
  border: 1px solid rgba(16,47,36,.10);
  box-shadow: 0 10px 22px rgba(16,47,36,.08);
}

.achatCard .pill.active {
  background: linear-gradient(135deg, #102f24, #1f7a4d);
  color: white;
  box-shadow: 0 16px 30px rgba(16,47,36,.26);
}



.megaTicketCard {
  border: 3px solid rgba(217, 120, 24, .28);
  box-shadow:
    0 26px 70px rgba(217,120,24,.22),
    inset 0 1px 0 rgba(255,255,255,.72);
}

.megaTicketCard input[type="file"] {
  font-size: 20px;
  font-weight: 950;
  border: 4px dashed rgba(16,47,36,.36);
  background: rgba(255,255,255,.92);
  padding: 28px;
}

.miniHelp {
  margin: 14px 0 0;
  color: rgba(16,47,36,.72);
  font-weight: 850;
}

.manualDetails {
  border-radius: 28px;
  background: rgba(255,255,255,.72);
  border: 2px dashed rgba(22,60,46,.16);
  padding: 18px;
}

.manualDetails summary {
  cursor: pointer;
  font-weight: 950;
  color: #163c2e;
  font-size: 18px;
  text-align: center;
}

.manualDetails[open] summary {
  margin-bottom: 16px;
}


@media (min-width: 720px) {
  .serviceGrid {
    grid-template-columns: repeat(3, 1fr);
  }

  .pillGrid {
    grid-template-columns: repeat(3, 1fr);
  }

  .pillGrid.rooms {
    grid-template-columns: repeat(4, 1fr);
  }
}
`;
