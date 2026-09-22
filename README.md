# Smart Actions

Use **Jev** to classify requests, assess urgency and score feedback—then write
the results back to your `.eidos` file.

[简体中文](README.zh-CN.md)

**Select inputs → define rules → choose output fields.**

Create reusable actions by hand, or describe what you need and review an
AI-generated draft. One action can read multiple fields and produce multiple results.

## What you can build

| Input | Judgment | Output |
| --- | --- | --- |
| Customer message | Which department should handle it? | Category · Select |
| Message and subject | Does this need immediate attention? | Urgency · Number, 0–1 |
| Customer feedback | How dissatisfied is the customer? | Score · Number |
| Customer message | Is a refund explicitly requested? | Refund requested · Checkbox |

Jev performs classification, scoring and probability judgments. Actions
do not generate free-form replies or summaries, create records, or add fields.

## Before you start

Smart Actions requires plugin API **1.1.0** and uses package format 2. Upgrade
older clients first. CLI Serve does not yet support its action and configuration
APIs. The plugin API contract is independent of the npm SDK version.

- **Eidos Lite 0.17.0 or later**, with plugin API 1.1.0 support.
- A TypeSafe AI API key to access Jev.
- A `.eidos` table with the input and output fields you want to use.

An additional generation model is optional; manual configuration does not need it.

## Install and connect

1. Drag the `.eidos-plugin` package into Lite's **Plugins** page and enable it
   for your Space. To update, drag the new package into the same page.
2. Open **Plugins → Smart Actions → Settings → TypeSafe AI** and save your API key.
3. Right-click a `.eidos` file and choose **Open with → Smart Actions**.

## Create an action

Select a table in the sidebar, then **＋ 新建动作 → 手动创建**.

1. **Inputs:** select the fields the action should read.
2. **Outputs:** add a destination and choose an existing writable field.
3. **Rules:** select an output in the flow map to edit its judgment type and rule
   below. For example: “Use Message to choose the department that best matches
   the customer's main request.”
4. Name the action, optionally choose an icon, and **Save**.

Actions are grouped under their tables. Drag the sidebar's right edge to resize
it; double-click to reset. Switching tables or outputs preserves unsaved edits
while the editor remains open.

### Generate a draft with AI

Configure **Plugins → Smart Actions → Settings → Action Generator** with:

- The full public HTTPS Chat Completions endpoint, including `/v1/chat/completions`.
- The provider's model ID.
- An API key for that endpoint.

Choose **＋ 新建动作 → 用 AI 生成动作** and describe the result you want:

> Classify each customer message using Category's existing options, and put the
> probability that it needs immediate attention in Urgency.

Review the fields and rules, edit as needed, then save. Generating a draft does
not execute it or modify records. The generation model designs the configuration;
Jev still performs the judgments when you run it.

## Run, stop and undo

Open the file with the built-in editor. In Grid, right-click a record or selected
records and choose your action. **Select all** includes matching records not yet
loaded into the grid.

Validated results apply directly. The task window shows progress and estimated
Jev execution cost. Stopping a run preserves completed writes.

- **Undo this run** restores completed writes without overwriting later edits.
- **Redo this run** reapplies stored results without another model request.
- Undo is available in the current table/run session, not after restarting Lite.
- Closing the task window hides it; use the stop control to stop processing.

Targets are fixed when a run begins. Later filter changes and newly added records
do not expand them. Deleted records are skipped. Errors or conflicts stop the
run and retain previously completed writes.

## Output types

| Judgment | Destination | Behavior |
| --- | --- | --- |
| Classification | Select | Reuses current field options; manage them in field settings. |
| Classification | Text | Chooses from categories defined in the action. |
| Score | Number | Uses ordered levels starting at 0; results can be fractional. |
| Probability | Number | Writes a value between 0 and 1. |
| Yes / No | Checkbox | Applies a configurable probability threshold. |

Classification needs 2–255 distinct, nonempty choices; scoring needs 2–10 ordered
levels. Outputs are independent: rules cannot rely on other outputs' results
from the same run.

## Data and connections

Action definitions are saved with their table in the `.eidos` file. API keys are
stored separately in Lite's encrypted connection store, scoped to the current
Space. Changing a generation endpoint requires entering its key again.

| Operation | Data sent to the provider |
| --- | --- |
| Generate a draft | Your description and field structure/options; no record contents. |
| Run an action | Selected input values, judgment rules and choices. |
| Undo or redo | No model request. |

Execution batches up to 10 records per request, with two batches in flight.
Large inputs may use smaller batches. The displayed cost is an estimate from
returned usage, not an invoice; unavailable usage is not treated as free.
Generation-provider charges are separate, and undo does not reverse charges.

## Troubleshooting

- **Cannot generate:** configure Action Generator and check the full endpoint,
  model ID and credentials.
- **No suitable output field:** create it in the built-in editor first.
- **Missing classification options:** add them in the Select field's settings.
  Each run reads the latest options.
- **Only some records updated:** inspect the task error and resolve the cause,
  or undo completed writes before running again.

## Development

Source code and co-located tests live in `src/`. `plugin.json` declares the
extension and settings entry points; build and smoke-test scripts live in `scripts/`.

```sh
npm ci
npm run check
npm test
npm run pack:plugin
```

The package and checksum are written to `dist/`. There are no runtime dependencies.
Action configuration lives in `settings_json.plugins["eidos.smart-actions"]`.
Runs are limited to 100,000 records and the host's 64 MiB undo storage limit.

`scripts/live-smoke.mjs` accepts `TYPESAFE_API_KEY` or a key via stdin and tests
with synthetic data. Do not commit credentials.

[Jev API documentation](https://docs.typesafe.ai/api)
