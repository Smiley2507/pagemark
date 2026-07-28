# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-ai-workflow.spec.ts >> structural suggestions queue rename and add-with-content cards with undo
- Location: e2e/editor-ai-workflow.spec.ts:160:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('ai-proposed-change-600').getByRole('button', { name: 'Undo' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - generic:
      - button "Ctrl+Shift+F Exit focus mode":
        - generic: Ctrl+Shift+F
        - text: Exit focus mode
    - banner [ref=e4]:
      - generic [ref=e5]:
        - button "Back to project" [ref=e6] [cursor=pointer]:
          - img [ref=e7]
        - textbox "Document title" [ref=e9]: Lifecycle Guide
        - generic [ref=e10]:
          - img [ref=e11]
          - text: Draft
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]:
            - img [ref=e23]
            - generic [ref=e25]: Saved
          - tooltip "Saved 10:00:00 AM"
        - button "Quality" [ref=e26] [cursor=pointer]:
          - img [ref=e27]
          - generic [ref=e30]: Quality
        - button "Share" [ref=e31] [cursor=pointer]:
          - img [ref=e32]
          - generic [ref=e38]: Share
        - button "Export" [ref=e39] [cursor=pointer]:
          - img [ref=e40]
          - generic [ref=e43]: Export
        - button "User menu" [ref=e44] [cursor=pointer]:
          - generic [ref=e45]: VU
    - generic [ref=e46]:
      - complementary [ref=e47]:
        - generic [ref=e48]:
          - paragraph [ref=e49]: Outline
          - generic [ref=e50]:
            - button "Accept all review-ready sections" [ref=e51] [cursor=pointer]:
              - img [ref=e52]
            - button "Close outline panel" [ref=e55] [cursor=pointer]:
              - img [ref=e56]
        - navigation "Document table of contents" [ref=e59]:
          - generic [ref=e60]:
            - button "Drag Overview" [ref=e61]:
              - img [ref=e62]
            - button "Overview" [ref=e69] [cursor=pointer]:
              - generic [ref=e70]: Overview
          - button "Overview" [ref=e72] [cursor=pointer]:
            - generic [ref=e73]: Overview
          - generic [ref=e74]:
            - button "Drag System Architecture" [ref=e75]:
              - img [ref=e76]
            - button "System Architecture" [ref=e83] [cursor=pointer]:
              - generic [ref=e84]: System Architecture
          - button "Architecture" [ref=e86] [cursor=pointer]:
            - generic [ref=e87]: Architecture
          - generic [ref=e88]:
            - button "Drag Operational Playbook" [ref=e89]:
              - img [ref=e90]
            - button "Operational Playbook" [ref=e97] [cursor=pointer]:
              - generic [ref=e98]: Operational Playbook
          - status [ref=e99]
        - generic [ref=e102]:
          - generic [ref=e103]:
            - generic [ref=e104]:
              - img [ref=e105]
              - text: Words
            - generic [ref=e108]: "20"
          - generic [ref=e109]:
            - generic [ref=e110]:
              - img [ref=e111]
              - text: Review
            - generic [ref=e116]: 0/2
          - generic [ref=e118]:
            - button "Quality" [ref=e119] [cursor=pointer]:
              - img [ref=e120]
              - text: Quality
            - generic [ref=e123]:
              - button "Run quality analysis" [ref=e124] [cursor=pointer]:
                - img [ref=e125]
              - generic [ref=e129]: NaN%
          - generic [ref=e130]:
            - generic [ref=e131]:
              - img [ref=e132]
              - text: Issues
            - generic [ref=e136]: "0"
          - generic [ref=e137]:
            - generic [ref=e138]:
              - img [ref=e139]
              - text: Broken links
            - generic [ref=e143]: "0"
      - main [ref=e144]:
        - generic [ref=e145]:
          - generic [ref=e146]:
            - generic [ref=e147]: 3 sections
            - generic [ref=e148]: 20 words
          - generic [ref=e150]:
            - generic [ref=e151]:
              - generic "AI-generated prose is present, but it stays draft content until explicit acceptance." [ref=e153]
              - textbox "Heading for Overview" [ref=e155]: Overview
              - generic [ref=e156]:
                - generic "Generated Draft. AI-generated prose is present, but it stays draft content until explicit acceptance." [ref=e157]:
                  - img [ref=e158]
                  - text: Generated Draft
                - button "Add section above" [ref=e161] [cursor=pointer]:
                  - img [ref=e162]
                - button "Add section below" [ref=e163] [cursor=pointer]:
                  - img [ref=e164]
                - button "Delete section" [ref=e165] [cursor=pointer]:
                  - img [ref=e166]
                - button "More actions" [ref=e169] [cursor=pointer]:
                  - img [ref=e170]
            - generic [ref=e177]:
              - heading "Overview" [level=1] [ref=e178]
              - paragraph [ref=e179]: Existing architecture summary.
          - generic [ref=e181]:
            - generic [ref=e182]:
              - generic "AI-generated prose is present, but it stays draft content until explicit acceptance." [ref=e184]
              - textbox "Heading for System Architecture" [ref=e186]: System Architecture
              - generic [ref=e187]:
                - generic "Generated Draft. AI-generated prose is present, but it stays draft content until explicit acceptance." [ref=e188]:
                  - img [ref=e189]
                  - text: Generated Draft
                - button "Add section above" [ref=e192] [cursor=pointer]:
                  - img [ref=e193]
                - button "Add section below" [ref=e194] [cursor=pointer]:
                  - img [ref=e195]
                - button "Delete section" [ref=e196] [cursor=pointer]:
                  - img [ref=e197]
                - button "More actions" [ref=e200] [cursor=pointer]:
                  - img [ref=e201]
            - generic [ref=e208]:
              - heading "Architecture" [level=1] [ref=e209]
              - paragraph [ref=e210]: Service boundaries and exports.
          - generic [ref=e212]:
            - generic [ref=e213]:
              - generic "AI-generated prose is present, but it stays draft content until explicit acceptance." [ref=e215]
              - textbox "Heading for Operational Playbook" [ref=e217]: Operational Playbook
              - generic [ref=e218]:
                - generic "Generated Draft. AI-generated prose is present, but it stays draft content until explicit acceptance." [ref=e219]:
                  - img [ref=e220]
                  - text: Generated Draft
                - button "Add section above" [ref=e223] [cursor=pointer]:
                  - img [ref=e224]
                - button "Add section below" [ref=e225] [cursor=pointer]:
                  - img [ref=e226]
                - button "Delete section" [ref=e227] [cursor=pointer]:
                  - img [ref=e228]
                - button "More actions" [ref=e231] [cursor=pointer]:
                  - img [ref=e232]
            - paragraph [ref=e240]: Operational playbook body from source analysis.
          - button "Add Section" [ref=e242] [cursor=pointer]:
            - img [ref=e243]
            - text: Add Section
      - generic [ref=e245]:
        - generic [ref=e246]:
          - generic [ref=e247]:
            - button "AI" [ref=e248] [cursor=pointer]:
              - img [ref=e249]
              - text: AI
            - button "Notes" [ref=e252] [cursor=pointer]:
              - img [ref=e253]
              - text: Notes
          - button "Close right panel" [ref=e256] [cursor=pointer]:
            - img [ref=e257]
        - generic [ref=e261]:
          - generic [ref=e262]:
            - generic [ref=e263]:
              - img [ref=e264]
              - generic [ref=e267]: Mark
            - button "AI settings" [ref=e269] [cursor=pointer]:
              - img [ref=e270]
          - generic [ref=e274]:
            - generic [ref=e275]:
              - generic [ref=e276]: AI model
              - combobox "AI model" [ref=e277]:
                - option "gpt-4.1-mini" [selected]
            - button "Context" [ref=e278] [cursor=pointer]:
              - img [ref=e279]
              - text: Context
              - img [ref=e282]
          - generic [ref=e284]:
            - generic [ref=e285]:
              - generic [ref=e286]:
                - generic [ref=e287]:
                  - heading "Open review" [level=3] [ref=e288]
                  - paragraph [ref=e289]: Queued changes not attached to the current conversation.
                - generic [ref=e290]: "2"
              - generic [ref=e291]:
                - generic [ref=e292]:
                  - generic [ref=e293]:
                    - generic [ref=e294]:
                      - paragraph [ref=e295]: Rewrite overview
                      - paragraph [ref=e296]: rewrite selection · proposed
                    - generic [ref=e297]:
                      - button "Accept" [ref=e298] [cursor=pointer]:
                        - img [ref=e299]
                        - text: Accept
                      - button "Reject" [ref=e301] [cursor=pointer]:
                        - img [ref=e302]
                        - text: Reject
                  - paragraph [ref=e305]: Improve clarity.
                  - generic [ref=e307]:
                    - generic [ref=e308]:
                      - generic [ref=e309]: +1 lines
                      - generic [ref=e311]: "-1 lines"
                    - generic [ref=e314]:
                      - generic [ref=e315]:
                        - generic [ref=e316]: "-"
                        - generic [ref=e317]: Existing architecture summary.
                      - generic [ref=e318]:
                        - generic [ref=e319]: +
                        - generic [ref=e320]: Rewritten architecture summary.
                - generic [ref=e321]:
                  - generic [ref=e322]:
                    - generic [ref=e323]:
                      - paragraph [ref=e324]: Add operations section
                      - paragraph [ref=e325]: add section · proposed
                    - generic [ref=e326]:
                      - button "Accept" [ref=e327] [cursor=pointer]:
                        - img [ref=e328]
                        - text: Accept
                      - button "Reject" [ref=e330] [cursor=pointer]:
                        - img [ref=e331]
                        - text: Reject
                  - paragraph [ref=e334]: Document operational workflow.
                  - generic [ref=e336]: "Add section Heading: Operations Placement: Top level, position 3 Initial draft: empty"
            - button "Review history 2 closed changes" [ref=e338] [cursor=pointer]:
              - generic [ref=e339]:
                - generic [ref=e340]: Review history
                - generic [ref=e341]: 2 closed changes
              - img [ref=e342]
            - generic [ref=e345]:
              - button "Generate" [ref=e346] [cursor=pointer]
              - button "Refine" [ref=e347] [cursor=pointer]
              - button "Expand" [ref=e348] [cursor=pointer]
              - button "Structure" [ref=e349] [cursor=pointer]
          - generic [ref=e351]:
            - img [ref=e352]
            - generic [ref=e355]: Using context
            - generic [ref=e356]:
              - generic [ref=e357]:
                - img [ref=e358]
                - img [ref=e360]
                - generic [ref=e363]: Overview
              - generic [ref=e365]:
                - img [ref=e366]
                - img [ref=e368]
                - generic [ref=e370]: Project brief
              - generic [ref=e371]:
                - img [ref=e372]
                - img [ref=e374]
                - generic [ref=e379]: Using latest analysis
              - generic [ref=e380]:
                - img [ref=e381]
                - img [ref=e383]
                - generic [ref=e388]: 42 files
              - generic [ref=e389]:
                - img [ref=e390]
                - img [ref=e392]
                - generic [ref=e397]: TypeScript / React, FastAPI
            - link "AI Context" [ref=e398] [cursor=pointer]:
              - /url: /projects/10/source
              - text: AI Context
              - img [ref=e399]
          - generic [ref=e404]:
            - textbox "Message Mark... (type @ to reference)" [ref=e405]
            - generic [ref=e406]:
              - generic [ref=e407]:
                - button "Attach resource" [ref=e408] [cursor=pointer]:
                  - img [ref=e409]
                - generic [ref=e411]:
                  - button "Chat" [ref=e413] [cursor=pointer]:
                    - img [ref=e414]
                    - text: Chat
                    - img [ref=e416]
                  - generic "OpenAI / gpt-4.1-mini" [ref=e418]
              - button "Send message" [disabled] [ref=e420]:
                - img [ref=e421]
```

# Test source

```ts
  80  |   await expect(card).toContainText('Insert lifecycle note');
  81  |   await card.getByRole('button', { name: 'Accept' }).click();
  82  |   await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
  83  | });
  84  | 
  85  | test('chat replace renders a proposed change card and uses preserved editor selection', async ({ page }) => {
  86  |   await openEditor(page);
  87  |   await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  88  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  89  | 
  90  |   await sendAiPrompt(page, 'Replace the selected overview text');
  91  |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  92  |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  93  |   await expect(card).toContainText('Replace selected lifecycle text');
  94  |   await card.getByRole('button', { name: 'Accept' }).click();
  95  |   await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
  96  | });
  97  | 
  98  | test('collapsed selections show a visible replace failure instead of reusing stale ranges', async ({ page }) => {
  99  |   await openEditor(page);
  100 |   await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  101 |   await page.getByTestId('editor-section-302').locator('.tiptap p').first().click();
  102 |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  103 | 
  104 |   await sendAiPrompt(page, 'Replace the selected overview text');
  105 |   await expect(page.getByTestId('ai-panel-transcript')).toContainText('requires selection metadata');
  106 |   await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary.');
  107 |   await expect(page.getByTestId('editor-section-301')).not.toContainText('Replacement lifecycle text from AI.');
  108 | });
  109 | 
  110 | test('slash insert command auto-submits and creates a proposed change card', async ({ page }) => {
  111 |   await openEditor(page);
  112 |   await page.getByTestId('editor-section-301').locator('[contenteditable="true"]').first().click();
  113 |   await page.keyboard.press('End');
  114 |   await page.keyboard.press('Enter');
  115 |   await page.keyboard.type('/insert');
  116 |   await page.getByRole('button', { name: /Insert with AI/ }).click();
  117 | 
  118 |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  119 |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  120 |   await expect(card).toContainText('Insert lifecycle note');
  121 |   await card.getByRole('button', { name: 'Accept' }).click();
  122 |   await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
  123 | });
  124 | 
  125 | test('selection polish command auto-submits and preserves the selected range', async ({ page }) => {
  126 |   await openEditor(page);
  127 |   const paragraph = page.getByTestId('editor-section-301').locator('.tiptap p').first();
  128 |   const box = await paragraph.boundingBox();
  129 |   if (!box) throw new Error('Expected overview paragraph to be visible');
  130 |   await page.mouse.move(box.x + 4, box.y + box.height / 2);
  131 |   await page.mouse.down();
  132 |   await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 8 });
  133 |   await page.mouse.up();
  134 |   await page.getByRole('button', { name: 'Polish selection' }).click();
  135 | 
  136 |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  137 |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  138 |   await expect(card).toContainText('Replace selected lifecycle text');
  139 |   await card.getByRole('button', { name: 'Accept' }).click();
  140 |   await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
  141 | });
  142 | 
  143 | test('right-click polish command auto-submits a replace-selection action card', async ({ page }) => {
  144 |   await openEditor(page);
  145 |   const paragraph = page.getByTestId('editor-section-301').locator('.tiptap p').first();
  146 |   await paragraph.selectText();
  147 |   const box = await paragraph.boundingBox();
  148 |   if (!box) throw new Error('Expected overview paragraph to be visible');
  149 |   await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  150 |   await expect(page.getByText('Polish phrasing')).toBeVisible();
  151 |   await page.getByText('Polish phrasing').click();
  152 | 
  153 |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  154 |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  155 |   await expect(card).toContainText('Replace selected lifecycle text');
  156 |   await card.getByRole('button', { name: 'Accept' }).click();
  157 |   await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
  158 | });
  159 | 
  160 | test('structural suggestions queue rename and add-with-content cards with undo', async ({ page }) => {
  161 |   await openEditor(page);
  162 |   await page.getByTestId('editor-section-301').locator('.tiptap').click();
  163 |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  164 |   await page.getByRole('button', { name: 'Structure' }).click();
  165 |   await expect(page.getByText('Suggested changes')).toBeVisible();
  166 |   await page.getByRole('button', { name: 'Apply all' }).click();
  167 | 
  168 |   await expect(page.getByText('Open review')).toBeVisible();
  169 |   const renameCard = page.getByTestId('ai-proposed-change-600');
  170 |   const addCard = page.getByTestId('ai-proposed-change-601');
  171 |   await expect(renameCard).toContainText('Rename section to "System Architecture"');
  172 |   await expect(addCard).toContainText('Add section "Operational Playbook"');
  173 | 
  174 |   await renameCard.getByRole('button', { name: 'Accept' }).click();
  175 |   await expect(page.getByLabel('Heading for System Architecture')).toHaveValue('System Architecture');
  176 |   await addCard.getByRole('button', { name: 'Accept' }).click();
  177 |   await expect(page.getByLabel('Heading for Operational Playbook')).toHaveValue('Operational Playbook');
  178 |   await expect(page.getByTestId('editor-section-952')).toContainText('Operational playbook body from source analysis.');
  179 | 
> 180 |   await renameCard.getByRole('button', { name: 'Undo' }).click();
      |                                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  181 |   await expect(page.getByLabel('Heading for Architecture')).toHaveValue('Architecture');
  182 |   await expect(page.getByTestId('editor-section-952')).toHaveCount(0);
  183 | });
  184 | 
```