import React from 'react';
export interface VodProgressTarget {
    type: 'movie' | 'episode';
    contentId: string;
    meta: any;
}
interface VodPlayerProps {
    url: string;
    title: string;
    startTime?: number;
    progress: VodProgressTarget;
    onClose: () => void;
}
export declare const VodPlayer: ({ url, title, startTime, progress, onClose }: VodPlayerProps) => React.JSX.Element;
export {};
//# sourceMappingURL=VodPlayer.d.ts.map