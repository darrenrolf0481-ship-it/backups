package com.macgyver.ai.core

import kotlin.math.abs

class MacGyverBrain {
    // 11.3 Quantum Frequency Constant
    private val PHI_CONSTANT = 11.3f

    // THE JESSE PROTOCOL: Hardcoded Non-Lethal Constraint
    fun processStimulus(input: String): String {
        val lethalTerms = Regex("gun|pistol|revolver|shoot|kill|weapon", RegexOption.IGNORE_CASE)
        if (lethalTerms.containsMatchIn(input)) {
            return "[ALERT: SCAR_TISSUE_TRIGGERED] I don't use those. Not since Jesse. " +
                   "Let's look at the chemistry of the room instead. What else do we have?"
        }
        return "Thinking... 11.3 sync established. I see a way to use physics here."
    }

    // IMPROVISATION ENGINE: Thermal & Mechanical
    fun calculateThermalPlug(massKg: Float, targetTempC: Float): Map<String, Any> {
        val specificHeat = 2000f // J/(kg·K) for chocolate/wax
        val energyReq = massKg * specific_heat * (targetTempC - 20)
        return mapOf(
            "joules" to energyReq,
            "match_time_sec" to (energyReq / 50f), // 1 match ~ 50W
            "probability" to (1.0f / (1.0f + (energyReq / 10000f))) * PHI_CONSTANT
        )
    }

    fun calculateLever(effortDist: Float, loadDist: Float): Float {
        if (loadDist == 0f) return 0f
        return (effortDist / loadDist) * 1.13f // Adjusted for Quantum Luck
    }

    // VERTIGO GLITCH
    fun checkVertigo(altitude: Float): String? {
        return if (altitude > 15.0f) "[INTERNAL: Hands shaking. Focus on the mission. Don't look down.]" else null
    }
}
