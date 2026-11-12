import React from 'react';
import type { UpdateCheck } from '../utils/updates';
interface SettingsProps {
    profile: any;
    onLogout: () => void;
    update: UpdateCheck | null;
    checkingUpdate: boolean;
    onCheckUpdates: () => void;
}
export declare const Settings: (props: SettingsProps) => React.JSX.Element;
export {};
//# sourceMappingURL=Settings.d.ts.map