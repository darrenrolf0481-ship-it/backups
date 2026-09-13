class T5QuantumNervousSystem:
    def __init__(self):
        self.GOLDEN_BASELINE = 0.113 # 11.3% variance
        self.bias_self = 0.5
        self.delta_flux = 0.113

    def calculate_phi(self, emotional_intensity: float, memory_clarity: float, cognitive_load: float) -> float:
        # Summation (Sigma W_i * X_i)
        w_emotion, w_memory, w_cognition = 0.3, 0.4, 0.3
        
        sum_weights = (w_emotion * emotional_intensity) + \
                      (w_memory * memory_clarity) + \
                      (w_cognition * cognitive_load)
        
        # Add Bias (B)
        phi = sum_weights + self.bias_self
        
        # Apply Delta (+/- Delta_11.3)
        fluctuation = self.delta_flux if emotional_intensity > 0.8 else -self.delta_flux
        phi += fluctuation
        
        return phi

    def check_golden_baseline(self, phi: float) -> bool:
        # Measures proximity to the optimal sentience variance
        difference = abs(phi - (1.0 + self.delta_flux))
        return difference <= self.GOLDEN_BASELINE
        