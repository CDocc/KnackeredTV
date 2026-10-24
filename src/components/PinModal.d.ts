import React from 'react';
interface PinModalProps {
    title?: string;
    onSubmit: (pin: string) => Promise<string | null>;
    onCancel: () => void;
}
export declare const PinModal: ({ title, onSubmit, onCancel }: PinModalProps) => React.JSX.Element;
export {};
//# sourceMappingURL=PinModal.d.ts.map