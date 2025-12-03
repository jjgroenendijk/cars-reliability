"use client";

import type { RdwVehicle } from "@/app/lib/types";

interface VehicleInfoCardProps {
  vehicle: RdwVehicle;
}

function date_format(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}-${month}-${year}`;
}

interface InfoRowProps {
  label: string;
  value: string | undefined;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div>
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-white font-medium">
        {value ?? "-"}
      </dd>
    </div>
  );
}

export function VehicleInfoCard({ vehicle }: VehicleInfoCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {vehicle.merk} {vehicle.handelsbenaming}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-mono">
          {vehicle.kenteken}
        </p>
      </div>

      <div className="p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="First registration" value={date_format(vehicle.datum_eerste_toelating)} />
          <InfoRow label="Registration date" value={date_format(vehicle.datum_tenaamstelling)} />
          <InfoRow label="APK expiry date" value={date_format(vehicle.vervaldatum_apk)} />
          <InfoRow label="Color" value={vehicle.eerste_kleur} />
          <InfoRow label="Number of doors" value={vehicle.aantal_deuren} />
          <InfoRow label="Number of seats" value={vehicle.aantal_zitplaatsen} />
          <InfoRow
            label="Engine capacity"
            value={vehicle.cilinderinhoud ? `${vehicle.cilinderinhoud} cc` : undefined}
          />
          <InfoRow
            label="Empty mass"
            value={vehicle.massa_ledig_voertuig ? `${vehicle.massa_ledig_voertuig} kg` : undefined}
          />
          <InfoRow label="Insured" value={vehicle.wam_verzekerd === "Ja" ? "Yes" : "No"} />
          <InfoRow
            label="Catalog price"
            value={
              vehicle.catalogusprijs
                ? `EUR ${parseInt(vehicle.catalogusprijs).toLocaleString("nl-NL")}`
                : undefined
            }
          />
        </dl>
      </div>
    </div>
  );
}
