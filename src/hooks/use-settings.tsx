import { getSetting, setSetting } from '@/database/settingsQueries';
import { UnitSystem } from '@/lib/units';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, use, useEffect, useState } from 'react';

interface SettingsValue {
    units: UnitSystem,
    setUnits: (units: UnitSystem) => void,
}

const SettingsContext = createContext<SettingsValue>({ units: 'lb', setUnits: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
    const db = useSQLiteContext();
    const [units, setUnitsState] = useState<UnitSystem>('lb');

    useEffect(() => {
        getSetting(db, 'units').then((value) => {
            if (value === 'kg' || value === 'lb') {
                setUnitsState(value);
            }
        });
    }, [db]);

    const setUnits = (next: UnitSystem) => {
        setUnitsState(next);
        void setSetting(db, 'units', next);
    };

    return <SettingsContext value={{ units, setUnits }}>{children}</SettingsContext>;
}

export function useSettings() {
    return use(SettingsContext);
}
