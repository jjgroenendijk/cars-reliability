import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - Methodology and Data",
  description:
    "Information about the methodology and data sources of the Dutch Car Reliability Analysis.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        About this project
      </h1>

      {/* Introduction */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          What is Dutch Car Reliability?
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Dutch Car Reliability is an independent project that analyzes the reliability of
          car brands and models in the Netherlands based on public APK inspection data.
          The goal is to help consumers make informed choices when purchasing a car.
        </p>
      </section>

      {/* Data Sources */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Data Sources
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          All data comes from{" "}
          <a
            href="https://opendata.rdw.nl/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            RDW Open Data
          </a>
          , the official open data portal of the Netherlands Vehicle Authority.
          The following datasets are used:
        </p>

        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300 ml-4">
          <li>
            <strong>Gekentekende Voertuigen</strong> - Basic information about registered vehicles
          </li>
          <li>
            <strong>Meldingen Keuringsinstantie</strong> - APK inspection results
          </li>
          <li>
            <strong>Geconstateerde Gebreken</strong> - Defects found during APK inspections
          </li>
          <li>
            <strong>Gebreken</strong> - Descriptions of defect types
          </li>
          <li>
            <strong>Brandstof</strong> - Fuel data for vehicles
          </li>
        </ul>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Methodology
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Reliability Score
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              The reliability score is based on the average number of defects per inspection.
              A lower number indicates higher reliability.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Average Defects per Inspection
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              This number indicates how many defects are found on average per APK inspection.
              A lower number points to better build quality or maintenance.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sample Size
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              The reliability of the statistics depends on the number of inspections.
              Models are categorized as:
            </p>
            <ul className="list-disc list-inside mt-2 text-gray-600 dark:text-gray-300 ml-4">
              <li><strong>Small</strong> - Less than 100 inspections</li>
              <li><strong>Medium</strong> - 100 to 1,000 inspections</li>
              <li><strong>Large</strong> - More than 1,000 inspections</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Statistics based on a large sample are more reliable.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Data Filters
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Only passenger cars (voertuigsoort: Personenauto) are included in the analysis.
              Trucks, motorcycles, and other vehicle types are excluded.
            </p>
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Limitations
        </h2>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li>
              <strong>Correlation is not causation:</strong> A high defect rate may indicate
              poor build quality, but could also reflect poor maintenance by owners or
              more intensive use.
            </li>
            <li>
              <strong>Age effect:</strong> Older cars have more defects. The statistics
              are not adjusted for age.
            </li>
            <li>
              <strong>Model years:</strong> Different build years of the same model can have
              vastly different reliability.
            </li>
            <li>
              <strong>Selection bias:</strong> Certain brands are more often bought by people
              who maintain their cars better.
            </li>
            <li>
              <strong>Historical data:</strong> The statistics are based on all available
              inspection data and do not necessarily reflect the current situation.
            </li>
          </ul>
        </div>
      </section>

      {/* Update Frequency */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Update Frequency
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          The statistics are updated weekly based on the latest data from RDW Open Data.
          The date and time of the last update is displayed with the tables.
        </p>
      </section>

      {/* License & Attribution */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          License and Attribution
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          The RDW Open Data used is available under the{" "}
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/deed.en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            CC0 1.0 Universal (Public Domain)
          </a>{" "}
          license.
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          This website is not affiliated with, sponsored by, or endorsed by the
          Netherlands Vehicle Authority (RDW).
        </p>
      </section>

      {/* Technical Details */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Technical Details
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          This project is open source. The source code and documentation are available on GitHub.
        </p>
        <dl className="space-y-2 text-gray-600 dark:text-gray-300">
          <div className="flex gap-2">
            <dt className="font-medium">Frontend:</dt>
            <dd>Next.js, TypeScript, Tailwind CSS</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Data Processing:</dt>
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
          For questions, suggestions, or bug reports, please open an issue on the{" "}
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
