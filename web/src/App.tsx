import Co2Chart from "./components/Co2Chart";
import HeroStats from "./components/HeroStats";
import LocationCards from "./components/LocationCards";
import TemperatureChart from "./components/TemperatureChart";

export default function App() {
  return (
    <div className="page">
      <SiteHeader />
      <HeroStats />
      <main className="content">
        <LocationCards />
        <TemperatureChart />
        <Co2Chart />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden />
          Sensor Manager
        </a>
        <nav>
          <a href="#latest">Latest</a>
          <a href="#temperature">Temperature</a>
          <a href="#air">Air quality</a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-foot">
      <div>
        Built with Kotlin + Spring Boot and React. Data from a real home/lab
        sensor deployment.
      </div>
    </footer>
  );
}
