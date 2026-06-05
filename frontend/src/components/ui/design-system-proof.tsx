import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Popover } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { Surface } from '@/components/ui/surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';

export function DesignSystemPrimitiveProof() {
  return (
    <Surface variant="workspace" padding="lg">
      <Surface variant="panel" padding="lg">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Queued</Badge>
          <Badge variant="generation">Generating</Badge>
          <Badge variant="generation">Generated Draft</Badge>
          <Badge variant="review">Reviewed</Badge>
          <Badge variant="warning">Potentially Stale</Badge>
          <Badge variant="needsInput">Needs input</Badge>
          <Badge variant="danger">Failed</Badge>
        </div>

        <div className="mt-4 grid gap-3">
          <Input aria-label="Document title" placeholder="Document title" />
          <Select aria-label="Generation mode">
            <option>Generate on demand</option>
            <option>Complete Document</option>
          </Select>
          <SegmentedControl
            label="View mode"
            value="list"
            onValueChange={() => undefined}
            options={[
              { value: 'list', label: 'List' },
              { value: 'grid', label: 'Grid' },
            ]}
          />
          <Progress value={64} label="Review progress" />
        </div>

        <div className="mt-4 grid gap-3">
          <Notice variant="warning" title="Provider usage">
            Estimated provider cost is approximate and may vary.
          </Notice>
          <EmptyState title="No Sections yet" description="Approve an Outline to materialize Sections." />
        </div>

        <Tabs defaultValue="states" className="mt-4">
          <TabsList>
            <TabsTrigger value="states">States</TabsTrigger>
            <TabsTrigger value="overlays">Overlays</TabsTrigger>
          </TabsList>
          <TabsContent value="states">
            <span>Core primitive states render from shared variants.</span>
          </TabsContent>
          <TabsContent value="overlays">
            <div className="flex gap-3">
              <Tooltip content="Status labels include icons and text.">
                <Button type="button" variant="ghost" size="icon" aria-label="Status help">
                  <Info className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Popover trigger={<Info className="h-4 w-4" aria-hidden="true" />}>
                <p className="text-meta text-text-secondary">
                  Popovers use the elevated overlay token and keyboard-visible focus.
                </p>
              </Popover>
            </div>
          </TabsContent>
        </Tabs>
      </Surface>
    </Surface>
  );
}
