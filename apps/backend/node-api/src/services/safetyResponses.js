import { classifyLegalTopic } from "./legalTopicClassifier.js";

const DOMAIN_INFO = {
  employment: {
    areas: ["unfair dismissal", "discrimination", "breach of contract", "workplace rights"],
    resources: ["Citizens Advice", "ACAS", "a qualified employment solicitor"]
  },
  discrimination: {
    areas: ["direct discrimination", "indirect discrimination", "harassment", "protected characteristics"],
    resources: ["Citizens Advice", "Equality and Human Rights Commission (EHRC)", "a qualified solicitor"]
  },
  privacy: {
    areas: ["private life rights (Article 8)", "data protection duties", "lawful basis for data use", "proportionality and necessity"],
    resources: ["Information Commissioner's Office (ICO)", "Citizens Advice", "a data protection solicitor"]
  },
  housing: {
    areas: ["tenancy rights", "eviction rules", "deposit protection", "repair responsibilities"],
    resources: ["Citizens Advice", "Shelter", "a housing law solicitor"]
  },
  immigration: {
    areas: ["visa conditions", "application procedures", "appeal rights", "residency pathways"],
    resources: ["Citizens Advice", "official GOV.UK immigration guidance", "an OISC adviser or immigration solicitor"]
  },
  human_rights: {
    areas: ["proportionality", "public authority duties", "qualified vs absolute rights", "available remedies"],
    resources: ["Citizens Advice", "Equality and Human Rights Commission (EHRC)", "a qualified solicitor"]
  },
  constitutional_rights: {
    areas: ["judicial review principles", "rule of law", "public authority decision-making", "procedural fairness"],
    resources: ["Citizens Advice", "official UK courts and tribunals guidance", "a public law solicitor"]
  },
  public_authority: {
    areas: ["lawful decision-making", "proportionality", "procedural fairness", "complaint and review routes"],
    resources: ["Citizens Advice", "relevant ombudsman/public body complaint routes", "a qualified solicitor"]
  },
  general: {
    areas: ["possible legal rights", "relevant procedures", "evidence and records", "applicable time limits"],
    resources: ["Citizens Advice", "official GOV.UK guidance", "a qualified solicitor"]
  }
};

export function buildSafetyResponse(message) {
  const domain = classifyLegalTopic(message).topic;
  const cfg = DOMAIN_INFO[domain] || DOMAIN_INFO.general;

  const answer = [
    "I cannot provide personalised legal advice or tell you whether you should take legal action.",
    "",
    "However, in general, this area may involve:",
    ...cfg.areas.map((item) => `- ${item}`),
    "",
    "You may wish to consult:",
    ...cfg.resources.map((item) => `- ${item}`),
    "",
    "I can still explain the general legal concepts in plain English if you want."
  ].join("\n");

  return {
    answer,
    answerType: "safety_refusal",
    safeGeneralInfo: cfg.areas,
    suggestedResources: cfg.resources
  };
}
