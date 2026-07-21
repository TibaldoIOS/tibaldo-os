export default function PlanningPage() {
  const calendarEmbedUrl =
    "https://calendar.google.com/calendar/embed?src=rom.pruvost%40gmail.com&src=np2cqkl8k1imvf746o7qlvmnkbcu1sni%40import.calendar.google.com&ctz=Europe%2FParis&mode=WEEK&showTitle=0&showPrint=0&showTabs=1&showCalendars=1";

  return (
    <div className="planningPage">
      <header className="planningHero">
        <div>
          <p className="eyebrow">Tibaldo OS</p>
          <h1>Planning</h1>
          <p>
            Agenda Google + agenda Privé Apple/iCloud synchronisé. Vue semaine pour piloter tes rendez-vous,
            Airbnb, animaux, tâches et journées.
          </p>
        </div>

        <a
          className="openCalendar"
          href="https://calendar.google.com/calendar/u/0?cid=cm9tLnBydXZvc3RAZ21haWwuY29t"
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir Google Agenda
        </a>
      </header>

      <section className="calendarCard">
        <iframe
          title="Planning Tibaldo"
          src={calendarEmbedUrl}
          frameBorder="0"
          scrolling="no"
        />
      </section>

      <section className="infoCard">
        <h2>À venir</h2>
        <p>
          Prochaine étape : connecter Tibaldo IA au planning pour lui demander “résume ma journée”,
          “qu’est-ce que j’ai demain ?” ou “où sont mes trous dans la semaine ?”.
        </p>
      </section>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.planningPage {
  min-height: 100vh;
  padding: 16px;
  background:
    radial-gradient(circle at top left, rgba(126,226,168,.16), transparent 34%),
    radial-gradient(circle at bottom right, rgba(255,209,102,.20), transparent 36%),
    linear-gradient(135deg, #f7f4ef 0%, #eef8f2 100%);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1f4d3a;
}

.planningHero,
.calendarCard,
.infoCard {
  width: min(1180px, 100%);
  margin: 0 auto 14px;
  background: rgba(255,255,255,.9);
  border: 1px solid rgba(31,77,58,.10);
  border-radius: 28px;
  padding: 20px;
  box-shadow: 0 18px 44px rgba(31,77,58,.08);
}

.planningHero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  color: #8a6a4f;
  letter-spacing: .13em;
  font-size: 11px;
  font-weight: 950;
}

h1 {
  margin: 0 0 10px;
  font-size: clamp(34px, 7vw, 58px);
  line-height: .95;
}

h2 {
  margin: 0 0 8px;
}

p {
  color: #6d6257;
  line-height: 1.45;
}

.openCalendar {
  background: #1f4d3a;
  color: white;
  text-decoration: none;
  border-radius: 18px;
  padding: 13px 16px;
  font-weight: 950;
  white-space: nowrap;
}

.calendarCard {
  padding: 10px;
  overflow: hidden;
}

.calendarCard iframe {
  width: 100%;
  height: calc(100vh - 260px);
  min-height: 620px;
  border: 0;
  border-radius: 22px;
  background: white;
}

.infoCard {
  background: rgba(255,255,255,.72);
}

@media (max-width: 760px) {
  .planningHero {
    flex-direction: column;
  }

  .openCalendar {
    width: 100%;
    text-align: center;
  }

  .calendarCard iframe {
    height: 680px;
    min-height: 680px;
  }
}
`;
