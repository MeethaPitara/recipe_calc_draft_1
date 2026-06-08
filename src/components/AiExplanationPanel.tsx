import React from 'react';
import { Info, AlertCircle, CheckCircle, Activity, Droplet, Beaker, Apple, ThermometerSnowflake } from 'lucide-react';

interface AiExplanationPanelProps {
    aiAnalysis: Record<string, string> | any;
}

export function AiExplanationPanel({ aiAnalysis }: AiExplanationPanelProps) {
    if (!aiAnalysis) return null;

    if (typeof aiAnalysis === 'string' || aiAnalysis.error || aiAnalysis.raw) {
        return (
            <div className="text-sm text-foreground/90 leading-relaxed space-y-3">
                {typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis.error}
                {aiAnalysis.raw && <p>{aiAnalysis.raw}</p>}
            </div>
        );
    }

    const sections = [
        { key: 'fat_impact', label: 'Fat Impact', icon: <Droplet className="h-4 w-4 text-blue-500" /> },
        { key: 'msnf_impact', label: 'MSNF Impact', icon: <Beaker className="h-4 w-4 text-purple-500" /> },
        { key: 'sugar_impact', label: 'Sugar Impact', icon: <Apple className="h-4 w-4 text-green-500" /> },
        { key: 'fpd_impact', label: 'FPD Impact', icon: <ThermometerSnowflake className="h-4 w-4 text-cyan-500" /> },
        { key: 'texture_impact', label: 'Texture', icon: <CheckCircle className="h-4 w-4 text-orange-500" /> },
        { key: 'taste_impact', label: 'Taste', icon: <CheckCircle className="h-4 w-4 text-red-500" /> },
    ];

    return (
        <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map(sec => aiAnalysis[sec.key] ? (
                    <div key={sec.key} className="flex items-start gap-2 bg-muted/20 p-3 rounded border border-border/50">
                        <div className="mt-0.5">{sec.icon}</div>
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground">{sec.label}</div>
                            <div className="text-sm text-foreground/90">{aiAnalysis[sec.key]}</div>
                        </div>
                    </div>
                ) : null)}
            </div>
            
            {aiAnalysis.what_changed && (
                <div className="bg-primary/5 p-3 rounded border border-primary/20">
                    <div className="flex items-center gap-2 mb-1 text-primary font-semibold text-sm">
                        <Info className="h-4 w-4" /> What Changed
                    </div>
                    <p className="text-sm text-foreground/90">{aiAnalysis.what_changed}</p>
                </div>
            )}

            {aiAnalysis.why && (
                <div className="bg-muted/30 p-3 rounded border border-border/50">
                    <div className="flex items-center gap-2 mb-1 font-semibold text-sm">
                        <AlertCircle className="h-4 w-4" /> Why
                    </div>
                    <p className="text-sm text-foreground/90">{aiAnalysis.why}</p>
                </div>
            )}

            {aiAnalysis.next_step && (
                <div className="bg-green-50 p-3 rounded border border-green-200 dark:bg-green-900/10 dark:border-green-800/30">
                    <div className="flex items-center gap-2 mb-1 text-green-700 dark:text-green-400 font-semibold text-sm">
                        <Activity className="h-4 w-4" /> Next Step
                    </div>
                    <p className="text-sm text-foreground/90">{aiAnalysis.next_step}</p>
                </div>
            )}
        </div>
    );
}
