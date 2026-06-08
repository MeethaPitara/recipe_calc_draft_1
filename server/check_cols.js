import 'dotenv/config';

async function checkCols() {
    const url = process.env.SUPABASE_URL + '/rest/v1/recipes?limit=1';
    const res = await fetch(url, {
        headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
    });
    const data = await res.json();
    if (data.error) {
        console.error("Error fetching recipes:", data.error);
    } else if (data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        console.log("No data, but request succeeded.");
    }

    const crUrl = process.env.SUPABASE_URL + '/rest/v1/cost_records?limit=1';
    const crRes = await fetch(crUrl, {
        headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
    });
    const crData = await crRes.json();
    if (crData.error) {
        console.error("Error fetching cost_records:", crData);
    } else {
        console.log("cost_records exists!");
    }
}
checkCols();
