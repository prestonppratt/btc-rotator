import React, { createContext, useContext, useState, useEffect } from 'react';

type Denomination = 'BTC' | 'Sats';

interface DenominationContextType {
    denomination: Denomination;
    toggleDenomination: () => void;
    setDenomination: (denom: Denomination) => void;
}

const DenominationContext = createContext<DenominationContextType | undefined>(undefined);

export function DenominationProvider({ children }: { children: React.ReactNode }) {
    const [denomination, setDenominationState] = useState<Denomination>('BTC');

    useEffect(() => {
        const saved = localStorage.getItem('denomination') as Denomination;
        if (saved === 'BTC' || saved === 'Sats') {
            setDenominationState(saved);
        }
    }, []);

    const setDenomination = (denom: Denomination) => {
        setDenominationState(denom);
        localStorage.setItem('denomination', denom);
    };

    const toggleDenomination = () => {
        const newDenom = denomination === 'BTC' ? 'Sats' : 'BTC';
        setDenomination(newDenom);
    };

    return (
        <DenominationContext.Provider value={{ denomination, toggleDenomination, setDenomination }}>
            {children}
        </DenominationContext.Provider>
    );
}

export function useDenomination() {
    const context = useContext(DenominationContext);
    if (context === undefined) {
        throw new Error('useDenomination must be used within a DenominationProvider');
    }
    return context;
}
