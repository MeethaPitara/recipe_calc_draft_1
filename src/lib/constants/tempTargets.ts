
export type ServingContext = 'home_freezer' | 'gelateria';

export const SERVING_CONTEXT: Record<ServingContext, {
    label: string;
    referenceTemp: number;        // °C — the "real world" temp to evaluate against
    frozenZone_green: [number, number];   // ideal frozen water %
    frozenZone_amber_soft: [number, number];
    frozenZone_amber_firm: [number, number];
    frozenZone_red_soft: number;   // below this = red
    frozenZone_red_firm: number;   // above this = red
    targetFrozenMidpoint: number;  // for recommendServeTemp calculation
    serveTip: string;
}> = {
    home_freezer: {
        label: "Home Freezer (D2C / Zomato)",
        referenceTemp: -18,
        frozenZone_green: [60, 75],
        frozenZone_amber_soft: [50, 60],
        frozenZone_amber_firm: [75, 82],
        frozenZone_red_soft: 50,
        frozenZone_red_firm: 82,
        targetFrozenMidpoint: 67,
        serveTip: "Let product sit at room temp for 3–5 minutes before serving for best texture.",
    },
    gelateria: {
        label: "Gelateria Display (Pozzetti / Vetrina)",
        referenceTemp: -12,
        frozenZone_green: [55, 70],
        frozenZone_amber_soft: [45, 55],
        frozenZone_amber_firm: [70, 78],
        frozenZone_red_soft: 45,
        frozenZone_red_firm: 78,
        targetFrozenMidpoint: 62,
        serveTip: "Maintain display at -11°C to -13°C. Spatula-work every 15 min to maintain texture.",
    },
};

export const FPDT_TARGETS: Record<ServingContext, Record<string, { min: number; max: number }>> = {
    home_freezer: {
        nuts: { min: 3.2, max: 4.5 },
        dairy: { min: 3.4, max: 4.8 },
        sugary_pastes: { min: 3.6, max: 5.0 },
        sugary_fatty_pastes: { min: 3.4, max: 4.8 },
        fruit: { min: 3.8, max: 5.2 },
        chocolate: { min: 3.4, max: 4.8 },
        sorbet: { min: 4.0, max: 5.5 },
    },
    gelateria: {
        nuts: { min: 2.3, max: 3.6 },
        dairy: { min: 2.5, max: 3.8 },
        sugary_pastes: { min: 2.7, max: 4.0 },
        sugary_fatty_pastes: { min: 2.5, max: 3.8 },
        fruit: { min: 2.8, max: 4.2 },
        chocolate: { min: 2.5, max: 3.8 },
        sorbet: { min: 3.0, max: 4.5 },
    },
};

export const TEMP_ZONES: Record<ServingContext, Array<{
    label: string;
    range: [number, number];
    color: string;
    description: string;
}>> = {
    home_freezer: [
        { label: "Blast Hardening", range: [-40, -35], color: "#1e3a5f", description: "Rapid freeze to -18°C core" },
        { label: "Cold Storage", range: [-28, -20], color: "#2d5986", description: "Ideal long-term storage" },
        { label: "Home Freezer", range: [-20, -15], color: "#4a90d9", description: "Indian home freezer range" },
        { label: "Tempering", range: [-10, -5], color: "#ff9800", description: "Room-temp rest before serving" },
    ],
    gelateria: [
        { label: "Blast Hardening", range: [-40, -35], color: "#1e3a5f", description: "Rapid freeze to -18°C core" },
        { label: "Cold Storage", range: [-28, -20], color: "#2d5986", description: "Back-of-house storage" },
        { label: "Pre-Display Temper", range: [-16, -14], color: "#4a90d9", description: "Move from storage to display" },
        { label: "Display Case", range: [-14, -10], color: "#4caf50", description: "Pozzetti / vetrina serve temp" },
        { label: "Counter / Ambient", range: [-8, -5], color: "#ff9800", description: "Too warm — product losing shape" },
    ],
};

export const AFP_TARGETS: Record<string, { min: number; max: number }> = {
    nuts: { min: 22, max: 26 },
    dairy: { min: 23, max: 27 },
    sugary_pastes: { min: 24, max: 28 },
    sugary_fatty_pastes: { min: 23, max: 27 },
    fruit: { min: 25, max: 29 },
    chocolate: { min: 23, max: 27 },
    sorbet: { min: 28, max: 33 },
};
