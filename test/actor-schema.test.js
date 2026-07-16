import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (relativeUrl) => JSON.parse(await readFile(new URL(relativeUrl, import.meta.url), "utf8"));

test("Actor declares complete machine-readable delivery schemas", async () => {
  const [actor, input, dataset, output, keyValueStore, preview, readme] = await Promise.all([
    readJson("../.actor/actor.json"),
    readJson("../.actor/input_schema.json"),
    readJson("../.actor/dataset_schema.json"),
    readJson("../.actor/output_schema.json"),
    readJson("../.actor/key_value_store_schema.json"),
    readJson("../sample/preview.json"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.equal(actor.title, "Pending Medicare Provider Enrollment Data");
  assert.ok(readme.startsWith(`# ${actor.title}\n`));
  assert.match(input.title, /Pending Medicare provider enrollment/);
  assert.match(output.title, /Pending Medicare provider enrollment/);
  assert.match(dataset.views.overview.title, /Pending Medicare provider enrollment/);
  assert.match(keyValueStore.title, /Pending Medicare provider enrollment/);
  assert.equal(actor.input, "./input_schema.json");
  assert.equal(actor.output, "./output_schema.json");
  assert.equal(actor.storages.dataset, "./dataset_schema.json");
  assert.equal(actor.storages.keyValueStore, "./key_value_store_schema.json");
  assert.equal(input.properties.preview.default, true);

  const declaredFields = Object.keys(dataset.fields.properties).sort();
  const deliveredFields = Object.keys(preview[0]).sort();
  assert.deepEqual(declaredFields, deliveredFields);
  assert.deepEqual([...dataset.fields.required].sort(), deliveredFields);
  for (const field of Object.values(dataset.fields.properties)) {
    assert.equal(typeof field.title, "string");
    assert.ok(field.title.length > 0);
    assert.equal(typeof field.description, "string");
    assert.ok(field.description.length > 0);
    assert.notEqual(field.example, undefined);
  }

  assert.match(output.properties.dataset.template, /apiDefaultDatasetUrl/);
  assert.match(output.properties.output.template, /apiDefaultKeyValueStoreUrl/);
  const fulfillment = keyValueStore.collections.fulfillment;
  assert.equal(fulfillment.key, "OUTPUT");
  assert.deepEqual(fulfillment.contentTypes, ["application/json"]);
  assert.deepEqual(fulfillment.jsonSchema.required, ["ok", "status", "records_returned", "receipt"]);
});
