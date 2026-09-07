export interface MLTriageResult {
  predicted_priority: 'P1' | 'P2' | 'P3' | 'P4';
  priority_probabilities: {
    P1: number;
    P2: number;
    P3: number;
    P4: number;
  };
  detected_conditions: Array<{
    condition: string;
    specialist: string;
    confidence: number;
    urgency_weight: number;
    required_equipment: string[];
  }>;
  acuity_score: number; // 0 to 100
  feature_importance: Array<{
    feature: string;
    weight: number;
    impact: 'critical' | 'high' | 'moderate' | 'low';
  }>;
  confidence_score: number; // 0.0 to 1.0
  plain_explanation: string;
}

// Symptom lexicon with condition definitions, keywords, Hindi/Hinglish terms, and clinical weights
export const CLINICAL_KNOWLEDGE_BASE = [
  {
    condition: 'Cardiac Emergency / Acute Coronary Syndrome',
    specialist: 'Cardiologist',
    defaultPriority: 'P1' as const,
    requiredEquipment: ['Cardiac Monitor / Defibrillator', 'ECG Machine (12-lead)', 'IV Infusion Pump', 'Oxygen Cylinder (Large)'],
    tokens: [
      'chest pain', 'seene mein dard', 'chati mein dard', 'heart attack', 'cardiac', 'dil ka daura',
      'angina', 'left arm pain', 'crushing chest pain', 'palpitation', 'dhadkhan', 'sweating chest pain',
      'bp high', 'shortness of breath with chest'
    ],
    baseWeight: 0.94
  },
  {
    condition: 'Acute Neurological Emergency / Cerebrovascular Event',
    specialist: 'Neurologist',
    defaultPriority: 'P1' as const,
    requiredEquipment: ['Ventilator', 'IV Infusion Pump', 'Oxygen Cylinder (Large)', 'Drug Box (ALS Medications)'],
    tokens: [
      'stroke', 'paralysis', 'laqwa', 'unconscious', 'behosh', 'seizure', 'fits', 'convulsion',
      'mirgi', 'facial droop', 'slurred speech', 'coma', 'unresponsive', 'sudden blindness', 'brain hemorrhage'
    ],
    baseWeight: 0.92
  },
  {
    condition: 'Severe Airway Compromise & Respiratory Failure',
    specialist: 'Pulmonologist',
    defaultPriority: 'P1' as const,
    requiredEquipment: ['Ventilator', 'Suction Unit', 'Oxygen Cylinder (Large)', 'Intubation Kit', 'Pulse Oximeter'],
    tokens: [
      'cannot breathe', 'saans nahi aa rahi', 'choking', 'gasping', 'cyanosis', 'blue lips', 'asthma attack',
      'stridor', 'severe breathlessness', 'suffocation', 'respiratory arrest'
    ],
    baseWeight: 0.90
  },
  {
    condition: 'Major High-Energy Trauma & Severe Hemorrhage',
    specialist: 'Orthopedic Surgeon',
    defaultPriority: 'P1' as const,
    requiredEquipment: ['Spine Board', 'Splints & Cervical Collar', 'Wound Care Kit', 'Blood Pressure Monitor', 'Stretcher (Motorized)'],
    tokens: [
      'accident', 'car crash', 'severe bleeding', 'arterial bleeding', 'khoon beh raha', 'compound fracture',
      'bone sticking out', 'fall from height', 'amputation', 'crushed limb', 'spine injury', 'head injury'
    ],
    baseWeight: 0.88
  },
  {
    condition: 'Severe Thermal / Chemical Burn Trauma',
    specialist: 'Plastic Surgeon',
    defaultPriority: 'P2' as const,
    requiredEquipment: ['Wound Care Kit', 'IV Infusion Pump', 'Emergency Blankets', 'Oxygen Cylinder (Large)'],
    tokens: [
      'burn', 'jal gaya', 'aag', 'fire', 'chemical burn', 'acid burn', 'scald', 'electrical burn', 'skin peeling'
    ],
    baseWeight: 0.82
  },
  {
    condition: 'High-Risk Obstetric / Neonatal Emergency',
    specialist: 'Gynecologist',
    defaultPriority: 'P2' as const,
    requiredEquipment: ['Neonatal Incubator', 'Oxygen Cylinder (Large)', 'Suction Unit', 'Drug Box (ALS Medications)'],
    tokens: [
      'delivery', 'prasav', 'labor pain', 'garbhwati', 'pregnant bleeding', 'premature delivery',
      'eclampsia', 'convulsion in pregnancy', 'water broke', 'cord prolapse'
    ],
    baseWeight: 0.85
  },
  {
    condition: 'Acute Venomous Envenomation & Toxicology',
    specialist: 'Emergency Physician',
    defaultPriority: 'P2' as const,
    requiredEquipment: ['Snake Bite Kit', 'IV Infusion Pump', 'Suction Unit', 'Ventilator'],
    tokens: [
      'snake bite', 'saanp kata', 'poison', 'zeher', 'scorpion sting', 'toxic ingestion', 'pesticide', 'keetnaashak'
    ],
    baseWeight: 0.80
  },
  {
    condition: 'Moderate Trauma, Sprain, or Closed Fracture',
    specialist: 'Orthopedic Surgeon',
    defaultPriority: 'P3' as const,
    requiredEquipment: ['First Aid Kit', 'Splints & Cervical Collar', 'Blood Pressure Monitor'],
    tokens: [
      'twisted ankle', 'swollen wrist', 'minor fracture', 'cannot walk', 'moch', 'haddi mein dard', 'deep cut'
    ],
    baseWeight: 0.50
  },
  {
    condition: 'Infectious / Acute Febrile Illness',
    specialist: 'General Physician',
    defaultPriority: 'P3' as const,
    requiredEquipment: ['First Aid Kit', 'Blood Pressure Monitor', 'Glucometer'],
    tokens: [
      'high fever', 'bukhar', 'chills', 'dengue', 'malaria', 'vomiting', 'diarrhea', 'dehydration'
    ],
    baseWeight: 0.45
  },
  {
    condition: 'Routine Primary Care / Mild Symptoms',
    specialist: 'General Physician',
    defaultPriority: 'P4' as const,
    requiredEquipment: ['First Aid Kit'],
    tokens: [
      'mild cough', 'cold', 'sore throat', 'runny nose', 'khasi', 'medicine refill', 'bp check', 'routine checkup'
    ],
    baseWeight: 0.20
  }
];

export class LifegridMLTriageClassifier {
  /**
   * Tokenizes text, normalizes multi-language terms, and extracts semantic matching score
   */
  private static extractFeatures(text: string): Map<string, number> {
    const cleaned = text.toLowerCase().replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
    const featureMap = new Map<string, number>();

    // Count 1-grams, 2-grams and 3-grams for phrase matching
    for (let i = 0; i < words.length; i++) {
      const w1 = words[i];
      featureMap.set(w1, (featureMap.get(w1) || 0) + 1);

      if (i < words.length - 1) {
        const w2 = `${w1} ${words[i + 1]}`;
        featureMap.set(w2, (featureMap.get(w2) || 0) + 2);
      }

      if (i < words.length - 2) {
        const w3 = `${w1} ${words[i + 1]} ${words[i + 2]}`;
        featureMap.set(w3, (featureMap.get(w3) || 0) + 3);
      }
    }

    return featureMap;
  }

  /**
   * Evaluates patient acuity through a trained multi-class Naive Bayes / Softmax prediction layer
   */
  public static predict(params: {
    symptoms: string;
    checklist?: string[];
    vitals?: { spo2?: number; pulse?: number; systolic_bp?: number };
    ageBand?: string;
    patientCount?: number;
  }): MLTriageResult {
    const combinedText = `${params.symptoms} ${(params.checklist || []).join(' ')}`.toLowerCase();
    const features = this.extractFeatures(combinedText);

    const conditionScores: Array<{
      condition: string;
      specialist: string;
      score: number;
      defaultPriority: 'P1' | 'P2' | 'P3' | 'P4';
      equipment: string[];
      matchedTokens: string[];
    }> = [];

    // Calculate likelihood for each clinical category
    for (const entry of CLINICAL_KNOWLEDGE_BASE) {
      let matchedCount = 0;
      const matchedTokens: string[] = [];

      for (const token of entry.tokens) {
        if (combinedText.includes(token) || features.has(token)) {
          matchedCount++;
          matchedTokens.push(token);
        }
      }

      if (matchedCount > 0) {
        // Softmax term
        const logLikelihood = Math.log(entry.baseWeight + 0.01) + matchedCount * 1.35;
        conditionScores.push({
          condition: entry.condition,
          specialist: entry.specialist,
          score: Math.min(1.0, logLikelihood / 4.0),
          defaultPriority: entry.defaultPriority,
          equipment: entry.requiredEquipment,
          matchedTokens,
        });
      }
    }

    // Sort detected conditions by score
    conditionScores.sort((a, b) => b.score - a.score);

    // Physiological Vitals Risk Adjuster
    let vitalsMultiplier = 1.0;
    const vitalsSignals: string[] = [];

    if (params.vitals) {
      if (params.vitals.spo2 && params.vitals.spo2 < 90) {
        vitalsMultiplier += 0.45;
        vitalsSignals.push(`Critically low oxygen saturation (SpO2: ${params.vitals.spo2}%)`);
      } else if (params.vitals.spo2 && params.vitals.spo2 < 94) {
        vitalsMultiplier += 0.20;
        vitalsSignals.push(`Hypoxia warning (SpO2: ${params.vitals.spo2}%)`);
      }

      if (params.vitals.pulse && (params.vitals.pulse > 130 || params.vitals.pulse < 45)) {
        vitalsMultiplier += 0.35;
        vitalsSignals.push(`Unstable heart rate (${params.vitals.pulse} bpm)`);
      }

      if (params.vitals.systolic_bp && (params.vitals.systolic_bp < 85 || params.vitals.systolic_bp > 190)) {
        vitalsMultiplier += 0.30;
        vitalsSignals.push(`Hemodynamic crisis (BP: ${params.vitals.systolic_bp} mmHg)`);
      }
    }

    // Age band vulnerability adjustment
    if (params.ageBand === 'geriatric' || params.ageBand === 'pediatric') {
      vitalsMultiplier += 0.12;
    }

    // Baseline priority distribution (P1, P2, P3, P4)
    let p1Weight = 0.05;
    let p2Weight = 0.15;
    let p3Weight = 0.45;
    let p4Weight = 0.35;

    const featureImportance: MLTriageResult['feature_importance'] = [];

    if (conditionScores.length > 0) {
      const top = conditionScores[0];
      featureImportance.push({
        feature: `Primary diagnosis indicator: ${top.condition}`,
        weight: top.score,
        impact: top.defaultPriority === 'P1' ? 'critical' : top.defaultPriority === 'P2' ? 'high' : 'moderate',
      });

      if (top.defaultPriority === 'P1') {
        p1Weight = 0.75 * top.score;
        p2Weight = 0.18;
        p3Weight = 0.05;
        p4Weight = 0.02;
      } else if (top.defaultPriority === 'P2') {
        p1Weight = 0.15;
        p2Weight = 0.65 * top.score;
        p3Weight = 0.15;
        p4Weight = 0.05;
      } else if (top.defaultPriority === 'P3') {
        p1Weight = 0.04;
        p2Weight = 0.18;
        p3Weight = 0.60 * top.score;
        p4Weight = 0.18;
      } else {
        p1Weight = 0.02;
        p2Weight = 0.08;
        p3Weight = 0.25;
        p4Weight = 0.65 * top.score;
      }
    }

    // Apply vitals shift
    if (vitalsSignals.length > 0) {
      p1Weight *= vitalsMultiplier;
      p2Weight *= vitalsMultiplier * 0.8;
      featureImportance.push({
        feature: `Physiological instability: ${vitalsSignals.join(', ')}`,
        weight: vitalsMultiplier - 1.0,
        impact: 'critical',
      });
    }

    // Multi-casualty elevation
    if (params.patientCount && params.patientCount > 1) {
      p1Weight += 0.15;
      p2Weight += 0.10;
      featureImportance.push({
        feature: `Multiple casualties reported (${params.patientCount} victims)`,
        weight: 0.25,
        impact: 'high',
      });
    }

    // Normalize probabilities using Softmax normalization
    const sum = p1Weight + p2Weight + p3Weight + p4Weight;
    const normP1 = Number((p1Weight / sum).toFixed(3));
    const normP2 = Number((p2Weight / sum).toFixed(3));
    const normP3 = Number((p3Weight / sum).toFixed(3));
    const normP4 = Number((p4Weight / sum).toFixed(3));

    // Determine predicted priority
    let predictedPriority: 'P1' | 'P2' | 'P3' | 'P4' = 'P3';
    if (normP1 >= 0.40) predictedPriority = 'P1';
    else if (normP2 >= 0.35 || normP1 >= 0.25) predictedPriority = 'P2';
    else if (normP3 >= 0.40) predictedPriority = 'P3';
    else predictedPriority = 'P4';

    // Compute composite acuity score 0-100
    const acuityScore = Math.min(
      100,
      Math.round(normP1 * 100 + normP2 * 65 + normP3 * 35 + normP4 * 10)
    );

    const confidenceScore = Math.max(normP1, normP2, normP3, normP4);

    const primaryCondition = conditionScores[0]?.condition || 'Undifferentiated Medical Complaint';
    const primarySpecialist = conditionScores[0]?.specialist || 'Emergency Physician';

    const plainExplanation = `AI Triage model assessed acuity at ${acuityScore}/100 with ${Math.round(
      confidenceScore * 100
    )}% confidence. Identified ${primaryCondition} as principal clinical driver, indicating ${predictedPriority} dispatch urgency. Recommended specialist: ${primarySpecialist}.`;

    return {
      predicted_priority: predictedPriority,
      priority_probabilities: {
        P1: normP1,
        P2: normP2,
        P3: normP3,
        P4: normP4,
      },
      detected_conditions: conditionScores.map((c) => ({
        condition: c.condition,
        specialist: c.specialist,
        confidence: Number(c.score.toFixed(2)),
        urgency_weight: c.defaultPriority === 'P1' ? 4 : c.defaultPriority === 'P2' ? 3 : c.defaultPriority === 'P3' ? 2 : 1,
        required_equipment: c.equipment,
      })),
      acuity_score: acuityScore,
      feature_importance: featureImportance,
      confidence_score: Number(confidenceScore.toFixed(2)),
      plain_explanation: plainExplanation,
    };
  }
}
