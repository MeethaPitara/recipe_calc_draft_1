
import { getTargets, TARGET_PRESETS } from '../components/TargetPresets';

function testTargets() {
    console.log("Testing Target Presets...");

    const gelato = getTargets('gelato');
    if (gelato.fat[0] === 3 && gelato.fat[1] === 7) {
        console.log("✅ Gelato defaults correct");
    } else {
        console.error("❌ Gelato defaults incorrect", gelato);
    }

    const sorbet = getTargets('sorbet');
    if (sorbet.fat[0] === 0 && sorbet.sugar[0] === 26) {
        console.log("✅ Sorbet defaults correct");
    } else {
        console.error("❌ Sorbet defaults incorrect", sorbet);
    }

    const unknown = getTargets('unknown_type');
    if (unknown.fat[0] === 3 && unknown.fat[1] === 7) {
        console.log("✅ Fallback to Gelato correct");
    } else {
        console.error("❌ Fallback incorrect", unknown);
    }
}

testTargets();
