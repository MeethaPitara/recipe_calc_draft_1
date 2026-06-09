import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
const PdfPrinter = require('pdfmake/js/printer.js').default;
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

const router = Router();
router.use(requireAuth as any);

// Initialize pdfmake with standard fonts
const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};
const printer = new PdfPrinter(fonts);

async function logExport(userId: string, exportType: string, entityId: string) {
    await supabase.from('exports_log').insert({
        user_id: userId,
        export_type: exportType,
        entity_id: entityId
    });
}

// ── GET /manufacturer/:recipeId ──
router.get('/manufacturer/:recipeId', async (req, res) => {
    try {
        const recipeId = req.params.recipeId;

        // Fetch recipe, rows, and metrics
        const { data: recipe, error: recipeError } = await supabase.from('recipes').select('*').eq('id', recipeId).single();
        if (recipeError || !recipe) return res.status(404).json({ error: 'Recipe not found' });

        const { data: rows } = await supabase.from('recipe_rows').select('*').eq('recipe_id', recipeId);
        const { data: metrics } = await supabase.from('calculated_metrics').select('*').eq('recipe_id', recipeId).single();

        await logExport(req.user!.id, 'manufacturer', recipeId);

        const tableBody: any[][] = [
            [{ text: 'Ingredient', style: 'tableHeader' }, { text: 'Quantity (g)', style: 'tableHeader' }, { text: 'Tolerance (±g)', style: 'tableHeader' }]
        ];

        let totalQty = 0;
        if (rows) {
            for (const r of rows) {
                if (r.quantity_g > 0) {
                    tableBody.push([r.ingredient, r.quantity_g.toString(), (r.tolerance_grams || 0).toString()]);
                    totalQty += r.quantity_g;
                }
            }
        }
        tableBody.push([{ text: 'Total Batch', bold: true }, { text: totalQty.toString(), bold: true }, { text: '-', bold: true }] as any[]);

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: { font: 'Helvetica' },
            content: [
                { text: 'Manufacturer Instruction Sheet', style: 'header' },
                { text: `Recipe: ${recipe.recipe_name}`, style: 'subheader' },
                { text: `Product Type: ${recipe.product_type} | Version: ${recipe.version_number || 1}`, margin: [0, 0, 0, 10] },

                { text: 'Ingredients List', style: 'sectionHeader' },
                {
                    table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: tableBody },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 15]
                },

                { text: 'Science Metrics & Targets', style: 'sectionHeader' },
                {
                    ul: [
                        `Fat Target: ${metrics?.fat_pct?.toFixed(1) || '-'} %`,
                        `MSNF Target: ${metrics?.msnf_pct?.toFixed(1) || '-'} %`,
                        `Total Sugars Target: ${metrics?.sugars_pct?.toFixed(1) || '-'} %`,
                        `Total Solids Target: ${metrics?.total_solids_pct?.toFixed(1) || '-'} %`,
                        `Hardness (FPDT) Target: ${metrics?.fpdt?.toFixed(1) || '-'} °C`
                    ],
                    margin: [0, 0, 0, 15]
                },

                { text: 'Production Notes', style: 'sectionHeader' },
                { text: `Equipment Notes:\n${recipe.equipment_notes || 'None specified.'}`, margin: [0, 0, 0, 10] },
                { text: `Storage Conditions:\n${recipe.storage_conditions || 'None specified.'}`, margin: [0, 0, 0, 10] }
            ],
            styles: {
                header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
                subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
                sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5], color: '#333' },
                tableHeader: { bold: true, fillColor: '#eeeeee' }
            }
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${recipe.recipe_name}-manufacturer.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /trial/:trialId ──
router.get('/trial/:trialId', async (req, res) => {
    try {
        const trialId = req.params.trialId;

        const { data: trial, error: trialError } = await supabase.from('trial_records').select('*, recipes(*)').eq('id', trialId).single();
        if (trialError || !trial) return res.status(404).json({ error: 'Trial not found' });

        const { data: qaRecords } = await supabase.from('qa_records').select('*').eq('trial_id', trialId);

        await logExport(req.user!.id, 'trial', trialId);

        const tableBody = [
            [{ text: 'Metric', style: 'tableHeader' }, { text: 'Target', style: 'tableHeader' }, { text: 'Actual', style: 'tableHeader' }, { text: 'Result', style: 'tableHeader' }]
        ];

        if (qaRecords) {
            for (const qa of qaRecords) {
                tableBody.push([
                    qa.metric_name,
                    qa.target_value?.toString() || '-',
                    qa.actual_value?.toString() || '-',
                    qa.pass_fail ? 'PASS' : 'FAIL'
                ]);
            }
        }

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: { font: 'Helvetica' },
            content: [
                { text: 'Production Trial Report', style: 'header' },
                { text: `Recipe: ${trial.recipes?.recipe_name || 'Unknown'}`, style: 'subheader' },
                { text: `Trial Date: ${trial.trial_date} | Batch Size: ${trial.batch_size_g}g`, margin: [0, 0, 0, 10] },
                { text: `Outcome: ${trial.outcome.toUpperCase()}`, bold: true, margin: [0, 0, 0, 15] },

                { text: 'Pre/Post QA Metrics', style: 'sectionHeader' },
                {
                    table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto'], body: tableBody },
                    layout: 'lightHorizontalLines',
                    margin: [0, 0, 0, 15]
                },

                { text: 'Operator Notes', style: 'sectionHeader' },
                { text: trial.notes || 'No notes provided.', margin: [0, 0, 0, 10] }
            ],
            styles: {
                header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
                subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
                sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5], color: '#333' },
                tableHeader: { bold: true, fillColor: '#eeeeee' }
            }
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Trial-${trialId}.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /investor/:recipeId ──
router.get('/investor/:recipeId', async (req, res) => {
    try {
        if (req.user?.role !== 'investor') {
            return res.status(403).json({ error: 'Access denied. Investor role required.' });
        }

        const recipeId = req.params.recipeId;

        const { data: recipe, error: recipeError } = await supabase.from('recipes').select('*').eq('id', recipeId).single();
        if (recipeError || !recipe) return res.status(404).json({ error: 'Recipe not found' });

        await logExport(req.user!.id, 'investor', recipeId);

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: { font: 'Helvetica' },
            content: [
                { text: 'Product Concept Brief', style: 'header' },
                { text: `Recipe Name: ${recipe.recipe_name}`, style: 'subheader' },
                { text: `Category: ${recipe.product_type}`, margin: [0, 0, 0, 10] },

                { text: 'Overview', style: 'sectionHeader' },
                { text: 'This is a high-level overview of the product concept and its economic feasibility.', margin: [0, 0, 0, 15] },

                { text: 'Economic Summary', style: 'sectionHeader' },
                {
                    ul: [
                        `Estimated Cost per KG: ₹${recipe.cost_per_kg?.toFixed(2) || 'N/A'}`
                    ],
                    margin: [0, 0, 0, 15]
                },

                { text: 'Note: Detailed formula and supplier information is restricted in this brief.', italics: true, color: 'gray' }
            ],
            styles: {
                header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
                subheader: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
                sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5], color: '#333' }
            }
        };

        const pdfDoc = await printer.createPdfKitDocument(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${recipe.recipe_name}-concept.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as exportsRouter };
