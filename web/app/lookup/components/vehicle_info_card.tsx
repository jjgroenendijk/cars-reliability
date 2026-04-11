"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageContext";
import { Info, AlertCircle, CheckCircle } from "lucide-react";
import type { RdwVehicle } from "@/app/lib/types";

interface VehicleInfoCardProps {
  vehicle: RdwVehicle;
}

export function VehicleInfoCard({ vehicle }: VehicleInfoCardProps) {
  const { t } = useLanguage();

  const apkStatus = () => {
    if (!vehicle.vervaldatum_apk) return { text: t('lookup.status_unknown'), icon: AlertCircle, color: "text-gray-500" };

    // Parse RDW date format YYYYMMDD
    const dateStr = vehicle.vervaldatum_apk.toString();
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));

    const expiryDate = new Date(year, month, day);
    const now = new Date();

    const isValid = expiryDate > now;

    return {
      text: isValid ? t('lookup.status_valid') : t('lookup.status_expired'),
      icon: isValid ? CheckCircle : AlertCircle,
      color: isValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    };
  };

  const status = apkStatus();
  const StatusIcon = status.icon;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('lookup.vehicle_info')}
        </h2>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
        <div className="space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('lookup.brand')}</p>
          <p className="font-medium text-gray-900 dark:text-white">{vehicle.merk || "-"}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('lookup.model')}</p>
          <p className="font-medium text-gray-900 dark:text-white">{vehicle.handelsbenaming || "-"}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('lookup.year')}</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {vehicle.datum_eerste_toelating ? vehicle.datum_eerste_toelating.toString().substring(0, 4) : "-"}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('lookup.status')}</p>
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
            <p className={`font-medium ${status.color}`}>
              {status.text}
              {vehicle.vervaldatum_apk && ` (tot ${formatDate(vehicle.vervaldatum_apk.toString())})`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}-${month}-${year}`;
}
