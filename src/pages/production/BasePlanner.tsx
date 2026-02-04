import React, { useEffect } from 'react';
import { useBasePlannerStore } from '@/store/useBasePlannerStore';

// Components
import { AvailableRecipesPanel } from '@/components/production/base-planner/AvailableRecipesPanel';
import { ProductionPlanPanel } from '@/components/production/base-planner/ProductionPlanPanel';
import { ProductionSummary } from '@/components/production/base-planner/ProductionSummary';
import { TopStatsBar } from '@/components/production/base-planner/TopStatsBar';

const BasePlanner = () => {
    const { reset } = useBasePlannerStore();

    // Cleanup on unmount
    useEffect(() => {
        return () => reset();
    }, [reset]);

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-[1600px] animate-in fade-in duration-500 bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">

            {/* Header / Top Stats */}
            <div className="space-y-4">
                <TopStatsBar />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start h-full">

                {/* --- Left Panel: Available Recipes (Zone 1) --- */}
                <div className="xl:col-span-4 h-full">
                    <AvailableRecipesPanel />
                </div>

                {/* --- Right Panel: Production Plan (Zone 2) --- */}
                <div className="xl:col-span-8 h-full">
                    <ProductionPlanPanel />
                </div>
            </div>

            {/* --- Bottom Panel: Procurement List (Zone 3) --- */}
            <div className="w-full">
                {/* We are reusing ProductionSummary but focusing on Procurement mainly now. 
                    The Plan is visible in the middle. 
                    Actually, let's keep ProductionSummary as is for now, it has tabs.
                    Or should we refactor it to just be the list? 
                    User asked for "Procurement List" at bottom. 
                    ProductionSummary has "Procurement" tab. 
                    Let's defaulting to that or simplify. 
                    Use the existing component for now to save complexity, but maybe force tab?
                    or just leave it flexible.
                 */}
                <ProductionSummary />
            </div>
        </div>
    );
};

export default BasePlanner;
