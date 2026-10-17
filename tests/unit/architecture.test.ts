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
