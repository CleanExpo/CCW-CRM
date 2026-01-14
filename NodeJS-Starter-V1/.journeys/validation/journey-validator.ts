/**
 * Journey Validator - Pre-commit validation script
 * Ensures all foundation elements are properly connected
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const JOURNEYS_PATH = ".journeys";

function loadYaml(filePath: string): unknown {
  const content = fs.readFileSync(filePath, "utf-8");
  return yaml.parse(content);
}

function getFiles(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(extension))
    .map((f) => path.join(dir, f));
}

function validatePersonas(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const personaFiles = getFiles(path.join(JOURNEYS_PATH, "personas"), ".yaml");

  for (const file of personaFiles) {
    if (file.includes("_index")) continue;

    const persona = loadYaml(file) as Record<string, unknown>;

    if (!persona.psychology) {
      errors.push(`${file}: Missing psychology profile`);
    }
    if (!persona.behavioral_triggers) {
      warnings.push(`${file}: Missing behavioral triggers`);
    }
    if (!persona.journeys) {
      warnings.push(`${file}: No journeys assigned`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateJourneys(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const journeyFiles = getFiles(path.join(JOURNEYS_PATH, "journeys"), ".yaml");

  for (const file of journeyFiles) {
    if (file.includes("_index")) continue;

    const journey = loadYaml(file) as Record<string, unknown>;

    if (!journey.context?.persona_id) {
      errors.push(`${file}: Missing persona reference`);
    }
    if (!journey.context?.aarrr_stage) {
      errors.push(`${file}: Missing AARRR stage`);
    }
    if (!journey.steps || !Array.isArray(journey.steps)) {
      errors.push(`${file}: Missing steps`);
    }
    if (!journey.success_criteria) {
      warnings.push(`${file}: Missing success criteria`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateEmotionalMaps(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const emotionFiles = getFiles(path.join(JOURNEYS_PATH, "emotions"), ".yaml");

  for (const file of emotionFiles) {
    const emotions = loadYaml(file) as Record<string, unknown>;

    if (!emotions.journey_id) {
      errors.push(`${file}: Missing journey reference`);
    }
    if (!emotions.step_emotions) {
      errors.push(`${file}: Missing step emotions`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateComponentStates(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checklistPath = path.join(
    JOURNEYS_PATH,
    "structural",
    "missing-states-checklist.yaml"
  );

  if (!fs.existsSync(checklistPath)) {
    warnings.push("Missing states checklist not found");
    return { valid: true, errors, warnings };
  }

  const checklist = loadYaml(checklistPath) as Record<string, unknown>;
  const components = checklist.component_checklist as Record<string, unknown>;

  if (components) {
    for (const [name, component] of Object.entries(components)) {
      if (name === "template") continue;

      const states = (component as Record<string, unknown>)
        .states_implemented as Record<string, boolean>;
      const requiredStates = ["empty", "loading", "error", "success"];

      for (const state of requiredStates) {
        if (!states?.[state]) {
          errors.push(`Component ${name}: Missing ${state} state`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function runValidation(): void {
  console.log("🔍 Validating Foundation-First Architecture...\n");

  const results = {
    personas: validatePersonas(),
    journeys: validateJourneys(),
    emotions: validateEmotionalMaps(),
    components: validateComponentStates(),
  };

  let hasErrors = false;

  for (const [name, result] of Object.entries(results)) {
    console.log(`\n📋 ${name.toUpperCase()}`);

    if (result.errors.length > 0) {
      hasErrors = true;
      console.log("  ❌ Errors:");
      result.errors.forEach((e) => console.log(`     - ${e}`));
    }

    if (result.warnings.length > 0) {
      console.log("  ⚠️  Warnings:");
      result.warnings.forEach((w) => console.log(`     - ${w}`));
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log("  ✅ All checks passed");
    }
  }

  console.log("\n" + "=".repeat(50));

  if (hasErrors) {
    console.log("❌ Validation FAILED - fix errors before committing");
    process.exit(1);
  } else {
    console.log("✅ Validation PASSED");
    process.exit(0);
  }
}

runValidation();
