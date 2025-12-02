import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Over - Methodologie en Data",
  description:
    "Informatie over de methodologie en databronnen van de Nederlandse Auto Betrouwbaarheidsanalyse.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Over dit project
      </h1>

      {/* Introduction */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Wat is Auto Betrouwbaarheid NL?
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Auto Betrouwbaarheid NL is een onafhankelijk project dat de betrouwbaarheid van
          auto merken en modellen in Nederland analyseert op basis van openbare APK-keuringsgegevens.
          Het doel is om consumenten te helpen bij het maken van weloverwogen keuzes bij de
          aankoop van een auto.
        </p>
      </section>

      {/* Data Sources */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Databronnen
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Alle gegevens zijn afkomstig van{" "}
          <a
            href="https://opendata.rdw.nl/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            RDW Open Data
          </a>
          , de officiële open data portal van de Rijksdienst voor het Wegverkeer.
          De volgende datasets worden gebruikt:
        </p>

        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300 ml-4">
          <li>
            <strong>Gekentekende Voertuigen</strong> - Basisinformatie over geregistreerde voertuigen
          </li>
          <li>
            <strong>Meldingen Keuringsinstantie</strong> - APK-keuringsresultaten
          </li>
          <li>
            <strong>Geconstateerde Gebreken</strong> - Gebreken gevonden tijdens APK-keuringen
          </li>
          <li>
            <strong>Gebreken</strong> - Omschrijvingen van gebrektypen
          </li>
          <li>
            <strong>Brandstof</strong> - Brandstofgegevens van voertuigen
          </li>
        </ul>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Methodologie
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Betrouwbaarheidsscore
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              De betrouwbaarheidsscore is gebaseerd op het <strong>gebrekenpercentage</strong>:
              het percentage APK-keuringen waarbij een of meer gebreken zijn geconstateerd.
              Een lager percentage betekent een hogere betrouwbaarheid.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Gemiddelde gebreken per keuring
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Dit getal geeft aan hoeveel gebreken gemiddeld worden gevonden per APK-keuring.
              Een lager getal wijst op betere bouwkwaliteit of onderhoud.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Steekproefgrootte
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              De betrouwbaarheid van de statistieken hangt af van het aantal keuringen.
              Modellen worden gecategoriseerd als:
            </p>
            <ul className="list-disc list-inside mt-2 text-gray-600 dark:text-gray-300 ml-4">
              <li><strong>Klein</strong> - Minder dan 100 keuringen</li>
              <li><strong>Middel</strong> - 100 tot 1.000 keuringen</li>
              <li><strong>Groot</strong> - Meer dan 1.000 keuringen</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Statistieken gebaseerd op een grote steekproef zijn betrouwbaarder.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Datafilters
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Alleen personenautos (voertuigsoort: Personenauto) worden meegenomen in de analyse.
              Vrachtwagens, motorfietsen en andere voertuigtypen zijn uitgesloten.
            </p>
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Beperkingen
        </h2>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li>
              <strong>Correlatie is geen causaliteit:</strong> Een hoog gebrekenpercentage kan
              wijzen op mindere bouwkwaliteit, maar ook op slecht onderhoud door eigenaren of
              intensiever gebruik.
            </li>
            <li>
              <strong>Leeftijdseffect:</strong> Oudere autos hebben vaker gebreken. De statistieken
              worden niet gecorrigeerd voor leeftijd.
            </li>
            <li>
              <strong>Modeljaren:</strong> Verschillende bouwjaren van hetzelfde model kunnen sterk
              verschillende betrouwbaarheid hebben.
            </li>
            <li>
              <strong>Selectiebias:</strong> Bepaalde merken worden vaker gekocht door mensen die
              hun auto beter onderhouden.
            </li>
            <li>
              <strong>Historische data:</strong> De statistieken zijn gebaseerd op alle beschikbare
              keuringsgegevens en weerspiegelen niet noodzakelijk de huidige situatie.
            </li>
          </ul>
        </div>
      </section>

      {/* Update Frequency */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Updatefrequentie
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          De statistieken worden wekelijks bijgewerkt op basis van de nieuwste gegevens van
          RDW Open Data. De datum en tijd van de laatste update wordt weergegeven bij de tabellen.
        </p>
      </section>

      {/* License & Attribution */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Licentie en Bronvermelding
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          De gebruikte data van RDW Open Data is beschikbaar onder de{" "}
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/deed.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            CC0 1.0 Universeel (Public Domain)
          </a>{" "}
          licentie.
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          Deze website is niet gelieerd aan, gesponsord door, of goedgekeurd door de
          Rijksdienst voor het Wegverkeer (RDW).
        </p>
      </section>

      {/* Technical Details */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Technische Details
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Dit project is open source. De broncode en documentatie zijn beschikbaar op GitHub.
        </p>
        <dl className="space-y-2 text-gray-600 dark:text-gray-300">
          <div className="flex gap-2">
            <dt className="font-medium">Frontend:</dt>
            <dd>Next.js, TypeScript, Tailwind CSS</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Data verwerking:</dt>
            <dd>Python</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Hosting:</dt>
            <dd>GitHub Pages</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">CI/CD:</dt>
            <dd>GitHub Actions</dd>
          </div>
        </dl>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Contact
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Voor vragen, suggesties of bugmeldingen kunt u een issue aanmaken op de{" "}
          <a
            href="https://github.com/jjgroenendijk/cars-reliability"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            GitHub repository
          </a>
          .
        </p>
      </section>
    </div>
  );
}
