import {
  AutomationSolution,
  HealthIssue,
  PlantIDSuggestion,
  Suggestion,
  TreatmentPlan,
} from "../../interface/plants";

/**
 * Convert raw disease suggestion into structured health issue.
 * @param suggestion Plant.ID disease suggestion
 * @returns Parsed health issue
 */
export const categorizeHealthIssue = (
  suggestion: PlantIDSuggestion
): HealthIssue => {
  const issueType = determineIssueType(suggestion.name);
  const severity = calculateSeverity(suggestion.probability);

  return {
    name: suggestion.name,
    type: issueType,
    probability: suggestion.probability,
    severity,
    description:
      suggestion.details?.description?.value ||
      suggestion.details?.description_gpt ||
      "No description available",
    symptoms: extractSymptoms(
      suggestion.details?.description?.value ||
        suggestion.details?.description_gpt ||
        ""
    ),
    causes: extractCauses(
      suggestion.details?.description?.value ||
        suggestion.details?.description_gpt ||
        ""
    ),
    treatment: generateTreatment(suggestion, issueType),
    similarImages: suggestion.similar_images?.map((s) => s.url) || [],
  };
};

/**
 * Determines the type of plant health issue based on the issue name.
 *
 * The function analyzes keywords in the provided issue name to categorize
 * the problem into one of the recognized health issue types such as
 * "disease", "pest", "environmental", or "nutrient".
 *
 * @param name - The raw name of the detected health issue.
 * @returns The categorized health issue type.
 */
const determineIssueType = (name: string): HealthIssue["type"] => {
  const lower = name.toLowerCase();

  if (
    lower.includes("fungi") ||
    lower.includes("bacterial") ||
    lower.includes("viral")
  ) {
    return "disease";
  }
  if (
    lower.includes("insect") ||
    lower.includes("pest") ||
    lower.includes("animalia")
  ) {
    return "pest";
  }
  if (
    lower.includes("water") ||
    lower.includes("light") ||
    lower.includes("temperature")
  ) {
    return "environmental";
  }
  if (lower.includes("nutrient") || lower.includes("deficiency")) {
    return "nutrient";
  }

  return "environmental";
};

/**
 * Calculates the severity level of a plant health issue based on its probability.
 *
 * The severity is classified into three levels:
 * - "high" for probability ≥ 0.7
 * - "medium" for probability ≥ 0.4 and < 0.7
 * - "low" for probability < 0.4
 *
 * @param probability - The likelihood (0–1) of the detected issue.
 * @returns The severity level corresponding to the probability.
 */
const calculateSeverity = (probability: number): HealthIssue["severity"] => {
  if (probability >= 0.7) return "high";
  if (probability >= 0.4) return "medium";
  return "low";
};

/**
 * Extracts recognizable plant symptom keywords from a description text.
 *
 * The function scans the provided description for common symptom indicators
 * such as yellowing, browning, wilting, spots, rot, and more. It returns a
 * list of human-readable symptom labels based on detected keywords.
 *
 * If no known symptoms are found, it defaults to returning:
 * ["General plant stress visible"].
 *
 * @param description - The text describing the plant condition.
 * @returns An array of detected symptom labels.
 */
const extractSymptoms = (description: string): string[] => {
  const symptoms: string[] = [];
  const lower = description.toLowerCase();

  if (lower.includes("yellow")) symptoms.push("Yellowing leaves");
  if (lower.includes("brown")) symptoms.push("Browning or discoloration");
  if (lower.includes("wilt")) symptoms.push("Wilting");
  if (lower.includes("spot")) symptoms.push("Leaf spots");
  if (lower.includes("rot")) symptoms.push("Root or stem rot");
  if (lower.includes("stunted")) symptoms.push("Stunted growth");
  if (lower.includes("burn")) symptoms.push("Leaf burn or scorching");

  return symptoms.length > 0 ? symptoms : ["General plant stress visible"];
};

/**
 * Extracts the likely causes of a plant issue from a textual description.
 *
 * The function scans the description for key indicators such as watering
 * issues, fungal infections, pest activity, or nutrient deficiencies.
 * Based on detected keywords, it returns an array of human-readable cause
 * explanations.
 *
 * If no specific cause is found, it defaults to returning:
 * ["Environmental stress factors"].
 *
 * @param description - The plant issue description to analyze.
 * @returns A list of likely causes derived from the description.
 */
const extractCauses = (description: string): string[] => {
  const causes: string[] = [];
  const lower = description.toLowerCase();

  if (lower.includes("overwater") || lower.includes("excess water")) {
    causes.push("Excessive watering or poor drainage");
  }
  if (lower.includes("underwater") || lower.includes("drought")) {
    causes.push("Insufficient watering");
  }
  if (lower.includes("fungal") || lower.includes("fungi")) {
    causes.push("Fungal infection due to moisture and humidity");
  }
  if (lower.includes("insect") || lower.includes("pest")) {
    causes.push("Pest infestation");
  }
  if (lower.includes("nutrient")) {
    causes.push("Nutrient deficiency in soil");
  }

  return causes.length > 0 ? causes : ["Environmental stress factors"];
};

/**
 * Generates a customized treatment plan based on the detected health issue type.
 *
 * The function analyzes the issue classification (disease, pest, environmental,
 * nutrient) and returns a structured treatment plan including immediate actions,
 * long-term care, and preventive measures.
 *
 * @param suggestion - The PlantID suggestion object containing issue details.
 * @param type - The categorized type of health issue.
 * @returns A structured treatment plan appropriate for the issue type.
 */
const generateTreatment = (
  suggestion: Suggestion,
  type: HealthIssue["type"]
): TreatmentPlan => {
  const common = suggestion.details?.common_names?.[0] || suggestion.name;

  const treatments: Record<HealthIssue["type"], TreatmentPlan> = {
    disease: {
      immediate: [
        "Remove and dispose of infected plant parts",
        "Isolate affected plant to prevent spread",
        "Apply appropriate fungicide or bactericide",
      ],
      longTerm: [
        "Improve air circulation around plants",
        "Adjust watering schedule to avoid moisture buildup",
        "Monitor regularly for recurrence",
      ],
      prevention: [
        "Maintain proper spacing between plants",
        "Water at soil level, not on foliage",
        "Use disease-resistant plant varieties",
      ],
    },

    pest: {
      immediate: [
        "Manually remove visible pests",
        "Apply organic insecticidal soap",
        "Use neem oil spray treatment",
      ],
      longTerm: [
        "Introduce beneficial insects",
        "Regular monitoring and early intervention",
        "Maintain plant health to improve resistance",
      ],
      prevention: [
        "Keep garden area clean and debris-free",
        "Use companion planting strategies",
        "Install physical barriers if needed",
      ],
    },

    environmental: {
      immediate: [
        common.includes("water excess")
          ? "Stop watering and improve drainage"
          : "Adjust watering schedule",
        "Move plant to appropriate light conditions",
        "Check and adjust soil moisture levels",
      ],
      longTerm: [
        "Establish consistent care routine",
        "Monitor environmental conditions regularly",
        "Adjust care based on seasonal changes",
      ],
      prevention: [
        "Use moisture meter for accurate watering",
        "Ensure proper drainage in containers",
        "Provide appropriate light exposure",
      ],
    },

    nutrient: {
      immediate: [
        "Apply balanced fertilizer",
        "Test soil pH and adjust if needed",
        "Supplement with specific nutrients",
      ],
      longTerm: [
        "Implement regular fertilization schedule",
        "Add organic matter to soil",
        "Monitor plant growth response",
      ],
      prevention: [
        "Use quality potting mix or soil",
        "Follow recommended feeding schedule",
        "Conduct annual soil tests",
      ],
    },
  };

  return treatments[type] || treatments.environmental;
};

/**
 * Generates tailored Kasagardem automation solutions based on detected plant health issues.
 *
 * The function evaluates each health issue (disease, pest, environmental, nutrient)
 * and returns a set of actionable automation features such as smart irrigation,
 * AI monitoring, and climate control. Each solution includes benefits and setup steps
 * to guide users in improving plant health using Kasagardem's automation ecosystem.
 *
 * @param healthIssues - List of detected plant health issues.
 * @returns A list of automation solutions recommended for the given health issues.
 */
export const generateKasagardemSolutions = (
  healthIssues: HealthIssue[]
): AutomationSolution[] => {
  const solutions: AutomationSolution[] = [];

  healthIssues.forEach((issue) => {
    if (issue.type === "environmental" && issue.name.includes("water")) {
      solutions.push({
        issue: issue.name,
        automationFeature: "Smart Irrigation System",
        howItHelps:
          "Kasagardem's automated watering system monitors soil moisture in real-time and delivers precise amounts of water exactly when your plants need it, eliminating the guesswork and preventing both overwatering and underwatering.",
        benefits: [
          "Prevents water-related stress and diseases",
          "Saves water by up to 50% compared to manual watering",
          "Maintains optimal soil moisture 24/7",
          "Adjusts automatically based on weather conditions",
        ],
        setupSteps: [
          "Install soil moisture sensors in your garden beds",
          "Connect to Kasagardem hub and configure plant zones",
          "Set preferred moisture levels for each plant type",
          "System automatically adjusts watering schedule",
        ],
      });
    }

    if (issue.type === "disease" || issue.type === "pest") {
      solutions.push({
        issue: issue.name,
        automationFeature: "AI-Powered Plant Health Monitoring",
        howItHelps:
          "Kasagardem's smart cameras continuously monitor your plants and use AI to detect early signs of disease or pest infestation, alerting you before problems become severe.",
        benefits: [
          "Early detection prevents major outbreaks",
          "Receive instant mobile notifications",
          "Get treatment recommendations automatically",
          "Track plant health trends over time",
        ],
        setupSteps: [
          "Position Kasagardem cameras to view your plants",
          "Enable AI health monitoring in the app",
          "Set notification preferences",
          "Review daily health reports and alerts",
        ],
      });
    }

    if (issue.name.includes("light") || issue.severity === "high") {
      solutions.push({
        issue: "Environmental optimization",
        automationFeature: "Climate Control & Environmental Monitoring",
        howItHelps:
          "Kasagardem tracks temperature, humidity, and light levels, automatically adjusting your grow environment or alerting you when conditions aren't ideal for your plants.",
        benefits: [
          "Maintains optimal growing conditions",
          "Prevents stress from environmental extremes",
          "Extends growing season capabilities",
          "Data-driven insights for better plant care",
        ],
        setupSteps: [
          "Install environmental sensors",
          "Configure ideal ranges for your plants",
          "Connect automated fans, shades, or grow lights",
          "Monitor conditions remotely via app",
        ],
      });
    }
  });

  // Always add general solution
  if (solutions.length === 0 || healthIssues.length > 2) {
    solutions.push({
      issue: "Comprehensive plant care",
      automationFeature: "Integrated Smart Garden System",
      howItHelps:
        "Kasagardem's complete automation platform combines watering, monitoring, and environmental control to create the perfect growing conditions while you focus on enjoying your garden.",
      benefits: [
        "Complete hands-off garden management",
        "Healthier plants with less effort",
        "Remote monitoring from anywhere",
        "Reduce plant loss by up to 80%",
      ],
      setupSteps: [
        "Complete Kasagardem system installation",
        "Register all plants in the app",
        "Configure automation preferences",
        "Let the system handle daily care automatically",
      ],
    });
  }

  return solutions;
};
