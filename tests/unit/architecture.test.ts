import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generatedResult } from "../fixtures";
import { architectureNodes } from "../../src/components/discovery/architecture-flow";
import { BlueprintArchitecture } from "../../src/components/discovery/blueprint-architecture";

const { architecture, techStack } = generatedResult.blueprint;
test("saved flow entries retain their complete content and order without inferred nodes or dependencies", () => {
  const source = { overview: architecture.overview, dataFlow: [...architecture.dataFlow, architecture.overview, ...architecture.dataFlow] };
  const before = JSON.stringify(source);
  const nodes = architectureNodes(source, techStack);
  assert.deepEqual(nodes.map(node => node.description), source.dataFlow);
  assert.deepEqual(nodes.map(node => node.index), [0, 1, 2]);
  assert.ok(nodes.every(node => node.category === "Workflow" && node.technologies.length === 0));
  assert.equal(JSON.stringify(source), before);
});
test("technical roles require exact technology mentions or explicit category headings", () => {
  const source = { overview: "", dataFlow: ["Application: Next.js", "Next.json", "Human Review: Review the supplied draft.", "No component was identified."] };
  const nodes = architectureNodes(source, techStack);
  assert.equal(nodes[0].category, "Application");
  assert.equal(nodes[0].technicalLabel, "Next.js");
  assert.deepEqual(nodes[0].technologies, techStack);
  assert.equal(nodes[1].technologies.length, 0);
  assert.equal(nodes[2].category, "Human Review");
  assert.equal(nodes[3].category, "Workflow");
  assert.equal(architectureNodes(source, [{ ...techStack[0], technology: "" }])[0].technologies.length, 0);
});
test("architecture handles absent steps, ambiguous roles, blank descriptions and long content conservatively", () => {
  assert.deepEqual(architectureNodes({ overview: "", dataFlow: [] }, []), []);
  const long = architecture.dataFlow[0].repeat(30);
  const nodes = architectureNodes({ overview: "", dataFlow: [long, ""] }, []);
  assert.equal(nodes[0].description, long);
  assert.ok(nodes[0].businessLabel.length <= 97);
  assert.equal(nodes[1].businessLabel, "Untitled flow step");
  assert.equal(nodes[1].category, "Workflow");
  const markup = renderToStaticMarkup(createElement(BlueprintArchitecture, { architecture: { overview: architecture.overview, dataFlow: [] }, stack: [] }));
  assert.match(markup, /No individual flow steps were provided/);
  assert.ok(markup.includes(architecture.overview));
});
test("architecture defaults to business view and keeps a single separate complete description disclosure", () => {
  const markup = renderToStaticMarkup(createElement(BlueprintArchitecture, { architecture, stack: techStack }));
  assert.match(markup, /aria-pressed="true"[^>]*>Business View/);
  assert.match(markup, /aria-expanded="false"/);
  assert.equal((markup.match(/Show full architecture description/g) ?? []).length, 1);
  assert.equal((markup.match(/class="studio-architecture-node"/g) ?? []).length, architecture.dataFlow.length);
  assert.ok(markup.includes(architecture.overview));
  for (const step of architecture.dataFlow) assert.ok(markup.includes(step));
  assert.doesNotMatch(markup, /Complete flow description|dangerouslySetInnerHTML/);
});

test("new step details are required for generation while both earlier saved formats remain unchanged", async () => {
  const { blueprintResultSchema, generationBlueprintSchema } = await import("../../src/lib/blueprint/schema");
  const { result } = await import("../fixtures");
  assert.deepEqual(blueprintResultSchema.parse(result), result);
  const { stepDetails, ...oldArchitecture } = architecture;
  const previous = { ...generatedResult, blueprint: { ...generatedResult.blueprint, architecture: oldArchitecture } };
  assert.deepEqual(blueprintResultSchema.parse(previous), previous);
  assert.equal(generationBlueprintSchema.safeParse(previous.blueprint).success, false);
  assert.equal(generationBlueprintSchema.safeParse(generatedResult.blueprint).success, true);
  const step = stepDetails![0];
  for (const flexible of [[], [step, step], [{ ...step, purpose: step.title }], [{ ...step, process: ` **${step.title.toUpperCase()}**. ` }], [{ ...step, process: architecture.dataFlow[0] }]]) {
    assert.equal(generationBlueprintSchema.safeParse({ ...generatedResult.blueprint, architecture: { ...architecture, stepDetails: flexible } }).success, true);
  }
  assert.equal(generationBlueprintSchema.safeParse({ ...generatedResult.blueprint, architecture: { ...architecture, stepDetails: [{ ...step, input: null, output: null, technology: [] }] } }).success, true);
});

test("step fields use supplied explanations and hide unavailable values in both views", () => {
  const source = { ...architecture, stepDetails: [{ ...architecture.stepDetails![0], input: null, output: null, technology: [techStack[0].technology] }] };
  const before = JSON.stringify(source);
  const node = architectureNodes(source, techStack)[0];
  assert.equal(node.details.title, source.stepDetails[0].title);
  assert.deepEqual(node.details.fields.map(field => field.label), ["Purpose", "Process", "Technology"]);
  assert.equal(node.details.fields[0].value, source.stepDetails[0].purpose);
  assert.deepEqual(node.technologies, techStack);
  const markup = renderToStaticMarkup(createElement(BlueprintArchitecture, { architecture: source, stack: techStack }));
  assert.ok(markup.includes(source.stepDetails[0].purpose));
  assert.ok(!markup.includes(source.stepDetails[0].process));
  assert.doesNotMatch(markup, />Process<\/dt>|>Technology<\/dt>/);
  assert.doesNotMatch(markup, />Input<\/dt>|>Output<\/dt>|Technical relationships need confirmation/);
  assert.equal(JSON.stringify(source), before);
  const mismatched = architectureNodes({ ...source, dataFlow: [...source.dataFlow, ...source.dataFlow] }, techStack);
  assert.equal(mismatched.length, source.stepDetails.length);
  assert.equal(mismatched[0].businessLabel, source.stepDetails[0].purpose);
  assert.equal(mismatched[0].description, source.stepDetails[0].process);
  assert.equal(mismatched[0].details.fields[0].value, source.stepDetails[0].purpose);
});

test("legacy fields are extracted only from explicit labels, never inferred from an arrow sequence", () => {
  const description = 'Review request\n**Purpose:** Confirm permitted help content.\nInput: Agent question.\nProcess: Review relevant content.\nOutput: An agent-reviewed draft.\nTechnologies: Next.js';
  const nodes = architectureNodes({ overview: "", dataFlow: [description, architecture.dataFlow[0]] }, techStack);
  assert.equal(nodes[0].details.title, "Review request");
  assert.deepEqual(nodes[0].details.fields, [
    { label: "Purpose", value: "Confirm permitted help content." },
    { label: "Input", value: "Agent question." },
    { label: "Process", value: "Review relevant content." },
    { label: "Output", value: "An agent-reviewed draft." },
    { label: "Technology", value: "Next.js" },
  ]);
  assert.deepEqual(nodes[1].details.fields, []);
  assert.equal(nodes[1].details.title, architecture.dataFlow[0]);
});

test("copied blueprint text includes new explanations without changing legacy architecture exports", async () => {
  const { blueprintSections, blueprintText } = await import("../../src/lib/blueprint/presentation");
  const { result } = await import("../fixtures");
  const legacy = blueprintSections(result).find(section => section.id === "architecture")!;
  assert.deepEqual(legacy.lines, [result.blueprint.architecture.overview, ...result.blueprint.architecture.dataFlow.map((value, index) => `${index + 1}. ${value}`)]);
  const copied = blueprintText(generatedResult);
  for (const value of [architecture.stepDetails![0].title, architecture.stepDetails![0].purpose, architecture.stepDetails![0].process, architecture.stepDetails![0].input!, architecture.stepDetails![0].output!]) assert.ok(copied.includes(value));
});

test("business labels use saved purposes while technical labels and complete technical fields stay intact", () => {
  const step = architecture.stepDetails![0];
  const source = { ...architecture, stepDetails: [{ ...step, technology: [techStack[0].technology] }] };
  const before = JSON.stringify(source);
  const node = architectureNodes(source, techStack)[0];
  assert.equal(node.businessLabel, step.purpose);
  assert.equal(node.technicalLabel, techStack[0].technology);
  assert.deepEqual(node.details.fields.map(field => field.label), ["Purpose", "Input", "Process", "Output", "Technology"]);
  assert.equal(node.details.fields.find(field => field.label === "Process")!.value, step.process);
  assert.equal(JSON.stringify(source), before);
  // Missing purpose in legacy data never triggers an invented explanation.
  const legacy = architectureNodes({ overview: "", dataFlow: ["Application: Next.js"] }, techStack)[0];
  assert.equal(legacy.businessLabel, "Application: Next.js");
  assert.equal(legacy.technicalLabel, "Next.js");
  const labeled = architectureNodes({ overview: "", dataFlow: ["Review\nPurpose: Check permission.\nProcess: Inspect access rules."] }, [])[0];
  assert.equal(labeled.businessLabel, "Check permission.");
});
