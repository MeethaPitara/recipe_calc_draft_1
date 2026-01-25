
import { getTargets, TARGET_PRESETS } from '../components/TargetPresets';

function testTargets() {
    console.log("Testing Target Presets...");

    const gelato = getTargets('gelato');
    if (gelato.fat === 8.0 && gelato.tolerance === 2.0) {
        console.log("✅ Gelato defaults correct");
    } else {
        console.error("❌ Gelato defaults incorrect", gelato);
    }

    const sorbet = getTargets('sorbet');
    if (sorbet.fat === 0.0 && sorbet.sugar === 28.0) {
        console.log("✅ Sorbet defaults correct");
    } else {
        console.error("❌ Sorbet defaults incorrect", sorbet);
    }

    const unknown = getTargets('unknown_type');
    if (unknown.fat === 8.0) {
        console.log("✅ Fallback to Gelato correct");
    } else {
        console.error("❌ Fallback incorrect", unknown);
    }
}

testTargets();
